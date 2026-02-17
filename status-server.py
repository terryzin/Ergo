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
    """通过CLI获取Gateway状态"""
    try:
        result = subprocess.run(
            ['powershell', '-Command', 'openclaw gateway status'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        output = result.stdout
        # 解析输出
        status = {
            'gateway': {
                'status': 'online' if 'RPC probe: ok' in output or 'Listening' in output else 'offline',
                'version': '2026.2.9',
                'port': 18789,
                'lastUpdate': None
            },
            'agents': [],
            'cron': [],
            'updatedAt': None
        }
        
        # 提取运行时间
        if 'Runtime:' in output:
            for line in output.split('\n'):
                if 'Runtime:' in line:
                    status['gateway']['runtime'] = line.split('Runtime:')[1].strip()
        
        return status
        
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
        
        if parsed.path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            status = get_gateway_status()
            status['updatedAt'] = json.dumps({'$date': {'$numberLong': str(int(__import__('time').time() * 1000)}})
            
            self.wfile.write(json.dumps(status).encode())
            
        elif parsed.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        print(f"[ErgoServer] {format % args}")

def main():
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f"🚀 Ergo Gateway Status Server running on http://localhost:{PORT}")
    print(f"   API: http://localhost:{PORT}/api/status")
    print(f"   Health: http://localhost:{PORT}/health")
    server.serve_forever()

if __name__ == '__main__':
    main()
