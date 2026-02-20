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

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8082;

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
        console.log('Restarting Gateway...');

        // 执行重启命令
        await execAsync('openclaw gateway restart', { timeout: 10000 });

        res.json({
            success: true,
            message: 'Gateway restarting...',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error restarting Gateway:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 启动服务器
app.listen(PORT, async () => {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   Ergo API Bridge Server                  ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   Port: ${PORT}                              ║`);
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
    console.log('Press Ctrl+C to stop');
    console.log('');

    // 启动时立即更新缓存
    console.log('[INIT] Initial cache update...');
    await updateCache();

    // 设置定时更新（每 5 分钟）
    setInterval(updateCache, CACHE_DURATION);
    console.log(`[INIT] Auto-update scheduled every ${CACHE_DURATION / 60000} minutes`);
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
