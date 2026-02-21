# Ergo 部署架构说明

> Boring Technology, Reliable Systems 🏗️

## 设计原则

### 1. Convention over Configuration（约定优于配置）

- **统一的配置入口**：所有配置集中在 `.env` 文件
- **合理的默认值**：端口、路径等有明确的默认配置
- **零配置启动**：`scripts/start.bat` 一键启动
- **标准化命名**：服务名、端口、域名遵循统一规范

### 2. Choose Boring Technology（选择无聊的技术）

- **Node.js + Express**：成熟稳定的 Web 框架
- **Python http.server**：系统自带的静态服务
- **Cpolar**：现成的内网穿透方案
- **环境变量**：最基础的配置管理

### 3. Majestic Monolith（宏伟的单体）

- **3 个服务，1 个部署单元**：
  - Ergo Frontend (8081)
  - API Bridge (8082)
  - OpenClaw Gateway (18789 - 外部服务)
- **统一启动脚本**：`npm run start:all`
- **统一健康检查**：`npm run health`

---

## 服务架构

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        外部访问                              │
│                                                              │
│   ┌──────────────────────┐    ┌──────────────────────┐     │
│   │  terryzin.cpolar.top │    │ terrysopenclaw.      │     │
│   │  (Ergo Dashboard)    │    │ cpolar.top           │     │
│   └──────────┬───────────┘    └──────────┬───────────┘     │
│              │                            │                  │
└──────────────┼────────────────────────────┼─────────────────┘
               │ Cpolar 隧道                │ Cpolar 隧道
               │                            │
