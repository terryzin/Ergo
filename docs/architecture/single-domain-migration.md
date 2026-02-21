# 单域名架构迁移指南

## 背景

从双域名架构迁移到单域名架构，节约 cpolar 持久化域名配额（从 2 个减少到 1 个）。

### 迁移前架构（v1.6.1 及之前）

```
外网访问
  │
  ├─ https://terryzin.cpolar.top
  │    └─ cpolar tunnel → localhost:8081 (Frontend Proxy)
  │
  └─ https://terrysopenclaw.cpolar.top
       └─ cpolar tunnel → localhost:18789 (OpenClaw Gateway)
```

**问题：**
- ❌ 占用 2 个持久化域名（cpolar Pro 仅提供 2 个）
- ❌ 其他项目无法使用第二个域名
- ❌ 直接暴露 Gateway 端口，安全性较低

### 迁移后架构（v1.7.0）

```
外网访问
  │
  └─ https://terryzin.cpolar.top (唯一入口)
       └─ cpolar tunnel → localhost:8081
            ├─ /           → 静态文件 (HTML/CSS/JS)
            └─ /api/*      → Proxy → localhost:8082 (API Bridge)
                                └─ OpenClaw CLI → localhost:18789 (Gateway)
```

**优势：**
- ✅ 单域名，释放 1 个域名配额给其他项目
- ✅ 统一入口，访问更简洁
- ✅ Gateway 不直接暴露，更安全
- ✅ 遵循 DHH 的 **Majestic Monolith** 原则

---

## 迁移步骤（3 分钟完成）

### ⚠️ 前提条件

- 已安装 Ergo v1.6.2 或更高版本
- 代码已经支持单域名架构（无需改代码）
- 仅需调整配置文件

### 步骤 1：更新 `.env` 配置

编辑 `.env` 文件，删除 `CPOLAR_GATEWAY_URL`：

```diff
# Cpolar 配置
- # Ergo Dashboard 公网域名
- CPOLAR_FRONTEND_URL=https://terryzin.cpolar.top
-
- # OpenClaw Gateway 公网域名
- CPOLAR_GATEWAY_URL=https://terrysopenclaw.cpolar.top

+ # Ergo 公网域名（所有服务统一入口）
+ CPOLAR_URL=https://terryzin.cpolar.top
```

### 步骤 2：更新 Cpolar 配置

编辑 `cpolar.yml`，删除 `openclaw-gateway` 隧道：

```diff
tunnels:
-  ergo-frontend:
+  ergo:
     proto: http
     addr: 8081
-    # subdomain: terryzin
+    subdomain: terryzin

-  openclaw-gateway:
-    proto: http
-    addr: 18789
-    # subdomain: terrysopenclaw
-    inspect: false
```

### 步骤 3：重启 Cpolar 服务

**方式 A：Windows 服务方式（推荐）**

```bash
# 停止旧隧道
cpolar service stop

# 重新安装服务（使用新配置）
cpolar service install -config D:\.openclaw\workspace\my-dashboard\cpolar.yml

# 启动服务
cpolar service start
```

**方式 B：手动启动方式**

```bash
# 停止旧的 cpolar 进程（Ctrl+C）
# 然后启动单隧道
cpolar start ergo -config D:\.openclaw\workspace\my-dashboard\cpolar.yml
```

### 步骤 4：验证迁移成功

1. 访问 http://localhost:4040 查看 cpolar 隧道状态
   - ✅ 只有 1 个隧道：`ergo` → `http://localhost:8081`
   - ✅ 公网地址：https://terryzin.cpolar.top

2. 访问 https://terryzin.cpolar.top
   - ✅ Dashboard 正常加载
   - ✅ Gateway 状态卡片显示 "Online"
   - ✅ 无跨域错误（CORS）

3. 检查 API 调用（浏览器控制台）
   - ✅ 请求路径：`https://terryzin.cpolar.top/api/status`
   - ✅ 无 `localhost` 或 `terrysopenclaw.cpolar.top` 请求
   - ✅ 返回数据正常

---

## 架构原理

### 请求流转

**外部访问 API：**

```
https://terryzin.cpolar.top/api/status
  ↓ (cpolar 隧道)
localhost:8081/api/status (Frontend Proxy)
  ↓ (Express 代理中间件)
localhost:8082/api/status (API Bridge)
  ↓ (OpenClaw CLI)
localhost:18789 (OpenClaw Gateway)
```

