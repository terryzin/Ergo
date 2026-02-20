# Frontend Proxy 解决方案

## 问题背景

### 原始问题
外部网络访问 Ergo 时，前端 JavaScript 无法连接到 `localhost:8082` 的 API Bridge：
```
localhost:8082/api/status Failed to load resource: net::ERR_CONNECTION_REFUSED
```

**原因：** 在外部访问环境中，`localhost` 指向用户自己的设备，而不是服务器。

### 尝试过的方案

#### 方案 A：三隧道架构（失败）
- 为 API Bridge (8082) 配置独立的 cpolar 隧道 `terryapi.cpolar.top`
- 前端根据访问域名自动检测并切换 API 地址
- **失败原因：** cpolar 免费版仅支持 2 个隧道，`terryapi.cpolar.top` 返回 404

## 最终方案：前端反向代理

### 架构

```
外部网络
  ↓
https://terryzin.cpolar.top (cpolar 隧道)
  ↓
localhost:8081 (Express 前端服务器)
  ↓
  ├─ GET / → 静态文件 (index.html)
  ├─ GET /assets/* → 静态资源
  └─ GET/POST /api/* → 反向代理到 localhost:8082
        ↓
        localhost:8082 (API Bridge)
        ↓
        执行 openclaw CLI 命令
```

### 关键特点

✅ **仅需 2 个 cpolar 隧道**（不超出免费版限制）
- `terryzin.cpolar.top` → 前端 (8081)
- `terrysopenclaw.cpolar.top` → OpenClaw Gateway (18789)

✅ **前后端统一入口**
- 所有请求都通过同一域名
- 无跨域问题（CORS）
- LocalStorage 共享

✅ **自动化代理**
- 前端使用相对路径 `/api/*`
- Express 自动转发到 `localhost:8082`
- 无需前端区分本地/公网环境

## 技术实现

### 后端：frontend-with-proxy.js

**核心代码：**
```javascript
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8081;
const API_BRIDGE_URL = process.env.API_BRIDGE_URL || 'http://localhost:8082';

// API 代理中间件
app.use('/api', createProxyMiddleware({
    target: API_BRIDGE_URL,
    changeOrigin: true,
    logLevel: 'info',
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[PROXY] ${req.method} ${req.path} → ${API_BRIDGE_URL}${req.path}`);
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

