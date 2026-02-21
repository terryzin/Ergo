# Ergo 架构审查报告

**作者**: CTO (Werner Vogels 思维)
**日期**: 2026-02-21
**版本**: v1.0

---

## 执行摘要

Ergo 项目在短短一个月内进行了 **30+ 次修复提交**，其中 **60% 是配置和环境相关问题**。这不是代码质量问题，而是 **架构设计缺陷** —— 系统没有为失败而设计，配置管理混乱，缺乏健康检查和故障自愈机制。

**核心问题**：
1. **单点故障多** - cpolar 隧道、API Bridge、Python http.server 任意一个挂了整个系统不可用
2. **配置地狱** - 环境检测逻辑分散在 5+ 个文件，规则不一致
3. **无健康检查** - 服务启动后无法自动检测依赖是否正常
4. **缺乏降级策略** - API 不可用时前端完全白屏

**改进目标**：
- 将 MTTR (Mean Time To Repair) 从 "手动重启" 降低到 "自动恢复"
- 将配置复杂度从 "5 个文件、3 个环境" 简化到 "1 个配置文件、自动检测"
- 将故障影响半径从 "整站不可用" 缩小到 "部分功能降级"

---

## 一、当前架构诊断

### 1.1 架构拓扑

```
┌─────────────────────────────────────────────────────────┐
│                    外网访问层                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ terryzin.   │  │ terryapi.   │  │ terrysopen  │     │
│  │ cpolar.cn  │  │ cpolar.cn  │  │ claw.cpolar │     │
│  │ (静态文件)   │  │ (API)      │  │ .top (GW)   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
└─────────┼─────────────────┼─────────────────┼───────────┘
          │ cpolar          │ cpolar          │ cpolar
          │ tunnel          │ tunnel          │ tunnel
          ↓                 ↓                 ↓
┌─────────────────────────────────────────────────────────┐
│                    本地服务层                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Python      │  │ Express     │  │ OpenClaw    │     │
│  │ http.server │  │ API Bridge  │  │ Gateway     │     │
│  │ :8081      │  │ :8082      │  │ :18789     │     │
│  └─────────────┘  └──────┬──────┘  └─────────────┘     │
│                           │ exec openclaw CLI           │
│                           ↓                             │
│                    ┌─────────────┐                      │
│                    │ openclaw    │                      │
│                    │ CLI 命令    │                      │
│                    └─────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### 1.2 单点故障分析（Blast Radius）

| 组件 | 单点故障 | 影响半径 | MTTR |
|------|---------|---------|------|
| **cpolar 隧道** | ✅ 是 | 100% 功能不可用 | 手动重启 (~5min) |
| **API Bridge (8082)** | ✅ 是 | 80% 功能不可用（状态、项目、终端） | 手动重启 (~2min) |
| **Python http.server (8081)** | ✅ 是 | 100% 不可访问 | 手动重启 (~30s) |
| **OpenClaw Gateway (18789)** | ⚠️ 部分 | 50% 功能降级（Agent、Cron） | 自动重启 (~10s) |
| **环境配置检测** | ✅ 是 | 配置错误导致 100% 不可用 | 改代码重新部署 (~10min) |

**结论**：系统有 **5 个单点故障**，其中 **3 个需要手动干预**。

### 1.3 配置管理混乱

配置逻辑分散在多个文件，且规则不一致：

| 文件 | 配置内容 | 规则 | 问题 |
|------|---------|------|------|
| `src/config.js` | API Base URL | `localhost` → `http://localhost:8082`<br>其他 → `''` (相对路径) | ✅ 正确 |
| `index.html` | Gateway URL (L1684-1690) | `localhost` → `http://localhost:18789`<br>其他 → `https://terrysopenclaw.cpolar.cn` | ⚠️ 硬编码域名 |
| `CPOLAR_SETUP.md` | 临时隧道域名 | `terryapi.cpolar.cn` | ⚠️ 文档与代码不同步 |
| `start-ergo.bat` | 端口映射 | 8081, 8082 | ✅ 正确 |
| `server/frontend-with-proxy.js` | 代理规则 | `/api/* → 8082` | ✅ 正确 |

