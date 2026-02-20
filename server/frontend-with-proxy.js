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
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;
const API_BRIDGE_URL = process.env.API_BRIDGE_URL || 'http://localhost:8082';

// API 代理中间件
// 注意：app.use('/api', ...) 会自动strip /api 前缀，所以需要用 pathRewrite 加回来
app.use('/api', createProxyMiddleware({
    target: API_BRIDGE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => {
        // 将 /status 重写为 /api/status
        return '/api' + path;
    },
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
        const targetUrl = `${API_BRIDGE_URL}/api${req.url}`;
        console.log(`[PROXY] ${req.method} ${req.originalUrl} → ${targetUrl}`);
    },
    onError: (err, req, res) => {
        console.error('[PROXY ERROR]', err.message);
        res.status(502).json({
            error: 'API Bridge unavailable',
            message: 'Please ensure API Bridge is running on port 8082'
        });
    }
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, '..')));

// 404 处理
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   Ergo Frontend + API Proxy               ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   Port: ${PORT}                              ║`);
    console.log(`║   Frontend: http://localhost:${PORT}          ║`);
    console.log(`║   API Proxy: ${API_BRIDGE_URL}  ║`);
    console.log('╠════════════════════════════════════════════╣');
    console.log('║   /api/* → Proxy to API Bridge            ║');
    console.log('║   /*     → Static files                   ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log('Public access: https://terryzin.cpolar.top');
    console.log('');
});