// 404 处理 (SPA fallback)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Frontend + API Proxy running on http://localhost:${PORT}`);
    console.log(`Public access: https://terryzin.cpolar.top`);
});
```

**功能：**
- `/api/*` 请求 → 代理到 `localhost:8082`
- 其他请求 → 返回静态文件
- 自动错误处理（502 Gateway Unavailable）

### 前端：index.html

**原始代码（环境检测）：**
```javascript
const GATEWAY_CONFIG = {
    url: (() => {
        const hostname = window.location.hostname;
        if (hostname.includes('cpolar.top')) {
            return 'https://terryapi.cpolar.top'; // 失败
        }
        return 'http://localhost:8082';
    })()
};
```

**新代码（相对路径）：**
```javascript
const GATEWAY_CONFIG = {
    url: '',  // 空字符串 = 使用相对路径
    timeout: 20000
};

// 发起请求
fetch('/api/status', {
    headers: { 'X-Ergo-Key': getApiKey() }
});
```

**改进：**
- ✅ 无需检测环境（本地/公网自动适配）
- ✅ 无需硬编码域名
- ✅ 更简洁的代码

## 部署流程

### 1. 安装依赖
```bash
cd D:\.openclaw\workspace\my-dashboard
npm install http-proxy-middleware --save
```

### 2. 停止旧服务
```bash
# 查找占用端口的进程
netstat -ano | findstr "8081 8082"

# 停止进程
taskkill /F /PID <PID>
```

### 3. 启动新架构
```bash
# 方式 1：使用批处理脚本（推荐）
start-ergo.bat

# 方式 2：手动启动
node server/api-bridge.js &
node server/auto-pairing-watcher.js &
node server/frontend-with-proxy.js
```

### 4. 验证
```bash
# 本地测试
curl http://localhost:8081/api/health
# 预期：{"status":"ok","timestamp":"..."}

curl -H "X-Ergo-Key: ergo-default-secret-key-2026" http://localhost:8081/api/status
# 预期：返回 Gateway 状态 JSON

# 公网测试
curl https://terryzin.cpolar.top/api/health
# 预期：{"status":"ok","timestamp":"..."}
```

## 服务配置

### package.json
```json
{
  "scripts": {
    "start": "node server/frontend-with-proxy.js",
    "start:legacy": "python -m http.server 8081",
    "api": "node server/api-bridge.js",
    "pairing": "node server/auto-pairing-watcher.js",
    "start:all": "concurrently \"npm run start\" \"npm run api\" \"npm run pairing\""
  }
}
```

### start-ergo.bat
```batch
@echo off
echo [1/3] 启动 API Bridge (http://localhost:8082)...
start /B "Ergo API Bridge" cmd /c "node server\api-bridge.js"

echo [2/3] 启动自动配对监听器...
start /B "Auto-Pairing Watcher" cmd /c "node server\auto-pairing-watcher.js"

echo [3/3] 启动 Ergo 前端+代理 (http://localhost:8081)...
node server\frontend-with-proxy.js
```

## 性能与安全

### 性能
- **延迟：** 本地代理，< 1ms 额外开销
- **并发：** Express 默认支持高并发
- **缓存：** API Bridge 有独立的 5 分钟缓存

### 安全
- ✅ 认证密钥验证（X-Ergo-Key）
- ✅ 错误信息不泄露敏感信息
- ✅ 代理日志记录所有请求
- ⚠️ 建议修改默认密钥

## 故障排查

### Q1: 前端 502 错误
**原因：** API Bridge (8082) 未运行

**解决：**
```bash
# 检查端口
netstat -ano | findstr "8082"

# 启动 API Bridge
node server/api-bridge.js
```

### Q2: CORS 错误
**原因：** 代理配置错误

**检查：**
```javascript
// frontend-with-proxy.js 中确保有
changeOrigin: true
```

### Q3: 静态文件 404
**原因：** Express 静态目录配置错误

**检查：**
```javascript
app.use(express.static(path.join(__dirname, '..')));
// 应该指向项目根目录
```

### Q4: 外部访问仍报 localhost:8082
**原因：** 前端代码未更新或浏览器缓存

**解决：**
1. 确认 `index.html` 中 `GATEWAY_CONFIG.url = ''`
2. 清除浏览器缓存 (Ctrl + Shift + Delete)
3. 强制刷新 (Ctrl + F5)

## 对比：Python vs Express

| 特性 | Python http.server | Express + Proxy |
|------|-------------------|-----------------|
| 静态文件 | ✅ | ✅ |
| API 代理 | ❌ | ✅ |
| 错误处理 | ❌ | ✅ |
| 日志记录 | ❌ | ✅ |
| 性能 | 中等 | 高 |
| 可扩展性 | 低 | 高 |
| 推荐用途 | 开发测试 | 生产环境 |

## 未来优化

### 可选改进
1. **HTTPS 支持**
   - 使用 `express-sslify` 强制 HTTPS
   - cpolar 已提供 SSL 终止

2. **负载均衡**
   - 多个 API Bridge 实例
   - 使用 nginx 或 HAProxy

3. **监控告警**
   - 代理请求统计
   - 错误率监控
   - 响应时间追踪

4. **缓存优化**
   - 静态资源 CDN
   - API 响应缓存（Redis）

---

**更新日期：** 2026-02-20
**版本：** v1.3.0
**作者：** Ergo Team
**状态：** ✅ 已实施并测试通过