**问题汇总**：
1. **硬编码 cpolar 域名** - `index.html` L1689，隧道域名变更需要改代码
2. **环境检测规则分散** - 至少 3 个地方实现了 hostname 检测
3. **文档与代码不一致** - `CPOLAR_SETUP.md` 提到 `terryapi.cpolar.cn`，但代码里没用到
4. **配置无验证** - 服务启动时不检查配置是否正确

### 1.4 健康检查缺失

| 组件 | 健康检查 | 启动验证 | 故障恢复 |
|------|---------|---------|---------|
| Python http.server | ❌ 无 | ❌ 无 | ❌ 手动重启 |
| API Bridge (8082) | ✅ `/api/health` | ❌ 无 | ❌ 手动重启 |
| OpenClaw Gateway | ✅ `/api/health` | ❌ 无 | ⚠️ 部分自动重启 |
| cpolar 隧道 | ❌ 无 | ❌ 无 | ❌ 手动重启 |

**问题**：
- `start-ergo.bat` 启动服务后 **不检查端口是否监听成功**
- 前端 **不检查 API 健康状态** 就开始请求数据（导致大量错误日志）
- cpolar 隧道挂了 **无任何告警**

### 1.5 故障模式分析（Failure Modes）

#### 场景 1：API Bridge 未启动
- **触发条件**：忘记运行 `start-ergo.bat`
- **现象**：前端白屏，所有 KPI 显示 `--`
- **用户体验**：无任何错误提示，用户以为网络断了
- **提交记录**：`62d5ef8`, `161da92`, `07e388d` 都在修复这个问题

#### 场景 2：cpolar 隧道域名变更（免费版）
- **触发条件**：cpolar 重启后随机域名变化
- **现象**：硬编码的 `terrysopenclaw.cpolar.cn` 失效
- **修复成本**：改代码 → 提交 → 重新部署
- **提交记录**：`633b68e` "配置外网 API 隧道地址 - 临时域名"

#### 场景 3：环境检测误判
- **触发条件**：本地使用 `127.0.0.1` 访问而非 `localhost`
- **现象**：配置切换到外网模式，API 请求相对路径
- **提交记录**：`24b2c39`, `82e01aa`, `ed93f61` 修复不同页面的环境检测

#### 场景 4：浏览器缓存旧版本 HTML
- **触发条件**：部署新版本后浏览器读缓存
- **现象**：旧版本 JS 调用新版本 API，字段不匹配
- **提交记录**：`717c62a` "添加缓存控制防止浏览器缓存旧版本 HTML"

---

## 二、架构改进方案

### 2.1 设计原则（Vogels 思维）

#### Principle 1: Everything Fails, All the Time
**当前问题**：系统假设 cpolar、API Bridge、OpenClaw Gateway 永远在线
**改进方向**：
- 为每个组件设计降级策略
- 实现自动故障检测 + 重启机制
- 前端显示明确的错误状态，而不是白屏

#### Principle 2: 去中心化 + 最终一致性
**当前问题**：API Bridge 是中心化瓶颈，挂了所有功能不可用
**改进方向**：
- 前端直接调用 OpenClaw Gateway（减少一层代理）
- API Bridge 专注于"增强功能"（文件浏览、终端），而非核心状态查询
- 数据缓存在前端，API 不可用时展示 stale data

#### Principle 3: API First
**当前问题**：配置逻辑散落在代码各处，没有统一的配置 API
**改进方向**：
- 创建 `/api/config` 端点，由服务端返回正确的配置
- 前端从 API 获取配置，而不是自己检测环境

#### Principle 4: 运维成本优先
**当前问题**：每次配置变更需要改代码 → 提交 → 部署
**改进方向**：
- 配置外部化（环境变量 / config.json）
- 支持运行时动态更新配置，无需重启

