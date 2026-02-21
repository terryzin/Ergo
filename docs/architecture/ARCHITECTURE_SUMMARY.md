# Ergo 架构总览（v1.7.0）

> 单域名三层架构 - 遵循 DHH 的 Majestic Monolith 原则

---

## 🎯 核心设计理念

Ergo 采用**单域名三层架构**，遵循 DHH（Ruby on Rails 作者）的开发哲学：

1. **Majestic Monolith**（宏伟的单体）
   - 单一部署单元，统一入口
   - 简化运维，降低复杂性
   - 避免过早拆分（微服务是大公司的税）

2. **Convention over Configuration**（约定优于配置）
   - 约定 `/api` 路由规则
   - 自动环境检测（本地 vs 外网）
   - 零配置反向代理

3. **Choose Boring Technology**（选择成熟技术）
   - Express.js（Node.js 最流行的框架）
   - HTTP Proxy（原生代理，无黑魔法）
   - Cpolar（稳定的内网穿透）

---

## 🏗️ 三层架构

```
                     外部用户
                        ↓
        https://terryzin.cpolar.top (单域名入口)
                        ↓
                 [Cpolar Tunnel]
                        ↓
┌─────────────────────────────────────────────┐
│  Layer 1: Frontend Proxy (路由层)          │
│  Port: 8081                                 │
│  Role: 静态文件服务 + API 路由             │
│  Tech: Express.js + Static + Proxy         │
├─────────────────────────────────────────────┤
│  Routes:                                    │
│  - /                → index.html            │
│  - /*.html          → Static Files          │
│  - /src/*           → Static Files          │
│  - /assets/*        → Static Files          │
│  - /api/*           → Proxy to Layer 2      │
└─────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────┐
│  Layer 2: API Bridge (业务层)              │
│  Port: 8082                                 │
│  Role: 业务逻辑 + OpenClaw CLI 封装        │
│  Tech: Express.js + Child Process          │
├─────────────────────────────────────────────┤
│  APIs:                                      │
│  - GET  /api/status         → Gateway状态  │
│  - GET  /api/projects       → 项目列表     │
│  - POST /api/command/exec   → 执行命令     │
│  - GET  /api/files/browse   → 文件浏览     │
│  - WebSocket                → 实时通知     │
└─────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────┐
│  Layer 3: OpenClaw Gateway (底层)          │
│  Port: 18789                                │
│  Role: AI Agent 调度 + WebUI               │
│  Tech: OpenClaw Core                        │
├─────────────────────────────────────────────┤
│  Features:                                  │
│  - Agent 管理                               │
│  - Session 历史                             │
│  - Cron 定时任务                            │
│  - 原生 WebUI                               │
└─────────────────────────────────────────────┘
```

---

## 📡 请求流转示例

### 示例 1：访问 Dashboard（静态文件）

```
User → https://terryzin.cpolar.top/index.html
  ↓ (Cpolar Tunnel)
Frontend Proxy (8081) → /index.html
  ↓ (Express Static Middleware)
返回 index.html
```

### 示例 2：获取 Gateway 状态（API 调用）

```
User → https://terryzin.cpolar.top/api/status
  ↓ (Cpolar Tunnel)
Frontend Proxy (8081) → /api/status
  ↓ (Express Proxy Middleware)
API Bridge (8082) → /api/status
  ↓ (Child Process: openclaw status --json)
OpenClaw Gateway (18789)
  ↓
返回 JSON 数据 → Frontend Proxy → User
```

### 示例 3：WebSocket 连接（实时通知）

```
User → wss://terryzin.cpolar.top/api/realtime
  ↓ (Cpolar Tunnel - WebSocket Upgrade)
Frontend Proxy (8081) → WebSocket Proxy
  ↓ (HTTP Proxy - ws: true)
API Bridge (8082) → WebSocket Server
  ↓
维持长连接，推送实时消息
```

---

## 🔒 安全设计

### 1. Gateway 不直接暴露

- ❌ 旧架构：`https://terrysopenclaw.cpolar.top` → Gateway (18789)
- ✅ 新架构：Gateway 仅在 localhost 监听，通过 API Bridge 代理访问

**优势：**
- 降低攻击面（Gateway 不直接暴露到公网）
- 统一认证（API Bridge 统一处理 API Key）
- 审计日志（所有请求经过 API Bridge）

### 2. API 认证（X-Ergo-Key）

```javascript
// API Bridge 认证中间件
app.use(authMiddleware);

function authMiddleware(req, res, next) {
    // 静态文件豁免认证
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    const apiKey = req.headers['x-ergo-key'];
    if (apiKey !== ERGO_SECRET) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    next();
}
```

