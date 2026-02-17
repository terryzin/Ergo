const http = require('http');
const net = require('net');

const PORT = 8082;

function checkPort(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            resolve(false);
        });
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
            { id: '1', name: '最佳实践收集', lastStatus: 'success' },
            { id: '2', name: 'Gateway健康检查', lastStatus: 'success' },
            { id: '3', name: '稳定性复盘', lastStatus: 'success' }
        ],
        updatedAt: Date.now()
    };
}

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    if (url.pathname === '/api/status') {
        const status = await getGatewayStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
    } else if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ergo Status Server running on http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/status`);
});
