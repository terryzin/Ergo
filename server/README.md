# Ergo API Bridge Server

将 OpenClaw CLI 输出转换为 HTTP API，供 Ergo 前端调用。

## 架构

```
Ergo 前端 (8081)
    ↓ HTTP
API Bridge (8082)
    ↓ CLI
OpenClaw Gateway (18789)
```

## API 端点列表

### 1. GET `/api/status`

获取 Gateway 整体状态（返回缓存，快速响应）

**特点：**
- ⚡ 快速响应（< 100ms）
- 📦 返回缓存数据
- 🕐 缓存每 5 分钟自动更新

**请求：**
```bash
curl http://localhost:8082/api/status
```

**响应：**
```json
{
  "gateway": {
    "status": "online",
    "version": "2026.2",
    "uptime": 0,
    "port": 18789
  },
  "agents": [
    {
      "name": "main",
      "status": "online",
      "model": "MiniMax-M2.5"
    }
  ],
  "cron": [],
  "updatedAt": "2026-02-19T16:41:25.004Z",
  "_meta": {
    "cached": true,
    "cacheAge": 13,
    "lastUpdate": "2026-02-19T16:41:25.004Z"
  }
}
```

**状态码：**
- `200` - 成功
- `503` - Gateway 离线

---

### 1.5. GET `/api/status/refresh`

**强制刷新状态（不使用缓存，实时获取）** ⭐ 新增

**特点：**
- 🔄 实时获取最新数据
- 🐌 较慢（10-15 秒）
- 📝 自动更新缓存

**请求：**
```bash
curl http://localhost:8082/api/status/refresh
```

**响应：**
```json
{
  "gateway": { ... },
  "agents": [ ... ],
  "cron": [],
  "updatedAt": "2026-02-19T16:41:55.318Z",
  "_meta": {
    "cached": false,
    "refreshed": true,
    "lastUpdate": "2026-02-19T16:41:55.318Z"
  }
}
```

**状态码：**
- `200` - 刷新成功
- `200` (with old cache) - 刷新失败但返回旧缓存
- `503` - 刷新失败且无缓存

---

### 2. GET `/health`

健康检查

**请求：**
```bash
curl http://localhost:8082/health
```

**响应：**
```json
{
  "status": "ok",
  "timestamp": "2026-02-19T16:29:04.148Z"
}
```

---

### 3. GET `/api/cron`

获取 Cron 任务列表（从 `data/gateway-status.json` 读取）

**请求：**
```bash
curl http://localhost:8082/api/cron
```

**响应：**
```json
{
  "cron": [
    {
      "id": "f691da5c-5cf6-4b05-9e8d-3a77a6d60a06",
      "name": "Gateway健康检查",
      "lastStatus": "success"
    }
  ],
  "updatedAt": "2026-02-19T17:24:00.000Z"
}
```

---

### 4. POST `/api/gateway/restart`

重启 Gateway

**请求：**
```bash
curl -X POST http://localhost:8082/api/gateway/restart
```

**响应：**
```json
{
  "success": true,
  "message": "Gateway restarting...",
  "timestamp": "2026-02-19T16:35:00.000Z"
}
```

**状态码：**
- `200` - 重启命令已发送
- `500` - 重启失败

---

## 启动服务器

### 方式 1：直接启动
```bash
node server/api-bridge.js
```

### 方式 2：使用 npm script
```bash
npm run api
```

### 方式 3：同时启动前端和 API（推荐）
```bash
npm run start:all
```

或使用 BAT 脚本（Windows）：
```bash
start-ergo.bat
```

---

## 配置

### 端口
默认端口：`8082`

修改端口：
```bash
PORT=9000 node server/api-bridge.js
```

### 超时
OpenClaw CLI 命令超时：`15秒`

修改位置：`api-bridge.js` 第 88 行
```javascript
timeout: 15000  // 毫秒
```

---

## 技术细节

### 数据转换流程

1. **执行 CLI**：`openclaw status --json`
2. **解析输出**：提取 JSON（忽略警告信息）
3. **格式转换**：OpenClaw 格式 → Ergo 格式
4. **返回 HTTP**：JSON 响应

### 为什么需要 API Bridge？

OpenClaw Gateway 使用 **WebSocket RPC 协议**，不直接提供 REST API。

API Bridge 的作用：
- ✅ 将 WebSocket 转换为简单的 HTTP
- ✅ 利用官方 CLI（稳定可靠）
- ✅ 简化前端代码（无需处理 WebSocket）

---

## 故障排查

### 问题：API 返回 503 "Gateway offline"

**原因：**
- OpenClaw Gateway 未运行
- CLI 命令超时

**解决：**
```bash
# 检查 Gateway 状态
openclaw gateway status

# 启动 Gateway
openclaw gateway start
```

---

### 问题：API Bridge 无法启动

**原因：** 端口 8082 被占用

**解决：**
```bash
# Windows: 查看占用端口的进程
netstat -ano | findstr :8082

# 杀死进程
taskkill /PID <进程ID> /F
```

---

## 依赖

- Node.js >= 14
- OpenClaw CLI
- npm 包：
  - `express` - HTTP 服务器
  - `cors` - 跨域支持

---

## 缓存机制

### 自动更新
- 启动时立即初始化缓存
- 每 5 分钟自动后台更新
- 更新失败时保留旧缓存

### 缓存元数据 (`_meta`)
```json
{
  "cached": true,           // 是否来自缓存
  "cacheAge": 13,          // 缓存年龄（秒）
  "lastUpdate": "...",     // 最后更新时间
  "refreshed": false,      // 是否刚刷新
  "refreshFailed": false,  // 刷新是否失败
  "error": ""              // 错误信息（如有）
}
```

---

## 更新日志

### v1.2.3 (2026-02-20)
- ✅ 智能缓存机制（5 分钟自动更新）
- ✅ `/api/status/refresh` 强制刷新端点
- ✅ 缓存元数据支持
- ✅ 错误时返回旧缓存

### v1.2.2 (2026-02-20)
- ✅ 初始版本
- ✅ `/api/status` 端点
- ✅ OpenClaw CLI 集成
- ✅ CORS 支持
- ✅ 健康检查端点

---

## 相关文档

- [Ergo 项目文档](../README.md)
- [OpenClaw 官方文档](https://docs.openclaw.ai/)
- [ROADMAP](../docs/product/ROADMAP.md)
