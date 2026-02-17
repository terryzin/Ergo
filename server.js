const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const DASHBOARD_DIR = __dirname;

function checkPort(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.on('error', () => { resolve(false); });
        socket.connect(port, host);
    });
}

async function getGatewayStatus() {
    const isOnline = await checkPort('127.0.0.1', 18789);
    
    return {
        gateway: {
            status: isOnline ? 'online' : 'offline',
            version: '2026.2.9',
            port: 18789
        },
        agents: [
            { name: 'main', status: isOnline ? 'online' : 'offline', model: 'MiniMax-M2.5' }
        ],
        cron: [
            { id: '1', name: 'Best Practice Collector', lastStatus: 'success' },
            { id: '2', name: 'Gateway Health Check', lastStatus: 'success' },
            { id: '3', name: 'Weekly Review', lastStatus: 'success' }
        ],
        updatedAt: Date.now()
    };
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API endpoints
    if (url.pathname === '/api/status') {
        const status = await getGatewayStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
        return;
    }
    
    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }
    
    // 静态文件服务
    let filePath = path.join(DASHBOARD_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    
    // 安全检查
    if (!filePath.startsWith(DASHBOARD_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    const ext = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ergo Dashboard running on http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/status`);
});
