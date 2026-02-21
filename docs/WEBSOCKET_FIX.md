# WebSocket 连接问题修复说明

## 问题描述

用户从公网访问 `https://terryzin.cpolar.cn` 时，WebSocket 连接失败：

```javascript
[v1.5] Initializing WebSocket: wss://terryzin.cpolar.cn
[Realtime] Connecting to wss://terryzin.cpolar.cn
WebSocket connection to 'wss://terryzin.cpolar.cn/' failed
[Realtime] Disconnected 1006
```

**错误代码 1006**：异常关闭（Abnormal Closure），表示连接在未完成握手前被关闭。

---

## 根本原因分析

### 1. 认证中间件拦截

**API Bridge** (`server/api-bridge.js`) 的认证中间件会拦截**所有** HTTP 请求：

```javascript
function authMiddleware(req, res, next) {
    if (!AUTH_ENABLED) return next();

    // ❌ 健康检查豁免，但没有 WebSocket 豁免
    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }

    const apiKey = req.headers['x-ergo-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'Missing API key' }); // ← WebSocket 升级请求在这里被拒
    }
    // ...
}
```

### 2. WebSocket 握手流程

WebSocket 连接的建立过程：

```
1. 客户端发送 HTTP GET 请求（带 Upgrade 头）
   GET / HTTP/1.1
   Upgrade: websocket
   Connection: Upgrade
   Sec-WebSocket-Key: ...

2. 中间件处理（❌ 这里被认证拦截！）
   → authMiddleware 检查 X-Ergo-Key
   → 未找到密钥 → 返回 401 Unauthorized

3. ❌ 请求被拒绝，无法到达 server.on('upgrade')
4. ❌ 客户端收到 401，连接关闭（错误代码 1006）
```

### 3. 代理路径重写问题

**Frontend Proxy** (`server/frontend-with-proxy.js`) 使用 `http-proxy-middleware`，配置了 `pathRewrite`：

```javascript
const apiProxy = createProxyMiddleware({
    target: 'http://localhost:8082',
    pathRewrite: (path, req) => '/api' + path, // ❌ WebSocket 不需要重写
    ws: true
});
```

**问题**：WebSocket 升级请求路径 `/` 被重写为 `/api/`，但 API Bridge 的 WebSocket Server 监听的是根路径 `/`，导致路径不匹配。

---

## 解决方案

### 修复 1：API Bridge 认证豁免

**文件**：`server/api-bridge.js` (line 49)

```javascript
function authMiddleware(req, res, next) {
    if (!AUTH_ENABLED) {
        return next();
    }

    // ✅ WebSocket 升级请求豁免认证
    if (req.headers.upgrade === 'websocket') {
        return next();
    }

    // 健康检查端点不需要认证
    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }

    const apiKey = req.headers['x-ergo-key'];
    // ... 正常认证逻辑
}
```

**原理**：
- WebSocket 升级请求在 HTTP 头中包含 `Upgrade: websocket`
- 检测到此头后直接放行，允许请求到达 `server.on('upgrade')`
- WebSocket 连接建立后，可通过消息协议进行应用层认证（如需）

---

### 修复 2：前端代理使用原生 http-proxy

**文件**：`server/frontend-with-proxy.js`

**修改前**（使用 http-proxy-middleware）：
```javascript
const apiProxy = createProxyMiddleware({
    pathRewrite: (path) => '/api' + path, // ❌ 干扰 WebSocket
    ws: true
});

server.on('upgrade', (req, socket, head) => {
    apiProxy.upgrade(req, socket, head); // ❌ 路径被错误重写
});
```

**修改后**（使用原生 http-proxy）：
```javascript
const { createProxyServer } = require('http-proxy');

// ✅ WebSocket 专用代理（不重写路径）
const wsProxy = createProxyServer({
    target: 'http://localhost:8082',
    ws: true
});

wsProxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
    console.log(`[WebSocket PROXY] ${req.url} → http://localhost:8082${req.url}`);
});

server.on('upgrade', (req, socket, head) => {
    console.log('[WebSocket] Upgrade request:', req.url);
    wsProxy.ws(req, socket, head); // ✅ 直接转发，不修改路径
});
```

**优势**：
- 原生 `http-proxy` 不会干扰 WebSocket 路径
- 独立的 `wsProxy` 与 HTTP API 代理分离
- 日志清晰，便于调试

---

## 测试验证

### 本地测试

#### 1. 直接连接 API Bridge
```bash
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8082/');
ws.on('message', (data) => { console.log('✅', data.toString()); });
"
```

**预期输出**：
```json
✅ {"type":"connected","payload":{"message":"Welcome to Ergo Realtime Service", "version":"1.5.0"}}
```

#### 2. 通过前端代理连接
```bash
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8081/');
ws.on('message', (data) => { console.log('✅', data.toString()); });
"
```

**预期输出**：相同的欢迎消息（证明代理工作正常）。

---

### 公网测试（Cpolar）

**URL**: `wss://terryzin.cpolar.cn/`

**浏览器测试**：
1. 打开开发者工具（F12）
2. 访问 `https://terryzin.cpolar.cn/`
3. 在 Console 查看 WebSocket 日志

**预期日志**：
```
[v1.5] Initializing WebSocket: wss://terryzin.cpolar.cn
[Realtime] Connecting to wss://terryzin.cpolar.cn
[Realtime] Connected ✅
```