**外部访问静态文件：**

```
https://terryzin.cpolar.top/index.html
  ↓ (cpolar 隧道)
localhost:8081/index.html (Frontend Proxy)
  ↓ (Express Static)
返回静态文件
```

### 关键代码说明

**1. Frontend Proxy（`server/frontend-with-proxy.js`）**

```javascript
// 代理 /api/* 请求到 API Bridge
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:8082',
    pathRewrite: (path) => '/api' + path,
    ws: true  // 支持 WebSocket
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, '..')));
```

**2. API Bridge（`server/api-bridge.js`）**

```javascript
// 静态文件服务（v1.6.2 统一架构）
app.use(express.static(staticPath));

// API 路由
app.get('/api/status', async (req, res) => {
    const data = await fetchOpenClawStatus();
    res.json(data);
});
```

**3. 前端环境检测（`src/config.js`）**

```javascript
detectApiBase() {
    const hostname = window.location.hostname;

    // 本地开发：直接访问 8082
    if (hostname === 'localhost') {
        return 'http://localhost:8082';
    }

    // 外网访问：使用相对路径（代理转发）
    return '';
}
```

---

## 验证清单

迁移完成后，请逐项检查：

- [ ] ✅ Cpolar 只有 1 个隧道（`ergo`）
- [ ] ✅ 可以访问 https://terryzin.cpolar.top
- [ ] ✅ Dashboard 加载正常
- [ ] ✅ Gateway 状态显示 "Online"
- [ ] ✅ 项目列表正常显示
- [ ] ✅ Cron 任务列表正常显示
- [ ] ✅ 更新日志正常显示
- [ ] ✅ 无跨域（CORS）错误
- [ ] ✅ 无 404 错误
- [ ] ✅ 浏览器控制台无错误

---

## 常见问题

### Q1: 迁移后访问 API 返回 502 Bad Gateway？

**原因：** API Bridge (8082) 未启动。

**解决：**

```bash
cd D:\.openclaw\workspace\my-dashboard
npm run start:all
```

### Q2: 迁移后 Gateway 状态显示 "Offline"？

**原因：** OpenClaw Gateway (18789) 未运行。

**解决：**

```bash
openclaw gateway start
```

### Q3: 本地访问 localhost:8081 正常，但外网访问报错？

**原因：** Cpolar 隧道未生效。

**解决：**

1. 访问 http://localhost:4040 检查隧道状态
2. 确认隧道指向 `localhost:8081`
3. 重启 cpolar 服务

### Q4: 迁移后原来的 `terrysopenclaw.cpolar.top` 还能用吗？

**答案：** 可以保留，但不推荐。

- 如果保留双隧道，仍会占用 2 个域名
- 建议删除 `openclaw-gateway` 隧道，释放域名配额
- Gateway 通过 API Bridge 代理访问更安全

---

## 回滚方案

如果迁移失败，可快速回滚：

### 步骤 1：恢复 `.env` 配置

```bash
cd D:\.openclaw\workspace\my-dashboard
git checkout .env
```

### 步骤 2：恢复 `cpolar.yml` 配置

```bash
git checkout cpolar.yml
```

### 步骤 3：重启 Cpolar

```bash
cpolar service stop
cpolar service start
```

---

## 技术设计原则

本架构遵循 DHH（Ruby on Rails 作者）的开发哲学：

### 1. Majestic Monolith（宏伟的单体）

- ✅ 单一部署单元，统一入口
- ✅ 简化运维，减少复杂性
- ❌ 拒绝过早拆分（微服务是大公司的税）

### 2. Convention over Configuration（约定优于配置）

- ✅ 默认路由规则（`/api/*` → API Bridge）
- ✅ 自动环境检测（本地 vs 外网）
- ❌ 不需要繁琐的路由配置

### 3. Choose Boring Technology（选择成熟技术）

- ✅ Express.js（Node.js 最流行的框架）
- ✅ HTTP Proxy（原生代理，无黑魔法）
- ✅ Cpolar（稳定的内网穿透服务）

---

## 相关文档

- [架构设计文档](./architecture.md)
- [部署指南](../versions/v1.7/deployment.md)
- [CLAUDE.md](../../CLAUDE.md) - 项目上下文

---

**最后更新：** 2026-02-21
**版本：** v1.7.0
**作者：** Ergo Team