### 3. 路径安全检查

```javascript
// 防止路径遍历攻击
function sanitizePath(inputPath) {
    if (inputPath.includes('../') || inputPath.includes('..\\')) {
        throw new Error('Path traversal detected');
    }

    const resolvedPath = path.resolve(WORKSPACE_ROOT, inputPath);
    if (!resolvedPath.startsWith(WORKSPACE_ROOT)) {
        throw new Error('Access denied: outside workspace');
    }

    return resolvedPath;
}
```

### 4. 危险命令黑名单

```javascript
// 阻止危险命令
const DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\/$/,
    /sudo/i,
    /shutdown/i,
    /mkfs/i,
    // ...
];

function isDangerousCommand(cmd) {
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(cmd));
}
```

---

## 🚀 部署模式

### 本地开发模式

```bash
# 启动所有服务
npm run start:all

# 访问地址
- Frontend: http://localhost:8081
- API Bridge: http://localhost:8082
- Gateway: http://localhost:18789 (仅本地访问)
```

### 生产模式（外网访问）

```bash
# 1. 启动 Ergo 服务
npm run start:all

# 2. 启动 Cpolar 隧道
cpolar start ergo -config cpolar.yml

# 访问地址
- 外网: https://terryzin.cpolar.top
- Cpolar Web UI: http://localhost:4040
```

---

## 📊 性能优化

### 1. 状态缓存（5 分钟）

```javascript
let statusCache = null;
let lastUpdateTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟

app.get('/api/status', async (req, res) => {
    if (statusCache && (Date.now() - lastUpdateTime < CACHE_DURATION)) {
        return res.json({ ...statusCache, _meta: { cached: true } });
    }

    // 缓存过期，重新获取
    statusCache = await fetchOpenClawStatus();
    lastUpdateTime = Date.now();
    res.json(statusCache);
});
```

### 2. WebSocket 心跳（30 秒）

```javascript
const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'heartbeat',
            payload: { time: Date.now() }
        }));
    }
}, 30000);
```

### 3. 文件监听防抖（500ms）

```javascript
const watcher = chokidar.watch('*/project-status.json', {
    awaitWriteFinish: {
        stabilityThreshold: 500,  // 防抖 500ms
        pollInterval: 100
    }
});
```

---

## 📈 监控指标

### 关键指标

| 指标 | 数据源 | 刷新频率 |
|------|--------|----------|
| Gateway 状态 | `openclaw status --json` | 5 分钟（缓存） |
| 项目健康度 | `project-status.json` | 实时（文件监听） |
| Cron 任务状态 | `openclaw cron list --json` | 按需 |
| 服务运行时间 | API Bridge 启动时间 | 实时计算 |

### 健康检查

```bash
# 快速检查（无需认证）
curl http://localhost:8082/health

# 完整状态检查
curl -H "X-Ergo-Key: your-key" http://localhost:8082/api/status

# Smoke Test（所有端点）
npm test
```

---

## 🛠️ 故障排查

### 问题 1：Dashboard 空白

**症状：** 访问 Dashboard 显示空白页。

**排查步骤：**
```bash
# 1. 检查 Frontend Proxy (8081) 是否运行
netstat -ano | findstr "8081"

# 2. 查看启动日志
检查 npm run start 窗口输出

# 3. 检查浏览器控制台错误
F12 → Console Tab
```

### 问题 2：API 返回 502

**症状：** API 调用返回 `502 Bad Gateway`。

**排查步骤：**
```bash
# 1. 检查 API Bridge (8082) 是否运行
netstat -ano | findstr "8082"

# 2. 检查 OpenClaw Gateway (18789) 是否运行
openclaw status

# 3. 重启服务
npm run start:all
```

### 问题 3：WebSocket 连接失败

**症状：** 实时更新不生效。

**排查步骤：**
```bash
# 1. 检查 WebSocket 代理配置
查看 server/frontend-with-proxy.js:106 (upgrade 事件)

# 2. 检查浏览器 WebSocket 连接
F12 → Network Tab → Filter: WS

# 3. 检查 API Bridge WebSocket Server
查看 server/api-bridge.js:1830 (WebSocket Server)
```

---

## 📚 相关文档

- [迁移指南](./single-domain-migration.md) - 从双域名迁移到单域名
- [快速启动](../QUICK_START.md) - 5 分钟上手
- [配置说明](../CONFIG.md) - 环境变量和配置文件
- [更新日志](../../CHANGELOG.md) - 版本历史
- [项目上下文](../../CLAUDE.md) - 开发协作指南

---

**最后更新：** 2026-02-21
**版本：** v1.7.0
**架构师：** Ergo Team（遵循 DHH 设计哲学）