### 2.2 改进架构设计

#### 架构 v2.0 - 三层降级 + 自愈设计

```
┌─────────────────────────────────────────────────────────┐
│                  前端 (React 模式)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ State Management (Zustand/Redux)               │   │
│  │  - API 状态缓存 (5min TTL)                      │   │
│  │  - 降级数据源 (localStorage backup)             │   │
│  │  - 自动重试逻辑 (exponential backoff)           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Health Check Service                           │   │
│  │  - 每 3s 检测 API 可用性                         │   │
│  │  - 自动切换降级模式                              │   │
│  │  - 显示明确的健康状态指示器                      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
            ┌─────────────────────────┐
            │   API Gateway (Nginx)   │ ← 新增：统一入口
            │  - 健康检查 (upstream)   │
            │  - 自动故障切换          │
            │  - 日志聚合             │
            └─────────────────────────┘
                    │           │
        ┌───────────┴───────┐   └────────────┐
        ↓                   ↓                ↓
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ OpenClaw    │   │ API Bridge  │   │ Backup API  │
│ Gateway     │   │ (增强功能)   │   │ (只读缓存)  │
│ :18789     │   │ :8082      │   │ :8083      │
│             │   │             │   │             │
│ ✅ 核心数据  │   │ ✅ 文件浏览  │   │ ✅ 降级数据  │
│ ✅ Agent    │   │ ✅ 终端命令  │   │ (静态JSON)  │
│ ✅ Cron     │   │ ✅ 日志查看  │   │             │
└─────────────┘   └─────────────┘   └─────────────┘
```

**关键改进点**：

1. **API Gateway 统一入口** (Nginx / Caddy)
   - 前端只访问一个地址 (`/api`)
   - Gateway 自动路由到可用的后端服务
   - 健康检查：`upstream` 模块自动剔除故障节点

2. **三层降级策略**
   - **L1 (实时)**：OpenClaw Gateway 直连（最新数据）
   - **L2 (缓存)**：API Bridge 5 分钟缓存（减轻 Gateway 压力）
   - **L3 (静态)**：Backup API 只读 JSON（最后可用数据）

3. **自愈机制**
   - Systemd / PM2 自动重启挂掉的服务
   - 前端自动检测 API 恢复，退出降级模式
   - cpolar 隧道监控脚本，断线自动重连

### 2.3 配置管理改进

#### 方案 1：服务端配置 API（推荐）

**问题**：前端检测环境不可靠（hostname 可能被代理修改）
**解决**：由服务端告诉前端正确的配置

```javascript
// 服务端：server/api-bridge.js
app.get('/api/config', (req, res) => {
    const config = {
        environment: process.env.NODE_ENV || 'production',
        apiBase: {
            openclaw: process.env.OPENCLAW_URL || 'http://localhost:18789',
            bridge: process.env.BRIDGE_URL || 'http://localhost:8082'
        },
        features: {
            fileBrowser: true,
            terminal: true,
            realtime: true
        },
        version: require('../package.json').version,
        deployedAt: new Date().toISOString()
    };
    res.json(config);
});

// 前端：src/config.js
class ErgoConfig {
    async init() {
        try {
            const res = await fetch('/api/config');
            const config = await res.json();
            this.API_BASE = config.apiBase.bridge;
            this.OPENCLAW_URL = config.apiBase.openclaw;
            this.FEATURES = config.features;
        } catch (error) {
            // 降级：使用客户端检测
            this.API_BASE = this.detectApiBase();
        }
    }
}
```

**优点**：
- ✅ 配置由服务端集中管理
- ✅ 前端无需检测环境
- ✅ 支持 A/B 测试和灰度发布
- ✅ 配置变更无需重新部署前端

#### 方案 2：环境变量 + 构建时注入

```bash
# .env.production
VITE_API_BASE=https://terryapi.cpolar.cn
VITE_OPENCLAW_URL=https://terrysopenclaw.cpolar.cn

# .env.development
VITE_API_BASE=http://localhost:8082
VITE_OPENCLAW_URL=http://localhost:18789
```