┌──────────────┼────────────────────────────┼─────────────────┐
│              ▼                            ▼                  │
│   ┌────────────────────┐      ┌────────────────────┐       │
│   │  Ergo Frontend     │      │ OpenClaw Gateway   │       │
│   │  (Express)         │      │ (只读)             │       │
│   │  Port: 8081        │      │ Port: 18789        │       │
│   └─────────┬──────────┘      └────────────────────┘       │
│             │ /api/* 代理                                   │
│             ▼                                               │
│   ┌────────────────────┐                                   │
│   │  API Bridge        │                                   │
│   │  (Express)         │                                   │
│   │  Port: 8082        │────► OpenClaw CLI                │
│   └────────────────────┘      (openclaw status)            │
│                                                              │
│                      本地环境 (Windows)                      │
└─────────────────────────────────────────────────────────────┘
```

### 服务说明

#### 1. Ergo Frontend (端口 8081)

**职责：**
- 静态文件服务（HTML/CSS/JS）
- API 代理（/api/* → API Bridge）
- WebSocket 代理（开发中）

**技术栈：**
- Express.js
- http-proxy-middleware

**启动命令：**
```bash
npm run start
# 或
node server/frontend-with-proxy.js
```

**环境变量：**
```bash
PORT=8081
API_BRIDGE_PORT=8082
LOG_LEVEL=info
```

---

#### 2. API Bridge (端口 8082)

**职责：**
- 封装 OpenClaw CLI 为 HTTP API
- 提供认证机制
- 数据缓存（5 分钟）

**技术栈：**
- Express.js
- child_process (执行 CLI)

**启动命令：**
```bash
npm run api
# 或
node server/api-bridge.js
```

**环境变量：**
```bash
API_BRIDGE_PORT=8082
OPENCLAW_WORKSPACE=D:\.openclaw\workspace
ERGO_API_KEY=ergo-default-secret-key-2026
AUTH_ENABLED=true
```

---

#### 3. OpenClaw Gateway (端口 18789)

**职责：**
- AI Agent 管理
- WebUI 管理界面
- 核心 API 服务

**技术栈：**
- OpenClaw 自有实现
- 外部服务（只读）

**访问地址：**
- 本地：http://localhost:18789
- 公网：https://terrysopenclaw.cpolar.top

**配置：**
- Token: 从 Gateway 设置页获取
- 无需 Ergo 管理

---

## 配置管理

### 配置文件层次

```
.env.example        ← 配置模板（提交到 Git）
     ↓
.env                ← 实际配置（不提交）
     ↓
process.env         ← 运行时环境变量
     ↓
应用代码            ← 通过 process.env 读取
```

### 配置优先级

1. **环境变量**（最高优先级）
   ```bash
   PORT=8091 npm run start
   ```

2. **.env 文件**（推荐方式）
   ```bash
   PORT=8081
   ```

3. **代码默认值**（兜底方案）
   ```javascript
   const PORT = process.env.PORT || 8081;
   ```

### 必需配置 vs 可选配置

**必需配置：**
```bash
OPENCLAW_TOKEN=f2009973...  # Gateway 认证 Token
```

**推荐配置：**
```bash
PORT=8081
API_BRIDGE_PORT=8082
CPOLAR_FRONTEND_URL=https://terryzin.cpolar.top
CPOLAR_GATEWAY_URL=https://terrysopenclaw.cpolar.top
```

**可选配置：**
```bash
LOG_LEVEL=debug
AUTH_ENABLED=false
HOT_RELOAD=true
```

---

## 网络流量路径

### 场景 1: 本地开发

```
浏览器 (localhost:8081)
  ↓
Ergo Frontend (8081)
  ↓ /api/status
API Bridge (8082)
  ↓ openclaw status
OpenClaw CLI
  ↓
OpenClaw Gateway (18789)
```

### 场景 2: 外网访问

```
浏览器 (terryzin.cpolar.top)
  ↓
Cpolar 隧道
  ↓
Ergo Frontend (8081)
  ↓ /api/status
API Bridge (8082)
  ↓ openclaw status
OpenClaw CLI
  ↓
OpenClaw Gateway (18789)
```

### 场景 3: Gateway WebUI 访问

```
浏览器 (terrysopenclaw.cpolar.top)
  ↓
Cpolar 隧道
  ↓
OpenClaw Gateway (18789)
  ↓
Gateway WebUI
```

---

## Cpolar 配置详解

### 隧道配置

**cpolar.yml:**
```yaml
tunnels:
  ergo-frontend:
    proto: http
    addr: 8081
    # subdomain: terryzin  # Pro 版

  openclaw-gateway:
    proto: http
    addr: 18789
    # subdomain: terrysopenclaw  # Pro 版
```

### 启动方式

**方式 1: 配置文件（推荐）**
```bash
cpolar start-all
```

**方式 2: 命令行**
```bash
cpolar http 8081 --region=cn --subdomain=terryzin
cpolar http 18789 --region=cn --subdomain=terrysopenclaw
```

**方式 3: Windows 服务**
```cmd
scripts\cpolar-service-install.bat
```

### 域名管理

**Pro 版（固定子域名）：**
- terryzin.cpolar.top (固定)
- terrysopenclaw.cpolar.top (固定)

**免费版（随机域名）：**
- 每次启动域名会变
- 需访问 http://localhost:4040 查看
- 需更新 `.env` 中的域名配置

---

## 进程管理

### 开发环境

**使用 npm scripts:**
```bash
npm run start:all  # 使用 concurrently 启动所有服务
```

**手动启动:**
```bash
# 终端 1
npm run start

# 终端 2
npm run api

# 终端 3
npm run pairing
```

### 生产环境（推荐 PM2）

**安装 PM2:**
```bash
npm install -g pm2
```

**启动服务:**
```bash
pm2 start npm --name "ergo" -- run start:all
```

**开机自启:**
```bash
pm2 startup
pm2 save
```

**监控:**
```bash
pm2 status
pm2 logs ergo
pm2 monit
```

---

## 安全设计

### 1. API 认证

**机制：**
- API Bridge 使用 Bearer Token 认证
- Token 配置在 `.env` 文件（`ERGO_API_KEY`）
- 前端请求时携带 Token

**实现：**
```javascript
// server/api-bridge.js
const ERGO_SECRET = process.env.ERGO_API_KEY;

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token !== ERGO_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}
```

### 2. CORS 策略

**当前策略：**
```javascript
// 允许所有来源（开发环境）
app.use(cors());
```

**生产环境建议：**
```javascript
// 仅允许 Ergo 前端域名
app.use(cors({
    origin: process.env.CPOLAR_FRONTEND_URL || 'http://localhost:8081'
}));
```

### 3. 敏感信息保护

**不应提交到 Git：**
- `.env` 文件（包含 Token）
- `node_modules/`
- 日志文件

**.gitignore 配置：**
```
.env
.env.local
*.log
node_modules/
```

---

## 数据流说明

### API 请求流程

```
1. 浏览器发起请求
   GET https://terryzin.cpolar.top/api/status

2. Cpolar 隧道转发
   → http://localhost:8081/api/status

3. Ergo Frontend 代理
   → http://localhost:8082/api/status

4. API Bridge 处理
   - 验证 Token
   - 检查缓存（5 分钟有效）
   - 如果缓存失效，执行 CLI

5. 执行 OpenClaw CLI
   $ openclaw status

6. CLI 访问 Gateway
   → http://localhost:18789/api/status

7. 响应返回
   Gateway → CLI → API Bridge → Ergo Frontend → Cpolar → 浏览器
```

### WebSocket 流程（计划中）

```
1. 浏览器建立 WebSocket 连接
   wss://terryzin.cpolar.top/api/ws

2. Cpolar 隧道转发（需 Pro 版）
   → ws://localhost:8081/api/ws

3. Ergo Frontend 代理
   → ws://localhost:8082/api/ws

4. API Bridge 处理
   - 验证 Token
   - 转发 Gateway WebSocket

5. 持久连接
   Gateway ←→ API Bridge ←→ Ergo Frontend ←→ 浏览器
```

---

## 性能优化

### 1. 缓存策略

**API Bridge 缓存：**
```javascript
const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟
```

**静态文件缓存：**
```javascript
// HTML: 无缓存（防止更新不生效）
Cache-Control: no-cache, no-store, must-revalidate

// JS/CSS: 1 小时缓存
Cache-Control: public, max-age=3600

// 图片: 1 天缓存
Cache-Control: public, max-age=86400
```

### 2. Gzip 压缩

**已启用（Express 默认）：**
- 自动压缩文本内容（HTML/CSS/JS/JSON）
- 节省 60-80% 带宽

### 3. HTTP/2（Cpolar Pro）

**启用方式：**
```yaml
# cpolar.yml
tunnels:
  ergo-frontend:
    http2: true  # 启用 HTTP/2
```

---

## 监控和日志

### 健康检查

**自动检查：**
```bash
npm run health
```

**检查内容：**
- Ergo Frontend (8081)
- API Bridge (8082)
- OpenClaw Gateway (18789)
- Cpolar 隧道状态

### 日志管理

**日志位置：**
```
Ergo Frontend → 控制台输出
API Bridge → 控制台输出
OpenClaw Gateway → ~/.openclaw/logs/
Cpolar → ~/.cpolar/logs/
```

**日志级别：**
```bash
LOG_LEVEL=debug  # debug/info/warn/error
```

---

## 备份和恢复

### 必备备份内容

1. **配置文件**
   ```bash
   .env
   cpolar.yml
   ```

2. **数据文件**
   ```bash
   data/projects.json
   .openclaw/tasks/
   ```

3. **OpenClaw 工作空间**
   ```bash
   D:\.openclaw\workspace
   ```

### 备份脚本

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="backups/$DATE"

mkdir -p "$BACKUP_DIR"
cp .env "$BACKUP_DIR/"
cp cpolar.yml "$BACKUP_DIR/"
cp data/projects.json "$BACKUP_DIR/"
tar -czf "$BACKUP_DIR/openclaw-workspace.tar.gz" ~/.openclaw/workspace

echo "Backup completed: $BACKUP_DIR"
```

---

## 扩展性设计

### 当前架构能支持的扩展

**✅ 可以直接扩展：**
- 新增 API 端点（API Bridge）
- 新增前端页面（静态文件）
- 新增 Cpolar 隧道（多个子域名）

**⚠️ 需要调整架构：**
- 多用户支持（需要数据库）
- 高并发（需要负载均衡）
- 分布式部署（需要消息队列）

### 何时拆分服务

**不需要拆分的情况（保持单体）：**
- 用户数 < 100
- QPS < 100
- 数据量 < 10GB
- 开发团队 < 3 人

**需要拆分的信号：**
- 单个服务响应时间 > 1s
- 内存占用 > 2GB
- CPU 使用率持续 > 80%
- 代码库 > 100,000 行

---

## 相关文档

- [部署指南](DEPLOYMENT_GUIDE.md) - 完整部署流程
- [故障排查](TROUBLESHOOTING.md) - 问题诊断
- [快速开始](../../QUICK_START.md) - 快速上手
- [API 文档](../api/README.md) - API 接口说明

---

**Made with ❤️ by Ergo Team**

*Last updated: 2026-02-21*