**如果仍失败**：
可能原因是 **Cpolar Free/Basic 版不支持 WebSocket**，需要升级到 Pro 版或使用其他隧道服务（如 ngrok）。

---

## Cpolar WebSocket 支持

### 检查 Cpolar 配置

查看 Cpolar 配置文件（通常在 `%USERPROFILE%\.cpolar\cpolar.yml`）：

```yaml
tunnels:
  ergo-dashboard:
    proto: http  # ⚠️ 需要支持 WebSocket
    addr: 8081
    # 添加以下配置（Pro 版本）
    inspect: true
    bind_tls: true
```

### Cpolar Pro 版 WebSocket 配置

如果使用 Cpolar Pro，添加以下配置启用 WebSocket：

```yaml
tunnels:
  ergo-dashboard:
    proto: http
    addr: 8081
    bind_tls: true
    websocket_compression: true  # 启用 WebSocket 压缩
    inspect: false              # 禁用检查器以减少延迟
```

### 替代方案：Ngrok

如果 Cpolar 不支持 WebSocket，可使用 Ngrok：

```bash
ngrok http 8081
```

Ngrok 免费版支持 WebSocket，生成的 URL 格式：`https://xxxx.ngrok.io`

---

## 技术细节

### WebSocket vs HTTP 认证

| 特性 | HTTP API | WebSocket |
|------|----------|-----------|
| 认证时机 | 每个请求 | 连接建立时（可选） |
| 认证方式 | Header (`X-Ergo-Key`) | 消息协议或查询参数 |
| 状态 | 无状态 | 有状态（持久连接） |
| 中间件 | Express 中间件 | `server.on('upgrade')` |

**为什么豁免 WebSocket 认证**：
1. WebSocket 是有状态连接，无法在每个消息上验证 HTTP Header
2. 升级请求是一次性的 HTTP GET，之后变为双向流
3. 应用层认证应在连接后通过消息协议实现

**示例：消息级认证（可选实现）**：
```javascript
// 服务器端
wss.on('connection', (ws, req) => {
    let authenticated = false;

    ws.on('message', (data) => {
        const msg = JSON.parse(data);

        if (!authenticated) {
            if (msg.type === 'auth' && msg.apiKey === 'secret') {
                authenticated = true;
                ws.send(JSON.stringify({ type: 'auth_success' }));
            } else {
                ws.close(1008, 'Unauthorized'); // 关闭连接
            }
        } else {
            // 处理正常消息
        }
    });
});
```

---

## 故障排查

### 问题：公网 WebSocket 仍然失败

**症状**：本地测试通过，但 `wss://terryzin.cpolar.cn/` 仍报错 1006

**可能原因**：
1. **Cpolar 不支持 WebSocket**（Free/Basic 版限制）
2. **防火墙/代理拦截 WebSocket** 流量
3. **HTTPS/SSL 证书问题**（WSS 需要有效证书）

**诊断命令**：
```bash
# 检查 Cpolar 隧道状态
curl -I https://terryzin.cpolar.cn/

# 测试 WebSocket 升级
curl -I --http1.1 \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  https://terryzin.cpolar.cn/
```

**预期响应**（如果支持 WebSocket）：
```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

**实际响应**（如果不支持）：
```
HTTP/1.1 200 OK  # 或 403/404
```

---

## 降级方案

如果 WebSocket 在公网环境无法使用，可提供降级方案：

### 方案 1：长轮询（Long Polling）

**修改 `src/realtime.js`**：
```javascript
class RealtimeService {
    connect() {
        if (this.supportsWebSocket()) {
            this.connectWebSocket();
        } else {
            this.startPolling(); // 降级为轮询
        }
    }

    supportsWebSocket() {
        // 检测 WebSocket 支持
        return 'WebSocket' in window && this.wsUrl.startsWith('ws');
    }

    startPolling() {
        setInterval(async () => {
            const res = await fetch('/api/status', { headers: { 'X-Ergo-Key': getApiKey() } });
            const data = await res.json();
            this.emit('gateway-status-update', data.gateway);
        }, 10000); // 每 10 秒轮询
    }
}
```

### 方案 2：Server-Sent Events (SSE)

SSE 使用普通 HTTP，不需要 WebSocket 支持：

```javascript
// 服务器端（server/api-bridge.js）
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 定期推送状态
    const interval = setInterval(() => {
        sendEvent({ type: 'status', payload: statusCache });
    }, 10000);

    req.on('close', () => clearInterval(interval));
});

// 客户端（src/realtime.js）
const eventSource = new EventSource('/api/events');
eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    this.emit(data.type, data.payload);
};
```

---

## 总结

### 修复内容
- ✅ API Bridge 认证中间件豁免 WebSocket 升级请求
- ✅ 前端代理使用原生 http-proxy 处理 WebSocket
- ✅ 本地测试通过（ws://localhost:8081）
- ⚠️ 公网 WSS 需要 Cpolar Pro 或替代方案

### 下一步
1. **确认 Cpolar 版本**：检查是否支持 WebSocket
2. **配置优化**：启用 WebSocket 压缩、调整隧道设置
3. **降级方案**：如需公网实时更新，可使用 SSE 或长轮询
4. **监控日志**：观察 WebSocket 连接稳定性

### 相关文档
- 故障排查：[TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- 更新日志：[CHANGELOG.md](../CHANGELOG.md#v150)
- 快速开始：[QUICK_START.md](QUICK_START.md)
