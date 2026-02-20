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
const PORT = process.env.PORT || 8082;

// 工作空间路径配置
const WORKSPACE_ROOT = 'D:\\.openclaw\\workspace';
const PROJECTS_FILE = path.join(__dirname, '../data/projects.json');

// 认证配置
const ERGO_SECRET = process.env.ERGO_SECRET || 'ergo-default-secret-key-2026';
const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false'; // 默认启用认证

// 启用 CORS（允许 Ergo 前端跨域访问）
app.use(cors());
app.use(express.json());

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

// 认证中间件
function authMiddleware(req, res, next) {
    // 如果认证被禁用，直接放行
    if (!AUTH_ENABLED) {
        return next();
    }

    // 健康检查端点不需要认证
    if (req.path === '/health' || req.path === '/api/health') {
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
    const normalized = path.normalize(inputPath);
    if (normalized.includes('..')) {
        throw new Error('Path traversal detected');
    }
    return normalized;
}

/**
 * 读取项目状态文件
 */
async function readProjectStatus(projectPath) {
    try {
        const sanitized = sanitizePath(projectPath);
        const statusPath = path.join(WORKSPACE_ROOT, sanitized, 'project-status.json');

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
