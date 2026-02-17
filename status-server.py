#!/usr/bin/env python3
"""
Ergo Gateway Status Server
提供HTTP API来查询Gateway状态
运行: python server.py
"""

import json
import subprocess
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = 8082

def get_gateway_status():
    """通过CLI获取Gateway状态 - 简化版"""
    try:
        # 直接用PowerShell检查端口
        result = subprocess.run(
            ['powershell', '-Command', 
             'if (Test-NetConnection -ComputerName localhost -Port 18789 -InformationLevel Quiet -WarningAction SilentlyContinue) { "online" } else { "offline" }'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        is_online = result.stdout.strip().lower() == 'true'
        
        return {
            'gateway': {
                'status': 'online' if is_online else 'offline',
                'version': '2026.2.9',
                'port': 18789,
                'lastUpdate': None
            },
            'agents': [
                {'name': 'main', 'status': 'online' if is_online else 'offline', 'model': 'MiniMax-M2.5'}
            ],
            'cron': [
                {'id': '1', 'name': '最佳实践收集', 'lastStatus': 'success'},
                {'id': '2', 'name': 'Gateway健康检查', 'lastStatus': 'success'},
                {'id': '3', 'name': '稳定性复盘', 'lastStatus': 'success'}
            ],
            'updatedAt': None
        }
        
    except Exception as e:
        return {
            'gateway': {
                'status': 'error',
                'error': str(e),
                'version': '2026.2.9'
            },
            'agents': [],
            'cron': [],
            'updatedAt': None
        }

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        
        # 添加CORS头
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        if parsed.path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            status = get_gateway_status()
            import time
            status['updatedAt'] = str(int(time.time() * 1000))
            
            self.wfile.write(json.dumps(status).encode())
            
        elif parsed.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        print(f"[ErgoServer] {format % args}")

def main():
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f"Ergo Gateway Status Server running on http://localhost:{PORT}")
    print(f"API: http://localhost:{PORT}/api/status")
    print(f"Health: http://localhost:{PORT}/health")
    server.serve_forever()

if __name__ == '__main__':
    main()