```javascript
// src/config.js (Vite 模式)
export const config = {
    API_BASE: import.meta.env.VITE_API_BASE,
    OPENCLAW_URL: import.meta.env.VITE_OPENCLAW_URL
};
```

**优点**：
- ✅ 构建时确定配置，性能最优
- ✅ 支持多环境部署（dev/staging/prod）
- ❌ 配置变更需要重新构建

#### 方案 3：配置文件 + 动态加载（推荐用于生产）

```json
// public/config.json (生产环境可直接编辑)
{
    "api": {
        "base": "https://terryapi.cpolar.cn",
        "openclaw": "https://terrysopenclaw.cpolar.cn",
        "timeout": 20000
    },
    "features": {
        "fileBrowser": true,
        "terminal": true,
        "realtime": true
    }
}
```

```javascript
// src/config.js
class ErgoConfig {
    async loadConfig() {
        const res = await fetch('/config.json?' + Date.now()); // 防缓存
        this.config = await res.json();
    }
}
```

**优点**：
- ✅ 运行时可修改配置，无需重新构建
- ✅ 支持 cpolar 域名变更（直接改 JSON）
- ✅ 配置集中管理
- ❌ 需要异步加载，启动略慢

### 2.4 健康检查与监控

#### 服务启动验证脚本

```bash
#!/bin/bash
# scripts/start-with-health-check.sh

echo "🚀 Starting Ergo services..."

# 启动 API Bridge
echo "[1/3] Starting API Bridge..."
node server/api-bridge.js > logs/api-bridge.log 2>&1 &
API_PID=$!

# 等待端口监听（最多 10 秒）
for i in {1..10}; do
    if curl -s http://localhost:8082/api/health > /dev/null; then
        echo "✅ API Bridge is healthy"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ API Bridge failed to start"
        kill $API_PID
        exit 1
    fi
    sleep 1
done

# 启动前端服务器
echo "[2/3] Starting Frontend Server..."
node server/frontend-with-proxy.js > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# 健康检查
for i in {1..10}; do
    if curl -s http://localhost:8081 > /dev/null; then
        echo "✅ Frontend Server is healthy"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Frontend Server failed to start"
        kill $API_PID $FRONTEND_PID
        exit 1
    fi
    sleep 1
done

# 检查 OpenClaw Gateway
echo "[3/3] Checking OpenClaw Gateway..."
if curl -s http://localhost:18789/api/health > /dev/null; then
    echo "✅ OpenClaw Gateway is healthy"
else
    echo "⚠️  OpenClaw Gateway is not running (optional)"
fi

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Ergo is ready!"
echo "════════════════════════════════════════════"
echo "  Frontend:  http://localhost:8081"
echo "  API:       http://localhost:8082"
echo "  Gateway:   http://localhost:18789"
echo ""
echo "  Logs:"
echo "  - API Bridge:  tail -f logs/api-bridge.log"
echo "  - Frontend:    tail -f logs/frontend.log"
echo "════════════════════════════════════════════"
```

#### 前端健康检查服务

```javascript
// src/health-checker.js
class HealthChecker {
    constructor() {
        this.status = {
            apiBridge: 'unknown',
            openclawGateway: 'unknown',
            lastCheck: null
        };
        this.listeners = [];
    }

    async check() {
        const results = await Promise.allSettled([
            this.checkApiBridge(),
            this.checkOpenClawGateway()
        ]);

        this.status = {
            apiBridge: results[0].status === 'fulfilled' ? results[0].value : 'unhealthy',
            openclawGateway: results[1].status === 'fulfilled' ? results[1].value : 'unhealthy',
            lastCheck: new Date().toISOString()
        };

        this.notifyListeners();
        return this.status;
    }

    async checkApiBridge() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        try {
            const res = await fetch(`${ergoConfig.API_BASE}/api/health`, {
                signal: controller.signal
            });
            clearTimeout(timeout);
            return res.ok ? 'healthy' : 'unhealthy';
        } catch {
            return 'unhealthy';
        }
    }

    async checkOpenClawGateway() {
        // 类似逻辑
    }

    startPolling(interval = 5000) {
        this.check(); // 立即检查一次
        this.intervalId = setInterval(() => this.check(), interval);
    }

    stopPolling() {
        clearInterval(this.intervalId);
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => cb(this.status));
    }
}

// 使用
const healthChecker = new HealthChecker();
healthChecker.onChange(status => {
    // 更新 UI 健康状态指示器
    updateHealthIndicator(status);

    // 如果 API Bridge 挂了，切换到降级模式
    if (status.apiBridge === 'unhealthy') {
        enableDegradedMode();
    }
});
healthChecker.startPolling();
```

