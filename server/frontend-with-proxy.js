#!/usr/bin/env node
/**
 * Ergo 前端服务器 + API 代理
 *
 * 功能：
 * - 提供静态文件服务（端口 8081）
 * - 代理 /api/* 请求到 API Bridge (localhost:8082)
 * - 解决外部网络访问 localhost 的问题
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createProxyServer } = require('http-proxy');
const path = require('path');

const app = express();

// ============================
// 环境变量配置（Convention over Configuration）
// ============================
const PORT = process.env.PORT || 8081;
const API_BRIDGE_PORT = process.env.API_BRIDGE_PORT || 8082;
const API_BRIDGE_URL = process.env.API_BRIDGE_URL || `http://localhost:${API_BRIDGE_PORT}`;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// API 代理中间件（支持 HTTP 和 WebSocket）
// 注意：app.use('/api', ...) 会自动strip /api 前缀，所以需要用 pathRewrite 加回来
const apiProxy = createProxyMiddleware({
    target: API_BRIDGE_URL,
    changeOrigin: true,
    ws: true, // 启用 WebSocket 代理
    pathRewrite: (path, req) => {
        // 将 /status 重写为 /api/status
        return '/api' + path;
    },
    logLevel: LOG_LEVEL === 'debug' ? 'debug' : 'warn',
    onProxyReq: (proxyReq, req, res) => {
        const targetUrl = `${API_BRIDGE_URL}/api${req.url}`;
        console.log(`[PROXY] ${req.method} ${req.originalUrl} → ${targetUrl}`);
    },
    onError: (err, req, res) => {
        console.error('[PROXY ERROR]', err.message);
        if (res && !res.headersSent) {
            res.status(502).json({
                error: 'API Bridge unavailable',
                message: 'Please ensure API Bridge is running on port 8082'
            });
        }
    }
});

app.use('/api', apiProxy);

// 缓存控制中间件（对 HTML 文件禁用缓存）
app.use((req, res, next) => {
    // 匹配 .html 文件或根路径 / （返回 index.html）
    if (req.path.endsWith('.html') || req.path === '/') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '..')));

// 404 处理
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', 'index.html'));
});

const server = app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   Ergo Frontend + API Proxy               ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   Port: ${PORT}                              ║`);
    console.log(`║   Frontend: http://localhost:${PORT}          ║`);
    console.log(`║   API Proxy: ${API_BRIDGE_URL}  ║`);
    console.log('╠════════════════════════════════════════════╣');
    console.log('║   /api/* → Proxy to API Bridge            ║');
    console.log('║   WebSocket: Proxy enabled                ║');
    console.log('║   /*     → Static files                   ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log('Public access: https://terryzin.cpolar.top');
    console.log('');
});

// WebSocket 专用代理（使用原生 http-proxy）
const wsProxy = createProxyServer({
    target: API_BRIDGE_URL,
    ws: true
});

wsProxy.on('error', (err, req, socket) => {
    console.error('[WebSocket PROXY ERROR]', err.message);
    socket.end();
});

wsProxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
    console.log(`[WebSocket PROXY] ${req.url} → ${API_BRIDGE_URL}${req.url}`);
});

// 绑定 WebSocket 升级事件
server.on('upgrade', (req, socket, head) => {
    console.log('[WebSocket] Upgrade request:', req.url);

    // 使用原生 http-proxy 处理 WebSocket 升级
    wsProxy.ws(req, socket, head);
});
