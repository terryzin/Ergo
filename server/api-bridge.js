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

// 启用 CORS（允许 Ergo 前端跨域访问）
app.use(cors());
app.use(express.json());

// 日志中间件
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

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
    // 提取 Gateway 信息
    const gateway = {
        status: 'online',
        version: openclawData.versions?.openclaw || '2026.2',
        uptime: openclawData.gateway?.uptimeMs || 0,
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
 * GET /api/status
 * 获取 Gateway 整体状态
 */
app.get('/api/status', async (req, res) => {
    try {
        // 执行 OpenClaw CLI 命令（增加超时时间）
        const { stdout, stderr } = await execAsync('openclaw status --json 2>&1', {
            timeout: 15000,  // 15秒超时
            maxBuffer: 2 * 1024 * 1024, // 2MB
            shell: true
        });

        // 解析输出（stdout 和 stderr 混合）
        const openclawData = parseOpenClawOutput(stdout);

        // 转换为 Ergo 格式
        const ergoData = transformToErgoFormat(openclawData);

        res.json(ergoData);
    } catch (error) {
        console.error('[ERROR] OpenClaw status failed:', error.message);

        // 返回离线状态
        res.status(503).json({
            gateway: {
                status: 'offline',
                error: error.message.substring(0, 200) // 限制错误信息长度
            },
            agents: [],
            cron: [],
            updatedAt: new Date().toISOString()
        });
    }
});

/**
 * GET /health
 * 健康检查
 */
app.get('/health', (req, res) => {
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
app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   Ergo API Bridge Server                  ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   Port: ${PORT}                              ║`);
    console.log(`║   Status: http://localhost:${PORT}/api/status  ║`);
    console.log(`║   Health: http://localhost:${PORT}/health      ║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log('Press Ctrl+C to stop');
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