### 2.5 cpolar 隧道管理

#### 配置持久化

```yaml
# ~/.cpolar/cpolar.yml
version: "2"
authtoken: YOUR_AUTH_TOKEN

tunnels:
  ergo-frontend:
    addr: 8081
    proto: http
    subdomain: terryzin  # 需要 Pro 版保留域名
    inspect: true

  ergo-api:
    addr: 8082
    proto: http
    subdomain: terryapi  # 需要 Pro 版保留域名
    inspect: true

  openclaw-gateway:
    addr: 18789
    proto: http
    subdomain: terrysopenclaw  # 需要 Pro 版保留域名
    inspect: true
```

#### 隧道健康监控脚本

```bash
#!/bin/bash
# scripts/cpolar-health-check.sh

# 检查 cpolar 是否运行
if ! pgrep -x "cpolar" > /dev/null; then
    echo "❌ cpolar is not running"
    # 尝试重启
    cpolar start-all &
    sleep 5
fi

# 检查隧道状态
TUNNELS=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[].public_url')

if [ -z "$TUNNELS" ]; then
    echo "❌ No active tunnels"
    exit 1
fi

echo "✅ Active tunnels:"
echo "$TUNNELS"
```

#### 自动重连服务（Systemd）

```ini
# /etc/systemd/system/cpolar.service
[Unit]
Description=Cpolar Tunnel Service
After=network.target

[Service]
Type=simple
User=terry
WorkingDirectory=/home/terry
ExecStart=/usr/local/bin/cpolar start-all
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

---

## 三、运维最佳实践

### 3.1 故障定位流程

```
用户报告："Ergo 打不开"
  ↓
1. 检查前端是否可访问
   ├─ 是 → 前端正常，检查 API
   └─ 否 → 检查 cpolar 隧道 / Python http.server
  ↓
2. 检查 API Bridge 健康状态
   $ curl http://localhost:8082/api/health
   ├─ 200 OK → API 正常，检查 OpenClaw Gateway
   └─ 连接失败 → 重启 API Bridge
  ↓
3. 检查 OpenClaw Gateway
   $ curl http://localhost:18789/api/health
   ├─ 200 OK → 所有服务正常，检查前端配置
   └─ 连接失败 → 检查 openclaw 进程
  ↓
4. 检查 cpolar 隧道
   $ curl http://localhost:4040/api/tunnels
   ├─ 有活跃隧道 → cpolar 正常
   └─ 无隧道 → 重启 cpolar
  ↓
5. 检查日志
   $ tail -f logs/api-bridge.log
   $ tail -f logs/frontend.log
   $ journalctl -u cpolar -f
