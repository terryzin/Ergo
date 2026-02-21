#!/usr/bin/env node
/**
 * Ergo API Bridge Server
 *
 * 将 OpenClaw CLI 输出转换为 HTTP API
 * 用途：Ergo 前端通过 HTTP 获取 Gateway 状态
 */

const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const chokidar = require('chokidar');

const execAsync = promisify(exec);
const app = express();

// ============================
// 环境变量配置（Convention over Configuration）
// ============================
const PORT = process.env.API_BRIDGE_PORT || 8082;
const WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE || 'D:\\.openclaw\\workspace';
const PROJECTS_FILE = path.join(__dirname, '../data/projects.json');

// 认证配置
const ERGO_SECRET = process.env.ERGO_API_KEY || 'ergo-default-secret-key-2026';
const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false'; // 默认启用认证

// 启用 CORS（允许 Ergo 前端跨域访问）
app.use(cors());
app.use(express.json());

// 静态文件服务（v1.6.2 统一架构）
// 优先级：静态文件在认证中间件之前，API 路由在认证之后
const staticPath = path.join(__dirname, '..');
app.use(express.static(staticPath, {
    index: 'index.html',
    setHeaders: (res, filePath) => {
        // 防止 HTML 文件被缓存
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// 状态缓存
let statusCache = null;
let lastUpdateTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟

// Gateway 启动时间追踪（用于计算 uptime）
const apiStartTime = Date.now();

// 日志中间件
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// 认证中间件（v1.6.2 优化：只对 API 请求认证，静态文件豁免）
function authMiddleware(req, res, next) {
    // 静态文件请求不需要认证（HTML, CSS, JS, 图片等）
    // 只对 /api/* 路径进行认证
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    // 如果认证被禁用，直接放行
    if (!AUTH_ENABLED) {
        return next();
    }

    // WebSocket 升级请求不需要认证
    if (req.headers.upgrade === 'websocket') {
        return next();
    }

    // 健康检查端点不需要认证
    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }

    // Gateway WebUI 重定向不需要认证（已通过 Gateway 自身的 token 认证）
    if (req.path === '/api/gateway/webui') {
        return next();
    }

    const apiKey = req.headers['x-ergo-key'];

    if (!apiKey) {
        return res.status(401).json({
            error: 'Missing API key',
            message: '请在请求头中提供 X-Ergo-Key',
            hint: '首次访问请配置密钥'
        });
    }

    if (apiKey !== ERGO_SECRET) {
        return res.status(401).json({
            error: 'Invalid API key',
            message: '密钥无效，请检查配置'
        });
    }

    next();
}

// 应用认证中间件到所有路由
app.use(authMiddleware);

/**
 * 解析 OpenClaw CLI 输出
 * 提取有效的 JSON（忽略警告信息）
 */
function parseOpenClawOutput(stdout) {
    // 找到第一个 '{' 位置
    const jsonStart = stdout.indexOf('\n{'); // JSON 通常在新行开始
    if (jsonStart === -1) {
        // 尝试不带换行的
        const altStart = stdout.indexOf('{');
        if (altStart === -1) {
            throw new Error('No JSON found in output');
        }
        return JSON.parse(stdout.substring(altStart));
    }

    // 提取 JSON 部分（从 { 到文件末尾）
    const jsonStr = stdout.substring(jsonStart + 1); // +1 跳过换行符
    return JSON.parse(jsonStr);
}

/**
 * 转换 OpenClaw 数据格式为 Ergo 期望的格式
 */
function transformToErgoFormat(openclawData) {
    // 计算 uptime（API Bridge 启动至今的时间，单位：秒）
    const uptimeSeconds = Math.floor((Date.now() - apiStartTime) / 1000);

    // 提取 Gateway 信息
    const gateway = {
        status: 'online',
        version: openclawData.versions?.openclaw || '2026.2',
        uptime: uptimeSeconds,
        port: 18789,
        lastUpdate: new Date().toISOString()
    };

    // 提取 Agents 信息
    const agents = [];
    if (openclawData.agents && Array.isArray(openclawData.agents)) {
        openclawData.agents.forEach(agent => {
            agents.push({
                name: agent.agentId || agent.name || 'unknown',
                status: agent.enabled ? 'online' : 'offline',
                model: agent.model || 'unknown'
            });
        });
    }

    // 从 sessions 中提取 agent（如果 agents 为空）
    if (agents.length === 0 && openclawData.sessions?.recent) {
        const agentIds = new Set();
        openclawData.sessions.recent.forEach(session => {
            if (session.agentId && !agentIds.has(session.agentId)) {
                agentIds.add(session.agentId);
                agents.push({
                    name: session.agentId,
                    status: 'online',
                    model: session.model || 'unknown'
                });
            }
        });
    }

    // 提取 Cron Jobs 信息
    const cron = [];
    // OpenClaw status --json 可能不直接提供 cron，需要从其他地方获取
    // 暂时返回空数组，后续可以通过其他方式获取

    return {
        gateway,
        agents,
        cron,
        updatedAt: new Date().toISOString()
    };
}

/**
 * 获取 OpenClaw 状态（核心函数）
 */
async function fetchOpenClawStatus() {
    try {
        const { stdout } = await execAsync('openclaw status --json 2>&1', {
            timeout: 15000,
            maxBuffer: 2 * 1024 * 1024,
            shell: true
        });

        const openclawData = parseOpenClawOutput(stdout);
        const ergoData = transformToErgoFormat(openclawData);

        // 获取 Cron 数据（从 CLI 获取）
        try {
            const { stdout: cronStdout } = await execAsync('openclaw cron list --json 2>&1', {
                timeout: 10000,
                maxBuffer: 1024 * 1024,
                shell: true
            });

            // 解析 cron list 输出（格式：{ "jobs": [...] }）
            const cronJsonStart = cronStdout.indexOf('\n{');
            if (cronJsonStart !== -1) {
                const cronJsonStr = cronStdout.substring(cronJsonStart + 1);
                const cronData = JSON.parse(cronJsonStr);

                if (cronData.jobs && Array.isArray(cronData.jobs)) {
                    ergoData.cron = cronData.jobs.map(job => ({
                        id: job.id,
                        name: job.name,
                        schedule: job.schedule?.expr || '',
                        lastStatus: job.state?.lastStatus === 'ok' ? 'success' : 'failed',
                        nextRun: job.state?.nextRunAtMs,
                        lastRun: job.state?.lastRunAtMs
                    }));
                }
            }
        } catch (cronError) {
            console.warn('[WARN] Failed to fetch cron data:', cronError.message);
            // 继续返回，cron 为空数组
        }

        return ergoData;
    } catch (error) {
        console.error('[ERROR] OpenClaw status failed:', error.message);
        throw error;
    }
}

/**
 * 更新缓存
 */
async function updateCache() {
    try {
        console.log('[CACHE] Updating status cache...');
        statusCache = await fetchOpenClawStatus();
        lastUpdateTime = new Date();
        console.log(`[CACHE] Cache updated at ${lastUpdateTime.toISOString()}`);
    } catch (error) {
        console.error('[CACHE] Failed to update cache:', error.message);
        // 保留旧缓存
    }
}

/**
 * GET /api/status
 * 获取 Gateway 状态（返回缓存）
 */
app.get('/api/status', async (req, res) => {
    // 如果缓存存在且未过期，直接返回
    if (statusCache && lastUpdateTime) {
        const age = Date.now() - lastUpdateTime.getTime();
        const cacheAge = Math.floor(age / 1000); // 秒

        return res.json({
            ...statusCache,
            _meta: {
                cached: true,
                cacheAge,
                lastUpdate: lastUpdateTime.toISOString()
            }
        });
    }

    // 缓存不存在，立即获取
    try {
        const data = await fetchOpenClawStatus();
        statusCache = data;
        lastUpdateTime = new Date();

        res.json({
            ...data,
            _meta: {
                cached: false,
                cacheAge: 0,
                lastUpdate: lastUpdateTime.toISOString()
            }
        });
    } catch (error) {
        res.status(503).json({
            gateway: {
                status: 'offline',
                error: error.message.substring(0, 200)
            },
            agents: [],
            cron: [],
            updatedAt: new Date().toISOString(),
            _meta: {
                cached: false,
                error: true
            }
        });
    }
});

/**
 * GET /api/status/refresh
 * 强制刷新状态（不使用缓存）
 */
app.get('/api/status/refresh', async (req, res) => {
    try {
        console.log('[REFRESH] Manual refresh requested');
        const data = await fetchOpenClawStatus();

        // 更新缓存
        statusCache = data;
        lastUpdateTime = new Date();

        res.json({
            ...data,
            _meta: {
                cached: false,
                refreshed: true,
                lastUpdate: lastUpdateTime.toISOString()
            }
        });
    } catch (error) {
        // 即使刷新失败，也返回旧缓存（如果有）
        if (statusCache) {
            console.log('[REFRESH] Refresh failed, returning cached data');
            return res.json({
                ...statusCache,
                _meta: {
                    cached: true,
                    refreshFailed: true,
                    error: error.message.substring(0, 200),
                    lastUpdate: lastUpdateTime.toISOString()
                }
            });
        }

        res.status(503).json({
            gateway: {
                status: 'offline',
                error: error.message.substring(0, 200)
            },
            agents: [],
            cron: [],
            updatedAt: new Date().toISOString(),
            _meta: {
                cached: false,
                error: true
            }
        });
    }
});

/**
 * GET /health
 * 健康检查（无需认证）
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/health
 * API 健康检查（无需认证，用于前端快速检测）
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/cron
 * 获取 Cron 任务列表（从文件读取）
 */
app.get('/api/cron', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const path = require('path');

        // 读取 Gateway 状态文件
        const statusPath = path.join(__dirname, '../data/gateway-status.json');
        const data = await fs.readFile(statusPath, 'utf-8');
        const status = JSON.parse(data);

        res.json({
            cron: status.cron || [],
            updatedAt: status.updatedAt
        });
    } catch (error) {
        console.error('Error reading cron data:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/changelog
 * 获取更新日志（解析 CHANGELOG.md）
 */
app.get('/api/changelog', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const path = require('path');

        // 读取 CHANGELOG.md
        const changelogPath = path.join(__dirname, '../CHANGELOG.md');
        const content = await fs.readFile(changelogPath, 'utf-8');

        // 解析版本信息（简单提取 ## [vX.X.X] 格式）
        const versionRegex = /## \[(v[\d.]+)\] - ([\d-]+)([\s\S]*?)(?=## \[|## 开发中|## 版本号规则|$)/g;
        const versions = [];
        let match;

        while ((match = versionRegex.exec(content)) !== null) {
            const [, version, date, description] = match;

            // 提取特性列表
            const features = [];
            const featureRegex = /### (Added|Fixed|Changed|Improved|Technical)([\s\S]*?)(?=###|##|$)/g;
            let featureMatch;

            while ((featureMatch = featureRegex.exec(description)) !== null) {
                const [, category, items] = featureMatch;
                const itemList = items
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.replace(/^-\s*/, '').trim())
                    .filter(item => item.length > 0);

                if (itemList.length > 0) {
                    features.push({ category, items: itemList });
                }
            }

            versions.push({ version, date, features });
        }

        res.json({
            versions: versions.slice(0, 5), // 只返回最新 5 个版本
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error reading changelog:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/gateway/webui
 * 代理 OpenClaw Gateway WebUI（外网访问）
 */
app.get('/api/gateway/webui', (req, res) => {
    const token = req.query.token || '';
    const gatewayUrl = `http://localhost:18789?token=${token}`;

    console.log('[PROXY] Redirecting to Gateway WebUI:', gatewayUrl);

    // 重定向到 Gateway WebUI
    res.redirect(gatewayUrl);
});

/**
 * POST /api/gateway/restart
 * 重启 Gateway
 */
app.post('/api/gateway/restart', async (req, res) => {
    try {
        console.log('[API] Restarting Gateway...');

        // 执行重启命令
        await execAsync('openclaw gateway restart', { timeout: 10000 });

        res.json({
            success: true,
            message: 'Gateway restarting...',
            timestamp: new Date().toISOString()
        });

        // 广播重启事件
        broadcast('gateway-restarted', {
            message: 'Gateway is restarting',
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('[API] Error restarting Gateway:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/cron/:jobId/trigger
 * 触发 Cron 任务（v1.5）
 */
app.post('/api/cron/:jobId/trigger', async (req, res) => {
    try {
        const { jobId } = req.params;
        console.log(`[API] Triggering cron job: ${jobId}`);

        // 执行 OpenClaw 命令
        const { stdout } = await execAsync(`openclaw cron trigger ${jobId}`, {
            timeout: 30000
        });

        res.json({
            success: true,
            message: `Cron job "${jobId}" triggered successfully`,
            output: stdout,
            timestamp: new Date().toISOString()
        });

        // 广播任务触发事件
        broadcast('cron-triggered', {
            jobId,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('[API] Error triggering cron job:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// 项目管理 API（v1.4）
// =====================================================

/**
 * 读取项目列表
 */
async function readProjects() {
    try {
        const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // 文件不存在，返回空列表
            return { projects: [] };
        }
        throw error;
    }
}

/**
 * 获取单个项目数据
 */
async function getProjectData(projectId) {
    const projectsData = await readProjects();
    const project = projectsData.projects.find(p => p.id === projectId);

    if (!project) {
        throw new Error(`Project "${projectId}" not found`);
    }

    return project;
}

/**
 * 写入项目列表
 */
async function writeProjects(projectsData) {
    await fs.writeFile(PROJECTS_FILE, JSON.stringify(projectsData, null, 2), 'utf-8');
}

/**
 * 验证项目路径是否存在
 */
async function validateProjectPath(projectPath) {
    const fullPath = path.join(WORKSPACE_ROOT, projectPath);
    try {
        const stat = await fs.stat(fullPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

/**
 * 路径安全检查（防止路径遍历攻击）
 */
function sanitizePath(inputPath) {
    // 禁止路径遍历
    if (inputPath.includes('../') || inputPath.includes('..\\')) {
        throw new Error('Path traversal detected');
    }

    const normalized = path.normalize(inputPath);
    if (normalized.includes('..')) {
        throw new Error('Path traversal detected');
    }

    // 解析为绝对路径
    const resolvedPath = path.resolve(WORKSPACE_ROOT, normalized);

    // 必须在工作空间内
    if (!resolvedPath.startsWith(WORKSPACE_ROOT)) {
        throw new Error('Access denied: outside workspace');
    }

    return resolvedPath;
}

/**
 * 敏感文件黑名单（v1.6 安全增强）
 */
const PROTECTED_FILES = [
    '.env',
    '.env.local',
    '.env.production',
    'credentials.json',
    'api-keys.txt',
    'token.txt',
    'id_rsa',
    'id_ed25519',
    'id_dsa',
    '.ssh',
    '.pem',
    '.key',
    '.pfx',
    'secrets.yml',
    'secrets.yaml'
];

/**
 * 危险命令模式黑名单（v1.6 安全增强）
 */
const DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\/$/,                    // rm -rf /
    /rm\s+-rf\s+\*$/,                    // rm -rf *
    /sudo/i,                             // sudo 命令
    /:\(\)\{:\|:&\};:/,                  // fork bomb
    /shutdown/i,                         // 关机
    /reboot/i,                           // 重启
    /halt/i,                             // 停止系统
    /mkfs/i,                             // 格式化磁盘
    /dd\s+.*of=\/dev\//,                 // dd 写入设备
    /chmod\s+777\s+\//,                  // 递归修改根目录权限
    /chown\s+.*\/$/,                     // 修改根目录所有者
    /fdisk/i,                            // 磁盘分区
    /format\s+[A-Z]:/i,                  // Windows 格式化
    /del\s+\/[fqs]\s+[A-Z]:\\/i,         // Windows 批量删除
    />`echo.*>/,                         // IO重定向攻击
];

/**
 * 检查是否为受保护文件
 */
function isProtectedFile(filename) {
    const basename = path.basename(filename).toLowerCase();

    return PROTECTED_FILES.some(pattern => {
        if (pattern.startsWith('.') && !pattern.includes('*')) {
            // 精确匹配扩展名（如 .env, .pem）
            return basename === pattern || basename.endsWith(pattern);
        }
        if (pattern.includes('*')) {
            // 通配符匹配
            return new RegExp(pattern.replace('*', '.*')).test(basename);
        }
        // 精确匹配文件名
        return basename === pattern.toLowerCase();
    });
}

/**
 * 检查是否为危险命令
 */
function isDangerousCommand(cmd) {
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(cmd));
}

/**
 * 执行Shell命令（带安全控制）
 */
function execCommand(command, cwd, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');

        // Windows下使用 cmd.exe，Linux/Mac使用 bash
        const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
        const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

        const proc = spawn(shell, shellArgs, {
            cwd,
            timeout,
            env: { ...process.env }
        });

        let stdout = '';
        let stderr = '';
        const MAX_OUTPUT_SIZE = 500 * 1024; // 500KB

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
            // 限制输出大小
            if (stdout.length > MAX_OUTPUT_SIZE) {
                proc.kill();
                reject(new Error('Output too large (max 500KB)'));
            }
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            if (stderr.length > MAX_OUTPUT_SIZE) {
                proc.kill();
                reject(new Error('Error output too large (max 500KB)'));
            }
        });

        proc.on('close', (code) => {
            resolve({
                stdout: stdout.trimEnd(),
                stderr: stderr.trimEnd(),
                exitCode: code
            });
        });

        proc.on('error', (err) => {
            reject(err);
        });

        // 超时处理
        const timeoutId = setTimeout(() => {
            if (!proc.killed) {
                proc.kill();
                reject(new Error(`Command timeout after ${timeout}ms`));
            }
        }, timeout);

        proc.on('exit', () => {
            clearTimeout(timeoutId);
        });
    });
}

/**
 * 读取项目状态文件
 */
async function readProjectStatus(projectPath) {
    try {
        const sanitized = sanitizePath(projectPath);
        const statusPath = path.join(sanitized, 'project-status.json');

        const stat = await fs.stat(statusPath);
        const data = await fs.readFile(statusPath, 'utf-8');

        return {
            exists: true,
            path: statusPath,
            data: JSON.parse(data),
            lastModified: stat.mtime.toISOString()
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { exists: false };
        }
        throw error;
    }
}

/**
 * 计算项目健康度
 */
function calculateHealth(statusData) {
    if (!statusData || !statusData.health) {
        return null;
    }

    const health = statusData.health;

    // 服务健康度
    const servicesOk = health.services?.every(s => s.status === 'running') ?? true;
    const servicesRunning = health.services?.filter(s => s.status === 'running').length || 0;
    const servicesTotal = health.services?.length || 0;

    // 测试健康度
    const testsOk = health.tests ? (health.tests.failed === 0) : true;

    // 构建健康度
    const buildOk = health.build?.status === 'success' ?? true;

    // 综合评估
    let overall = 'healthy';
    if (!servicesOk || !buildOk) {
        overall = 'unhealthy';
    } else if (!testsOk) {
        overall = 'degraded';
    }

    return {
        overall,
        servicesRunning,
        servicesTotal,
        testsOk,
        buildOk
    };
}

/**
 * GET /api/projects
 * 获取项目列表（含健康状态）
 */
app.get('/api/projects', async (req, res) => {
    try {
        const projectsData = await readProjects();

        // 并行读取所有项目的状态文件
        const projectsWithStatus = await Promise.all(
            projectsData.projects.map(async (project) => {
                const statusFile = await readProjectStatus(project.path);

                const health = statusFile.exists
                    ? calculateHealth(statusFile.data)
                    : null;

                return { ...project, health };
            })
        );

        res.json({
            projects: projectsWithStatus,
            total: projectsWithStatus.length,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error fetching projects:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/projects
 * 创建项目
 */
app.post('/api/projects', async (req, res) => {
    try {
        const { id, name, path: projectPath, version } = req.body;

        // 验证必填字段
        if (!id || !name || !projectPath || !version) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['id', 'name', 'path', 'version']
            });
        }

        // 验证 ID 格式
        if (!/^[a-z0-9-]{3,50}$/.test(id)) {
            return res.status(400).json({
                error: 'Invalid project ID',
                message: 'ID must be 3-50 characters, lowercase letters, numbers, and hyphens only'
            });
        }

        // 验证版本格式
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
            return res.status(400).json({
                error: 'Invalid version',
                message: 'Version must be in semantic versioning format (e.g., 1.0.0)'
            });
        }

        // 路径安全检查
        try {
            sanitizePath(projectPath);
        } catch (error) {
            return res.status(400).json({
                error: 'Invalid path',
                message: error.message
            });
        }

        // 验证路径存在性
        const pathExists = await validateProjectPath(projectPath);
        if (!pathExists) {
            return res.status(400).json({
                error: 'Directory not found',
                message: `Path ${projectPath} does not exist in workspace`
            });
        }

        const projectsData = await readProjects();

        // 检查 ID 重复
        if (projectsData.projects.some(p => p.id === id)) {
            return res.status(400).json({
                error: 'Project ID already exists',
                message: `A project with ID "${id}" already exists`
            });
        }

        const newProject = {
            ...req.body,
            lastUpdate: new Date().toISOString().split('T')[0]
        };

        projectsData.projects.push(newProject);
        await writeProjects(projectsData);

        res.status(201).json({ success: true, project: newProject });
    } catch (error) {
        console.error('[API] Error creating project:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/projects/:id
 * 获取项目详情
 */
app.get('/api/projects/:id', async (req, res) => {
    try {
        const projectsData = await readProjects();
        const project = projectsData.projects.find(p => p.id === req.params.id);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const statusFile = await readProjectStatus(project.path);

        res.json({
            project: {
                ...project,
                statusFile
            }
        });
    } catch (error) {
        console.error('[API] Error fetching project:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/projects/:id
 * 更新项目
 */
app.put('/api/projects/:id', async (req, res) => {
    try {
        const projectsData = await readProjects();
        const index = projectsData.projects.findIndex(p => p.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // 部分更新
        projectsData.projects[index] = {
            ...projectsData.projects[index],
            ...req.body,
            id: projectsData.projects[index].id, // 不允许修改 ID
            lastUpdate: new Date().toISOString().split('T')[0]
        };

        await writeProjects(projectsData);

        res.json({
            success: true,
            project: projectsData.projects[index]
        });
    } catch (error) {
        console.error('[API] Error updating project:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/projects/:id
 * 删除项目（仅删除记录，不删除文件）
 */
app.delete('/api/projects/:id', async (req, res) => {
    try {
        const projectsData = await readProjects();
        const index = projectsData.projects.findIndex(p => p.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ error: 'Project not found' });
        }

        projectsData.projects.splice(index, 1);
        await writeProjects(projectsData);

        res.json({
            success: true,
            message: 'Project deleted successfully'
        });
    } catch (error) {
        console.error('[API] Error deleting project:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/projects/:id/status
 * 读取项目状态文件
 */
app.get('/api/projects/:id/status', async (req, res) => {
    try {
        const projectsData = await readProjects();
        const project = projectsData.projects.find(p => p.id === req.params.id);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const statusFile = await readProjectStatus(project.path);

        if (!statusFile.exists) {
            return res.status(404).json({
                error: 'Status file not found',
                message: 'project-status.json does not exist in project directory'
            });
        }

        res.json({
            status: statusFile.data,
            lastModified: statusFile.lastModified,
            path: statusFile.path
        });
    } catch (error) {
        console.error('[API] Error reading project status:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// 文件管理 API（v1.6）
// =====================================================

/**
 * PUT /api/files/update
 * 更新文件内容（v1.6）
 */
app.put('/api/files/update', async (req, res) => {
    try {
        const { path: userPath, content, createBackup = true } = req.body;

        // 验证必填参数
        if (!userPath || content === undefined) {
            return res.status(400).json({
                error: 'Missing parameters',
                message: 'Both path and content are required'
            });
        }

        // 路径安全检查
        let resolvedPath;
        try {
            resolvedPath = sanitizePath(userPath);
        } catch (error) {
            return res.status(400).json({
                error: 'Invalid path',
                message: error.message
            });
        }

        // 检查是否为受保护文件
        if (isProtectedFile(resolvedPath)) {
            return res.status(403).json({
                error: 'File protected',
                message: 'Cannot modify protected files',
                hint: 'Protected files: .env, credentials, SSH keys, etc.'
            });
        }

        // 内容大小限制（5MB）
        const MAX_CONTENT_SIZE = 5 * 1024 * 1024;
        if (Buffer.byteLength(content, 'utf-8') > MAX_CONTENT_SIZE) {
            return res.status(413).json({
                error: 'Content too large',
                message: `Content size exceeds limit (5MB)`
            });
        }

        // 创建备份
        let backupPath = null;
        if (createBackup) {
            try {
                // 检查文件是否存在
                await fs.access(resolvedPath);

                // 创建备份
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                backupPath = `${resolvedPath}.${timestamp}.bak`;
                await fs.copyFile(resolvedPath, backupPath);

                console.log(`[FILE] Backup created: ${backupPath}`);
            } catch (error) {
                // 文件不存在时不创建备份（新文件）
                if (error.code !== 'ENOENT') {
                    console.warn(`[FILE] Backup failed: ${error.message}`);
                }
            }
        }

        // 写入新内容
        await fs.writeFile(resolvedPath, content, 'utf-8');

        const stats = await fs.stat(resolvedPath);

        console.log(`[FILE] Updated: ${userPath} (${stats.size} bytes)`);

        res.json({
            success: true,
            path: path.relative(WORKSPACE_ROOT, resolvedPath).replace(/\\/g, '/'),
            backupPath: backupPath ? path.relative(WORKSPACE_ROOT, backupPath).replace(/\\/g, '/') : null,
            size: stats.size,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[FILE] Update error:', error);
        res.status(500).json({
            error: 'Failed to update file',
            message: error.message
        });
    }
});

/**
 * POST /api/files/upload
 * 上传文件（v1.6）
 */
app.post('/api/files/upload', async (req, res) => {
    try {
        const { path: userPath, filename, content } = req.body;

        // 验证必填参数
        if (!userPath || !filename || !content) {
            return res.status(400).json({
                error: 'Missing parameters',
                message: 'path, filename, and content are required'
            });
        }

        // 路径安全检查（目标目录）
        let resolvedDir;
        try {
            resolvedDir = sanitizePath(userPath);
        } catch (error) {
            return res.status(400).json({
                error: 'Invalid path',
                message: error.message
            });
        }

        // 检查目录是否存在
        try {
            const stats = await fs.stat(resolvedDir);
            if (!stats.isDirectory()) {
                return res.status(400).json({
                    error: 'Not a directory',
                    message: 'Target path must be a directory'
                });
            }
        } catch (error) {
            return res.status(404).json({
                error: 'Directory not found',
                message: `Directory "${userPath}" does not exist`
            });
        }

        // 文件名安全检查
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({
                error: 'Invalid filename',
                message: 'Filename cannot contain path separators'
            });
        }

        // 构造完整文件路径
        const filePath = path.join(resolvedDir, filename);

        // 检查文件是否已存在
        let fileExists = false;
        try {
            await fs.access(filePath);
            fileExists = true;
        } catch {
            // 文件不存在，可以创建
        }

        // Base64解码内容
        let fileContent;
        try {
            fileContent = Buffer.from(content, 'base64');
        } catch (error) {
            return res.status(400).json({
                error: 'Invalid content',
                message: 'Content must be base64 encoded'
            });
        }

        // 文件大小限制（10MB）
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (fileContent.length > MAX_FILE_SIZE) {
            return res.status(413).json({
                error: 'File too large',
                message: `File size exceeds limit (10MB)`,
                size: fileContent.length
            });
        }

        // 写入文件
        await fs.writeFile(filePath, fileContent);

        const stats = await fs.stat(filePath);

        console.log(`[FILE] Uploaded: ${filename} to ${userPath} (${stats.size} bytes)`);

        res.json({
            success: true,
            path: path.relative(WORKSPACE_ROOT, filePath).replace(/\\/g, '/'),
            filename,
            size: stats.size,
            overwritten: fileExists,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[FILE] Upload error:', error);
        res.status(500).json({
            error: 'Failed to upload file',
            message: error.message
        });
    }
});

/**
 * DELETE /api/files/delete
 * 删除文件（v1.6）
 */
app.delete('/api/files/delete', async (req, res) => {
    try {
        const { path: userPath, moveToTrash = true } = req.body;

        // 验证必填参数
        if (!userPath) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'Path is required'
            });
        }

        // 路径安全检查
        let resolvedPath;
        try {
            resolvedPath = sanitizePath(userPath);
        } catch (error) {
            return res.status(400).json({
                error: 'Invalid path',
                message: error.message
            });
        }

        // 检查文件是否存在
        try {
            await fs.access(resolvedPath);
        } catch (error) {
            return res.status(404).json({
                error: 'File not found',
                message: `File "${userPath}" does not exist`
            });
        }

        // 获取文件信息
        const stats = await fs.stat(resolvedPath);

        // 不允许删除目录
        if (stats.isDirectory()) {
            return res.status(400).json({
                error: 'Cannot delete directory',
                message: 'Use file manager to delete directories'
            });
        }

        let trashPath = null;

        if (moveToTrash) {
            // 移动到回收站
            const trashDir = path.join(WORKSPACE_ROOT, '.trash');

            // 确保回收站目录存在
            try {
                await fs.mkdir(trashDir, { recursive: true });
            } catch (error) {
                console.warn('[FILE] Failed to create trash directory:', error.message);
            }

            // 生成回收站文件名（带时间戳）
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = path.basename(resolvedPath);
            trashPath = path.join(trashDir, `${filename}.${timestamp}`);

            // 移动文件
            await fs.rename(resolvedPath, trashPath);

            console.log(`[FILE] Moved to trash: ${userPath} -> ${path.relative(WORKSPACE_ROOT, trashPath)}`);
        } else {
            // 永久删除
            await fs.unlink(resolvedPath);

            console.log(`[FILE] Permanently deleted: ${userPath}`);
        }

        res.json({
            success: true,
            path: userPath,
            trashPath: trashPath ? path.relative(WORKSPACE_ROOT, trashPath).replace(/\\/g, '/') : null,
            deleted: !moveToTrash,
            size: stats.size,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[FILE] Delete error:', error);
        res.status(500).json({
            error: 'Failed to delete file',
            message: error.message
        });
    }
});

/**
 * GET /api/files/browse
 * 浏览文件树（v1.6）
 */
app.get('/api/files/browse', async (req, res) => {
    try {
        const userPath = req.query.path || './';

        // 安全检查
        let resolvedPath;
        try {
            resolvedPath = sanitizePath(userPath);
        } catch (error) {
            return res.status(400).json({
                error: 'Invalid path',
                message: error.message
            });
        }

        // 检查路径是否存在
        try {
            const stats = await fs.stat(resolvedPath);
            if (!stats.isDirectory()) {
                return res.status(400).json({
                    error: 'Not a directory',
                    message: 'The specified path is not a directory'
                });
            }
        } catch (error) {
            return res.status(404).json({
                error: 'Directory not found',
                message: `Directory "${userPath}" does not exist`
            });
        }

        // 读取目录内容
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

        const files = await Promise.all(entries.map(async (entry) => {
            const fullPath = path.join(resolvedPath, entry.name);
            const relativePath = path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, '/');

            try {
                const stats = await fs.stat(fullPath);

                const fileInfo = {
                    name: entry.name,
                    path: relativePath,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: entry.isFile() ? stats.size : 0,
                    modifiedAt: stats.mtime.toISOString(),
                    protected: entry.isFile() ? isProtectedFile(entry.name) : false
                };

                // 如果是目录，统计子项数量
                if (entry.isDirectory()) {
                    try {
                        const children = await fs.readdir(fullPath);
                        fileInfo.children = children.length;
                    } catch {
                        fileInfo.children = 0;
                    }
                }

                return fileInfo;
            } catch (error) {
                // 如果读取失败（权限问题等），返回基础信息
                return {
                    name: entry.name,
                    path: relativePath,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    error: 'Permission denied'
                };
            }
        }));

        // 排序：目录优先，然后按名称
        files.sort((a, b) => {
            if (a.type === 'directory' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
        });

        res.json({
            path: path.relative(WORKSPACE_ROOT, resolvedPath).replace(/\\/g, '/') || '.',
            absolutePath: resolvedPath,
            files,
            total: files.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error browsing files:', error);
        res.status(500).json({
            error: 'Failed to browse files',
            message: error.message
        });
    }
});

/**
 * GET /api/files/read
 * 读取文件内容（v1.6）
 */
app.get('/api/files/read', async (req, res) => {
    try {
        const userPath = req.query.path;

        if (!userPath) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'Query parameter "path" is required'
            });
        }

        // 安全检查
        let resolvedPath;
        try {
            resolvedPath = sanitizePath(userPath);
        } catch (error) {
            return res.status(400).json({
                error: 'Invalid path',
                message: error.message
            });
        }

        // 检查文件是否存在
        let stats;
        try {
            stats = await fs.stat(resolvedPath);
        } catch (error) {
            return res.status(404).json({
                error: 'File not found',
                message: `File "${userPath}" does not exist`
            });
        }

        // 必须是文件
        if (!stats.isFile()) {
            return res.status(400).json({
                error: 'Not a file',
                message: 'The specified path is not a file'
            });
        }

        // 检查是否为受保护文件
        if (isProtectedFile(resolvedPath)) {
            return res.status(403).json({
                error: 'File protected',
                message: 'This file contains sensitive information and cannot be accessed',
                hint: 'Protected files: .env, credentials.json, SSH keys, etc.'
            });
        }

        // 文件大小限制（5MB）
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        if (stats.size > MAX_FILE_SIZE) {
            return res.status(400).json({
                error: 'File too large',
                message: `File size (${(stats.size / 1024 / 1024).toFixed(2)} MB) exceeds limit (5 MB)`,
                hint: 'Please use download instead'
            });
        }

        // 读取文件内容
        const content = await fs.readFile(resolvedPath, 'utf-8');
        const lines = content.split('\n').length;

        res.json({
            path: path.relative(WORKSPACE_ROOT, resolvedPath).replace(/\\/g, '/'),
            absolutePath: resolvedPath,
            content,
            size: stats.size,
            lines,
            encoding: 'utf-8',
            modifiedAt: stats.mtime.toISOString(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error reading file:', error);

        // 处理编码错误
        if (error.code === 'ERR_INVALID_ARG_TYPE' || error.message.includes('Invalid')) {
            return res.status(400).json({
                error: 'Cannot read file',
                message: 'File is not a text file or uses unsupported encoding',
                hint: 'Only UTF-8 encoded text files are supported'
            });
        }

        res.status(500).json({
            error: 'Failed to read file',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/tail
 * 读取日志文件尾部（v1.6）
 */
app.get('/api/logs/tail', async (req, res) => {
    try {
        const { project, logType = 'app', lines = 100 } = req.query;

        // 验证必填参数
        if (!project) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'Project ID is required'
            });
        }

        // 获取项目数据
        let projectData;
        try {
            projectData = await getProjectData(project);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: error.message
            });
        }

        // 读取项目状态文件获取日志路径
        const statusFile = await readProjectStatus(projectData.path);

        if (!statusFile.exists || !statusFile.data.logs) {
            return res.status(404).json({
                error: 'Log configuration not found',
                message: 'Project does not have log configuration in project-status.json'
            });
        }

        const logRelativePath = statusFile.data.logs?.[logType];

        if (!logRelativePath) {
            return res.status(404).json({
                error: 'Log type not found',
                message: `Log type "${logType}" is not configured for this project`,
                availableTypes: Object.keys(statusFile.data.logs || {})
            });
        }

        // 解析日志文件路径（相对于项目目录）
        const projectDir = sanitizePath(projectData.path);
        const logPath = path.join(projectDir, logRelativePath);

        // 验证日志文件路径安全性
        if (!logPath.startsWith(WORKSPACE_ROOT)) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Log file path is outside workspace'
            });
        }

        // 检查日志文件是否存在
        let stats;
        try {
            stats = await fs.stat(logPath);
        } catch (error) {
            return res.status(404).json({
                error: 'Log file not found',
                message: `Log file does not exist: ${logRelativePath}`
            });
        }

        // 行数限制（最大1000行）
        const safeLines = Math.min(parseInt(lines) || 100, 1000);

        // 读取文件尾部
        let logLines = [];
        try {
            const content = await fs.readFile(logPath, 'utf-8');
            const allLines = content.split('\n');
            logLines = allLines.slice(-safeLines).filter(line => line.trim());
        } catch (error) {
            return res.status(500).json({
                error: 'Failed to read log file',
                message: error.message
            });
        }

        // 计算总行数
        const content = await fs.readFile(logPath, 'utf-8');
        const totalLines = content.split('\n').length;

        res.json({
            project,
            logType,
            logPath: logRelativePath,
            lines: logLines,
            totalLines,
            requestedLines: safeLines,
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[LOGS] Error reading log:', error);
        res.status(500).json({
            error: 'Failed to read log',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/download
 * 下载完整日志文件（v1.6）
 */
app.get('/api/logs/download', async (req, res) => {
    try {
        const { project, logType = 'app' } = req.query;

        // 验证必填参数
        if (!project) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'Project ID is required'
            });
        }

        // 获取项目数据
        let projectData;
        try {
            projectData = await getProjectData(project);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: error.message
            });
        }

        // 读取项目状态文件获取日志路径
        const statusFile = await readProjectStatus(projectData.path);

        if (!statusFile.exists || !statusFile.data.logs) {
            return res.status(404).json({
                error: 'Log configuration not found',
                message: 'Project does not have log configuration'
            });
        }

        const logRelativePath = statusFile.data.logs?.[logType];

        if (!logRelativePath) {
            return res.status(404).json({
                error: 'Log type not found',
                message: `Log type "${logType}" is not configured`
            });
        }

        // 解析日志文件路径
        const projectDir = sanitizePath(projectData.path);
        const logPath = path.join(projectDir, logRelativePath);

        // 安全检查
        if (!logPath.startsWith(WORKSPACE_ROOT)) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Log file path is outside workspace'
            });
        }

        // 检查文件是否存在
        try {
            await fs.stat(logPath);
        } catch (error) {
            return res.status(404).json({
                error: 'Log file not found',
                message: `Log file does not exist: ${logRelativePath}`
            });
        }

        // 设置下载响应头
        const filename = path.basename(logPath);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        // 流式传输文件
        const stream = require('fs').createReadStream(logPath);
        stream.pipe(res);

        stream.on('error', (error) => {
            console.error('[LOGS] Download error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Download failed',
                    message: error.message
                });
            }
        });

    } catch (error) {
        console.error('[LOGS] Download error:', error);
        res.status(500).json({
            error: 'Failed to download log',
            message: error.message
        });
    }
});

/**
 * POST /api/command/exec
 * 执行Shell命令（v1.6）
 */
app.post('/api/command/exec', async (req, res) => {
    try {
        const { command, cwd = './', timeout = 30000, project } = req.body;

        // 验证必填参数
        if (!command) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'Command is required'
            });
        }

        // 危险命令检查
        if (isDangerousCommand(command)) {
            console.warn(`[SECURITY] Dangerous command blocked: ${command}`);
            return res.status(403).json({
                error: 'Dangerous command blocked',
                message: '此命令可能造成系统损坏，已被安全策略拦截',
                command,
                hint: '如需执行此类命令，请直接登录服务器操作'
            });
        }

        // 路径安全检查
        let resolvedCwd;
        try {
            resolvedCwd = sanitizePath(cwd);
        } catch (error) {
            return res.status(400).json({
                error: 'Invalid working directory',
                message: error.message
            });
        }

        // 检查工作目录是否存在
        try {
            const stats = await fs.stat(resolvedCwd);
            if (!stats.isDirectory()) {
                return res.status(400).json({
                    error: 'Not a directory',
                    message: `The specified path "${cwd}" is not a directory`
                });
            }
        } catch (error) {
            return res.status(404).json({
                error: 'Directory not found',
                message: `Working directory "${cwd}" does not exist`
            });
        }

        // 超时限制（最大5分钟）
        const safeTimeout = Math.min(timeout, 5 * 60 * 1000);

        console.log(`[COMMAND] Executing: ${command} (cwd: ${cwd}, timeout: ${safeTimeout}ms)`);

        const startTime = Date.now();
        const result = await execCommand(command, resolvedCwd, safeTimeout);
        const duration = Date.now() - startTime;

        console.log(`[COMMAND] Completed in ${duration}ms, exit code: ${result.exitCode}`);

        res.json({
            success: result.exitCode === 0,
            command,
            stdout: result.stdout,      // 标准输出
            output: result.stdout,      // 兼容旧字段名
            stderr: result.stderr,
            exitCode: result.exitCode,
            executionTime: duration,    // 执行时间（毫秒）
            duration,                   // 兼容旧字段名
            cwd,
            timestamp: new Date().toISOString()
        });

        // TODO: 记录审计日志（v1.6 P1）
        // await logAudit('command_exec', { command, cwd, exitCode: result.exitCode });

    } catch (error) {
        console.error('[COMMAND] Execution error:', error);

        // 超时错误
        if (error.message.includes('timeout')) {
            return res.status(408).json({
                error: 'Command timeout',
                message: error.message,
                command: req.body.command
            });
        }

        // 输出过大错误
        if (error.message.includes('too large')) {
            return res.status(413).json({
                error: 'Output too large',
                message: error.message,
                hint: 'Consider using tail or head to limit output'
            });
        }

        res.status(500).json({
            error: 'Command execution failed',
            message: error.message
        });
    }
});

// =====================================================
// WebSocket 实时连接（v1.5）
// =====================================================

// 创建 WebSocket Server（与 HTTP Server 共享端口）
const wss = new WebSocket.Server({ noServer: true });

// 客户端连接管理
const wsClients = new Set();

// WebSocket 连接处理
wss.on('connection', (ws, req) => {
    console.log('[WebSocket] New client connected');
    wsClients.add(ws);

    // 发送欢迎消息
    ws.send(JSON.stringify({
        type: 'connected',
        payload: {
            message: 'Welcome to Ergo Realtime Service',
            version: '1.5.0',
            timestamp: Date.now()
        }
    }));

    // 定期发送心跳（30 秒）
    const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'heartbeat',
                payload: { time: Date.now() }
            }));
        }
    }, 30000);

    // 接收客户端消息
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleClientMessage(ws, data);
        } catch (error) {
            console.error('[WebSocket] Invalid message:', error.message);
        }
    });

    // 客户端断开连接
    ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        wsClients.delete(ws);
        clearInterval(heartbeat);
    });

    ws.on('error', (error) => {
        console.error('[WebSocket] Connection error:', error.message);
    });
});

// 处理客户端消息
function handleClientMessage(ws, data) {
    console.log('[WebSocket] Received message:', data.type);

    switch (data.type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong', payload: { time: Date.now() } }));
            break;

        case 'subscribe':
            // 客户端订阅（预留接口）
            ws.send(JSON.stringify({
                type: 'subscribed',
                payload: { channels: data.payload?.channels || [] }
            }));
            break;

        default:
            console.warn('[WebSocket] Unknown message type:', data.type);
    }
}

// 广播消息给所有客户端
function broadcast(type, payload) {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    let sent = 0;

    wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sent++;
        }
    });

    if (sent > 0) {
        console.log(`[WebSocket] Broadcast "${type}" to ${sent} client(s)`);
    }
}

// 文件监听：监控所有项目的 project-status.json
const watcher = chokidar.watch(`${WORKSPACE_ROOT}/*/project-status.json`, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 500,  // 防抖 500ms
        pollInterval: 100
    }
});

watcher.on('change', async (filePath) => {
    console.log('[Watcher] Project status changed:', filePath);

    try {
        // 读取更新后的状态
        const statusData = await fs.readFile(filePath, 'utf-8');
        const status = JSON.parse(statusData);

        // 提取项目 ID（从路径中）
        const pathParts = filePath.split(path.sep);
        const projectDir = pathParts[pathParts.length - 2];

        // 读取项目列表，匹配项目 ID
        const projectsData = await readProjects();
        const project = projectsData.projects.find(p =>
            p.path.replace('./', '').replace(/\\/g, '/') === projectDir
        );

        const projectId = project?.id || projectDir;

        // 计算健康度
        const health = calculateHealth(status);

        // 广播更新
        broadcast('project-status-update', {
            projectId,
            projectName: status.basic?.name || projectId,
            status,
            health,
            path: filePath
        });
    } catch (error) {
        console.error('[Watcher] Error processing status change:', error.message);
    }
});

watcher.on('error', (error) => {
    console.error('[Watcher] File watcher error:', error.message);
});

// 定期推送 Gateway 状态（每 10 秒）
setInterval(async () => {
    if (wsClients.size === 0) return; // 无客户端时跳过

    try {
        const gatewayStatus = statusCache || await fetchOpenClawStatus();
        broadcast('gateway-status-update', gatewayStatus);
    } catch (error) {
        console.error('[Broadcast] Failed to fetch gateway status:', error.message);
        broadcast('gateway-status-update', {
            gateway: { status: 'offline', error: error.message },
            agents: [],
            cron: []
        });
    }
}, 10000);

// 启动服务器
const server = app.listen(PORT, async () => {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   Ergo API Bridge Server v1.5             ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   HTTP Port: ${PORT}                          ║`);
    console.log(`║   WebSocket: ws://localhost:${PORT}           ║`);
    console.log(`║   Status: http://localhost:${PORT}/api/status  ║`);
    console.log(`║   Refresh: http://localhost:${PORT}/api/status/refresh ║`);
    console.log(`║   Health: http://localhost:${PORT}/health      ║`);
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   Cache: Auto-update every ${CACHE_DURATION / 60000} minutes   ║`);
    console.log(`║   Auth: ${AUTH_ENABLED ? 'Enabled ✓' : 'Disabled'}            ║`);
    if (AUTH_ENABLED) {
        console.log(`║   Secret: ${ERGO_SECRET.substring(0, 8)}...              ║`);
    }
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    if (AUTH_ENABLED) {
        console.log('🔐 认证已启用 - 前端需要提供 X-Ergo-Key');
        console.log(`   密钥: ${ERGO_SECRET}`);
        console.log('   提示: 设置环境变量 ERGO_SECRET 自定义密钥');
        console.log('');
    }
    console.log('🔄 WebSocket Server:');
    console.log(`   - 实时状态推送: 每 10 秒`);
    console.log(`   - 文件监听: ${WORKSPACE_ROOT}/*/project-status.json`);
    console.log(`   - 心跳间隔: 30 秒`);
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');

    // 启动时立即更新缓存
    console.log('[INIT] Initial cache update...');
    await updateCache();

    // 设置定时更新（每 5 分钟）
    setInterval(updateCache, CACHE_DURATION);
    console.log(`[INIT] Auto-update scheduled every ${CACHE_DURATION / 60000} minutes`);
    console.log('[INIT] File watcher started');
});

// 升级 HTTP 连接为 WebSocket
server.on('upgrade', (request, socket, head) => {
    console.log('[WebSocket] Upgrade request received');

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});