```

### 3.2 监控指标（Metrics）

| 指标 | 采集方式 | 告警阈值 |
|------|---------|---------|
| **API Bridge 可用性** | `/api/health` | < 95% 告警 |
| **OpenClaw Gateway 可用性** | `/api/health` | < 90% 告警 |
| **API 响应时间** | 中间件日志 | > 5s 告警 |
| **cpolar 隧道状态** | cpolar API | 任意隧道断开立即告警 |
| **前端加载时间** | 浏览器 Performance API | > 3s 告警 |
| **错误率** | 前端错误上报 | > 5% 告警 |

### 3.3 日志管理

#### 统一日志格式（JSON Lines）

```javascript
// server/api-bridge.js
const logger = {
    info: (msg, meta = {}) => {
        console.log(JSON.stringify({
            level: 'info',
            timestamp: new Date().toISOString(),
            message: msg,
            ...meta
        }));
    },
    error: (msg, error, meta = {}) => {
        console.error(JSON.stringify({
            level: 'error',
            timestamp: new Date().toISOString(),
            message: msg,
            error: error.message,
            stack: error.stack,
            ...meta
        }));
    }
};

// 使用
app.get('/api/status', async (req, res) => {
    const start = Date.now();
    logger.info('API request received', { endpoint: '/api/status', ip: req.ip });

    try {
        const data = await fetchStatus();
        const latency = Date.now() - start;
        logger.info('API request completed', { endpoint: '/api/status', latency });
        res.json(data);
    } catch (error) {
        logger.error('API request failed', error, { endpoint: '/api/status' });
        res.status(500).json({ error: error.message });
    }
});
```

#### 日志聚合（推荐工具）

- **本地开发**：`tail -f logs/*.log | jq`
- **生产环境**：
  - Grafana Loki（轻量级，推荐）
  - ELK Stack（功能强大，但重）
  - Datadog / New Relic（SaaS）

### 3.4 部署检查清单

#### 首次部署

- [ ] 配置 cpolar 隧道并保存域名
- [ ] 创建 `config.json` 并填入正确的域名
- [ ] 运行 `npm install` 安装依赖
- [ ] 运行 `npm test` 确保测试通过
- [ ] 运行 `start-ergo.bat` 启动服务
- [ ] 检查所有端口监听成功（8081, 8082, 18789）
- [ ] 访问 cpolar 隧道域名，验证可访问
- [ ] 运行 `scripts/health-check.sh` 验证所有服务健康

#### 日常更新

- [ ] 拉取最新代码 `git pull`
- [ ] 检查配置文件是否需要更新
- [ ] 运行 `npm test` 确保没有 regression
- [ ] 重启服务 `npm run restart`
- [ ] 检查健康状态 `npm run health-check`
- [ ] 验证核心功能可用（手动抽样测试）

#### cpolar 域名变更（免费版）

- [ ] 记录新的隧道域名
- [ ] 更新 `config.json`（如果使用配置文件方案）
- [ ] 或更新 `.env.production`（如果使用环境变量方案）
- [ ] 重启前端服务（如果配置在构建时注入）
- [ ] 验证外网可访问

---

## 四、改进路线图

### Phase 1: 止血修复（1-2 天）⭐ 最高优先级

**目标**：消除最频繁的故障点，降低 MTTR

- [ ] **配置统一化**
  - 创建 `/api/config` 端点
  - 前端从 API 获取配置，移除客户端环境检测
  - 所有页面使用统一的配置服务

- [ ] **启动健康检查**
  - 重写 `start-ergo.bat`，增加端口监听验证
  - 服务启动失败时明确报错，而不是静默失败

- [ ] **前端降级策略**
  - API 不可用时显示明确的错误状态（而不是白屏）
  - 展示缓存数据 + 提示"数据可能已过期"

### Phase 2: 架构重构（1 周）

**目标**：消除单点故障，实现自愈

- [ ] **引入 API Gateway**
  - 使用 Nginx / Caddy 统一入口
  - 配置 upstream 健康检查
  - 自动故障切换

- [ ] **实现 Backup API**
  - 每 5 分钟导出状态数据到 JSON
  - Backup API 服务只读 JSON（极简服务，不依赖 OpenClaw）

- [ ] **前端健康检查服务**
  - 实时检测 API 可用性
  - 自动切换降级模式
  - 显示健康状态指示器

### Phase 3: 运维自动化（1 周）

**目标**：实现自动故障恢复，减少人工干预

- [ ] **服务自动重启**
  - Systemd / PM2 管理服务生命周期
  - 进程异常退出自动重启

- [ ] **cpolar 隧道监控**
  - 每分钟检查隧道状态
  - 断线自动重连

- [ ] **监控告警**
  - 集成 Grafana + Prometheus
  - 关键指标告警（可用性、延迟、错误率）

### Phase 4: 可观测性（2 周）

**目标**：问题发生时快速定位

- [ ] **日志聚合**
  - 统一 JSON 日志格式
  - 部署 Grafana Loki

- [ ] **分布式追踪**
  - 为每个请求生成 Trace ID
  - 追踪请求跨服务调用路径

- [ ] **性能监控**
  - 前端 Performance API 数据上报
  - API 响应时间分布统计

---

## 五、技术决策记录（ADR）

### ADR-001: 配置管理方案选择

**上下文**：
当前配置分散在 5+ 个文件，cpolar 域名变更需要改代码。

**决策**：
采用 **服务端配置 API + 运行时配置文件** 混合方案。

**理由**：
- 服务端配置 API 解决前端环境检测不可靠问题
- 运行时配置文件支持 cpolar 域名变更无需重新构建
- 配置集中管理，降低维护成本

**替代方案**：
- ❌ 客户端环境检测：不可靠，hostname 可能被代理修改
- ❌ 构建时注入：cpolar 域名变更需要重新构建

### ADR-002: 架构演进 - 引入 API Gateway

**上下文**：
多个后端服务（API Bridge, OpenClaw Gateway），前端配置复杂。

**决策**：
引入 Nginx 作为 API Gateway 统一入口。

**理由**：
- 简化前端配置（只需连接一个地址）
- Nginx upstream 模块自动健康检查 + 故障切换
- 未来支持灰度发布、A/B 测试

**技术选型**：
- Nginx（推荐）- 成熟稳定，配置简单
- Caddy - 自动 HTTPS，配置更简洁
- Traefik - 容器化环境首选

### ADR-003: 降级策略 - 三层数据源

**上下文**：
API 不可用时前端完全白屏，用户体验差。

**决策**：
实现三层降级：实时 → 缓存 → 静态备份。

**理由**：
- L1 实时数据：正常情况下最新数据
- L2 缓存数据：API 短暂不可用时展示
- L3 静态备份：长时间故障时至少显示历史数据

**实现**：
- 前端 localStorage 缓存 5 分钟
- Backup API 每 5 分钟导出 JSON 快照

---

## 六、总结

### 当前架构的核心问题

1. **单点故障多**：5 个单点，3 个需手动恢复
2. **配置地狱**：5 个文件、3 种环境检测规则
3. **无降级策略**：API 挂了前端白屏
4. **缺乏自愈**：服务异常需手动重启

### 改进后的架构优势

1. **高可用**：API Gateway + 三层降级，故障影响半径从 100% → 30%
2. **配置简单**：服务端配置 API，前端无需检测环境
3. **自愈能力**：Systemd 自动重启 + cpolar 监控自动重连
4. **可观测**：统一日志 + 监控告警，MTTR 从 10min → 30s

### 关键指标改进目标

| 指标 | 当前 | 目标 |
|------|------|------|
| **可用性** | ~85% (手动运维) | > 99.5% (自动化) |
| **MTTR** | 10 分钟（手动定位 + 重启） | 30 秒（自动恢复） |
| **配置变更时间** | 20 分钟（改代码 + 部署） | 2 分钟（改配置 + 重启） |
| **故障影响半径** | 100%（单点故障） | < 30%（降级可用） |

### 下一步行动

1. **立即执行 Phase 1**（止血修复）- 消除最频繁的问题
2. **规划 Phase 2**（架构重构）- 和团队讨论 API Gateway 方案
3. **准备 Phase 3**（运维自动化）- 调研 Systemd / PM2

---

**文档版本**: v1.0
**最后更新**: 2026-02-21
**审阅者**: 产品设计总监、全栈工程师、QA 工程师
**状态**: ✅ 已完成，待评审
