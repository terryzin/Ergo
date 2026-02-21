# Ergo 运维手册

**版本**: v1.0
**作者**: CTO
**日期**: 2026-02-21

---

## 一、运维哲学

### You Build It, You Run It

这个系统没有"运维团队"，开发者就是运维者。你写的代码你负责生产环境。

**核心原则**：
1. **预防优于治疗** - 设计系统时就考虑故障模式
2. **自动化一切** - 手动操作必然出错，写脚本！
3. **可观测性第一** - 问题发生时必须快速定位
4. **降级优于宕机** - 部分功能不可用好过整站挂掉

### Everything Fails, All the Time

不要问"这个会挂吗"，而要问"这个挂了会怎样"。

---

## 二、系统架构概览

### 组件拓扑

```
外网用户
  │
  ├─ cpolar 隧道 (terryzin.cpolar.cn)
  │   └─ localhost:8081 (前端)
  │       └─ Express 服务器
  │           └─ 静态文件 (HTML/CSS/JS)
  │
  ├─ cpolar 隧道 (terryapi.cpolar.cn)  ← 可选
  │   └─ localhost:8082 (API Bridge)
  │       └─ Express API 服务器
  │           └─ exec openclaw CLI
  │
  └─ cpolar 隧道 (terrysopenclaw.cpolar.cn)
      └─ localhost:18789 (OpenClaw Gateway)
          └─ OpenClaw WebUI + API
```

### 依赖关系

```
前端 (8081)
  │
  ├─ 依赖 → API Bridge (8082)  [可选，有降级策略]
  │   └─ 依赖 → OpenClaw CLI
  │
  └─ 依赖 → OpenClaw Gateway (18789)  [必需]
      └─ 依赖 → OpenClaw 守护进程
```

**关键点**：
- 前端可以直接调用 OpenClaw Gateway，API Bridge 是增强功能层
- API Bridge 挂了，核心功能（状态、Agent、Cron）仍可用
- OpenClaw Gateway 挂了，整个系统降级为"只读模式"

---

## 三、日常运维任务

### 3.1 启动服务

#### 完整启动（推荐）

```bash
# 1. 进入项目目录
cd D:\.openclaw\workspace\my-dashboard

# 2. 启动所有服务
./start-ergo.bat

# 输出示例：
# [1/3] 启动 API Bridge (http://localhost:8082)...
# [2/3] 启动自动配对监听器...
# [3/3] 启动 Ergo 前端+代理 (http://localhost:8081)...
#
# ════════════════════════════════════════════
#   Ergo 已启动！
# ════════════════════════════════════════════
```

#### 单独启动组件

```bash
# 只启动前端（用于前端开发）
node server/frontend-with-proxy.js

# 只启动 API Bridge（用于后端调试）
node server/api-bridge.js

# 只启动自动配对监听器
node server/auto-pairing-watcher.js
```

#### 启动 cpolar 隧道

```bash
# 方式 1: 启动所有隧道（推荐）
cpolar start-all

# 方式 2: 单独启动
cpolar start ergo-frontend
cpolar start ergo-api
cpolar start openclaw-gateway

# 后台运行
nohup cpolar start-all > logs/cpolar.log 2>&1 &
```

### 3.2 停止服务

```bash
# Windows: Ctrl+C 停止前台进程

# 或查找并杀死进程
tasklist | findstr node
taskkill /F /PID <PID>

# Linux/macOS
pkill -f "node server"
pkill cpolar
```

### 3.3 健康检查

#### 自动健康检查脚本

```bash
# scripts/health-check.sh
#!/bin/bash

echo "🔍 Ergo Health Check"
echo "════════════════════════════════════════════"

# 1. 检查前端服务
echo -n "[1/4] Frontend (8081)... "
if curl -sf http://localhost:8081 > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
fi

# 2. 检查 API Bridge
echo -n "[2/4] API Bridge (8082)... "
if curl -sf http://localhost:8082/api/health > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
fi

# 3. 检查 OpenClaw Gateway
echo -n "[3/4] OpenClaw Gateway (18789)... "
if curl -sf http://localhost:18789/api/health > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
fi

# 4. 检查 cpolar 隧道
echo -n "[4/4] Cpolar Tunnels... "
TUNNEL_COUNT=$(curl -sf http://localhost:4040/api/tunnels 2>/dev/null | jq '.tunnels | length' 2>/dev/null || echo "0")
if [ "$TUNNEL_COUNT" -ge 2 ]; then
    echo "✅ ($TUNNEL_COUNT active)"
else
    echo "❌ ($TUNNEL_COUNT active)"
fi

echo "════════════════════════════════════════════"
```

运行方式：
```bash
chmod +x scripts/health-check.sh
./scripts/health-check.sh
```

#### 手动检查清单

| 组件 | 检查命令 | 预期结果 |
|------|---------|---------|
| **前端** | `curl http://localhost:8081` | HTTP 200 + HTML |
| **API Bridge** | `curl http://localhost:8082/api/health` | `{"status":"ok"}` |
| **OpenClaw GW** | `curl http://localhost:18789/api/health` | `{"status":"ok"}` |
| **cpolar** | `curl http://localhost:4040/api/tunnels` | 包含 `tunnels` 数组 |

### 3.4 日志查看

#### 实时日志

```bash
# API Bridge 日志
tail -f logs/api-bridge.log

# 前端服务器日志
tail -f logs/frontend.log

# cpolar 日志
tail -f logs/cpolar.log

# OpenClaw Gateway 日志（如果有配置）
tail -f ~/.openclaw/logs/gateway.log
```

#### 日志过滤

```bash
# 只看错误
tail -f logs/api-bridge.log | grep -i error

# 只看特定 API
tail -f logs/api-bridge.log | grep "/api/status"

# 统计请求量
tail -f logs/api-bridge.log | grep "API request" | wc -l
```

### 3.5 监控指标

#### 关键指标

| 指标 | 采集方式 | 告警阈值 |
|------|---------|---------|
| **前端可用性** | `curl http://localhost:8081` | < 95% 告警 |
| **API 可用性** | `curl http://localhost:8082/api/health` | < 95% 告警 |
| **API 响应时间** | 日志分析 | > 5s 告警 |
| **错误率** | 日志统计 | > 5% 告警 |
| **cpolar 隧道数量** | cpolar API | < 2 立即告警 |

#### 指标采集脚本

```bash
#!/bin/bash
# scripts/collect-metrics.sh

while true; do
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # 前端可用性
    FRONTEND_UP=$(curl -sf http://localhost:8081 > /dev/null 2>&1 && echo "1" || echo "0")

    # API 可用性
    API_UP=$(curl -sf http://localhost:8082/api/health > /dev/null 2>&1 && echo "1" || echo "0")

    # Gateway 可用性
    GW_UP=$(curl -sf http://localhost:18789/api/health > /dev/null 2>&1 && echo "1" || echo "0")

    # cpolar 隧道数量
    TUNNEL_COUNT=$(curl -sf http://localhost:4040/api/tunnels 2>/dev/null | jq '.tunnels | length' 2>/dev/null || echo "0")

    # 输出为 JSON Lines（可导入到 Grafana Loki）
    echo "{\"timestamp\":\"$TIMESTAMP\",\"frontend_up\":$FRONTEND_UP,\"api_up\":$API_UP,\"gateway_up\":$GW_UP,\"tunnel_count\":$TUNNEL_COUNT}" >> logs/metrics.jsonl

    sleep 60  # 每分钟采集一次
done
```

---

## 四、故障定位流程

### 4.1 决策树

```
用户报告："Ergo 打不开"
  │
  ├─ 1. 检查前端是否可访问
  │   ├─ YES → 前端正常，检查 API
  │   └─ NO → 检查 cpolar 隧道 / 前端服务器
  │
  ├─ 2. 检查 API Bridge 健康状态
  │   ├─ YES → API 正常，检查 OpenClaw Gateway
  │   └─ NO → 重启 API Bridge
  │
  ├─ 3. 检查 OpenClaw Gateway
  │   ├─ YES → 所有服务正常，检查前端配置
  │   └─ NO → 检查 openclaw 进程
  │
  └─ 4. 检查 cpolar 隧道
      ├─ YES → cpolar 正常
      └─ NO → 重启 cpolar
```

### 4.2 快速诊断命令

```bash
#!/bin/bash
# scripts/quick-diagnose.sh

echo "🔍 Quick Diagnose"
echo "════════════════════════════════════════════"

# 1. 端口监听检查
echo "Listening Ports:"
netstat -tuln | grep -E ":(8081|8082|18789|4040)" || echo "  None"

# 2. 进程检查
echo ""
echo "Running Processes:"
ps aux | grep -E "(node|cpolar|openclaw)" | grep -v grep || echo "  None"

# 3. 最近的错误日志
echo ""
echo "Recent Errors (last 10):"
tail -100 logs/*.log 2>/dev/null | grep -i error | tail -10 || echo "  None"

# 4. cpolar 隧道状态
echo ""
echo "Cpolar Tunnels:"
curl -s http://localhost:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[] | "  - \(.name): \(.public_url)"' || echo "  Cpolar not running"

echo "════════════════════════════════════════════"
```

### 4.3 常见故障场景

#### 场景 1：前端白屏，状态全部显示 `--`

**症状**：
- 前端页面能打开
- 所有 KPI 显示 `--`
- 浏览器控制台报错：`Failed to fetch`

**诊断**：
```bash
# 1. 检查 API Bridge 是否运行
curl http://localhost:8082/api/health

# 2. 检查是否端口冲突
netstat -tuln | grep 8082

# 3. 查看 API Bridge 日志
tail -50 logs/api-bridge.log
```

**可能原因**：
- API Bridge 未启动
- API Bridge 端口被占用
- API Bridge 崩溃（查看日志）

**解决方案**：
```bash
# 杀死占用 8082 端口的进程
lsof -ti:8082 | xargs kill -9

# 重启 API Bridge
node server/api-bridge.js > logs/api-bridge.log 2>&1 &

# 等待 5 秒后检查
sleep 5
curl http://localhost:8082/api/health
```

#### 场景 2：外网无法访问（本地正常）

**症状**：
- 本地访问 `http://localhost:8081` 正常
- 外网访问 cpolar 域名失败（ERR_CONNECTION_REFUSED）

**诊断**：
```bash
# 1. 检查 cpolar 是否运行
pgrep cpolar || echo "cpolar not running"

# 2. 检查隧道状态
curl http://localhost:4040/api/tunnels

# 3. 测试公网 URL
curl https://terryzin.cpolar.cn
```

**可能原因**：
- cpolar 未启动
- cpolar 隧道未启动
- 免费版域名变更（非保留域名）

**解决方案**：
```bash
# 启动 cpolar
cpolar start-all

# 查看新的公网域名
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | "\(.name): \(.public_url)"'

# 如果是免费版，复制新域名并更新配置
```

#### 场景 3：API 请求超时

**症状**：
- API 请求超过 20 秒无响应
- 浏览器控制台报错：`Timeout`

**诊断**：
```bash
# 1. 手动测试 API 响应时间
time curl http://localhost:8082/api/status

# 2. 检查 OpenClaw CLI 是否卡住
ps aux | grep openclaw

# 3. 查看 API Bridge 日志
tail -50 logs/api-bridge.log | grep "openclaw CLI"
```

**可能原因**：
- OpenClaw CLI 执行时间过长（正常，首次执行需 10-15 秒）
- OpenClaw 守护进程未运行
- 系统资源不足（CPU/内存）

**解决方案**：
```bash
# 1. 检查 OpenClaw 守护进程
ps aux | grep "openclaw daemon"

# 2. 如果未运行，启动守护进程
openclaw daemon start

# 3. 等待守护进程启动后，刷新数据
curl http://localhost:8082/api/status/refresh
```

#### 场景 4：配置错误，环境检测误判

**症状**：
- 本地访问时，前端请求 API 使用了相对路径（而非 `http://localhost:8082`）
- 或外网访问时，前端请求硬编码的 `localhost`

**诊断**：
```bash
# 1. 查看前端配置
curl http://localhost:8081/src/config.js

# 2. 检查 hostname 检测逻辑
# 打开浏览器控制台，运行：
window.location.hostname  # 应该是 "localhost" 或 cpolar 域名
```

**可能原因**：
- `src/config.js` 环境检测规则不完善
- 使用了 `127.0.0.1` 而非 `localhost`（导致检测失败）

**解决方案**：
```javascript
// 修改 src/config.js
detectApiBase() {
    const hostname = window.location.hostname;

    // ✅ 正确：检测本地环境
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8082';
    }

    // ✅ 正确：检测 cpolar 域名
    if (hostname.includes('cpolar.cn')) {
        return 'https://terryapi.cpolar.cn';  // 或使用相对路径
    }

    // 其他情况：相对路径
    return '';
}
```

#### 场景 5：浏览器缓存旧版本

**症状**：
- 部署新版本后，用户仍然看到旧版本
- 控制台报错：`Unexpected token` 或 API 字段不匹配

**诊断**：
```bash
# 1. 检查 HTML 是否有缓存控制头
curl -I http://localhost:8081/index.html | grep -i cache

# 2. 打开浏览器开发者工具 → Network → 勾选 "Disable cache"
```

**可能原因**：
- HTML 文件被浏览器缓存
- 缺少缓存控制头

**解决方案**：
```javascript
// server/frontend-with-proxy.js
app.use((req, res, next) => {
    // 为 HTML 文件设置不缓存
    if (req.path.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
});
```

或强制刷新浏览器缓存：`Ctrl + F5` (Windows) / `Cmd + Shift + R` (macOS)

---

## 五、维护任务

### 5.1 日志轮转

```bash
#!/bin/bash
# scripts/rotate-logs.sh
# 每天运行一次，保留最近 7 天的日志

LOG_DIR="logs"
RETENTION_DAYS=7

find "$LOG_DIR" -name "*.log" -mtime +$RETENTION_DAYS -exec gzip {} \;
find "$LOG_DIR" -name "*.log.gz" -mtime +30 -delete

echo "✅ Log rotation completed"
```

添加到 crontab：
```bash
# 每天凌晨 3 点执行
0 3 * * * /path/to/my-dashboard/scripts/rotate-logs.sh
```

### 5.2 数据备份

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# 备份配置文件
cp src/config.js "$BACKUP_DIR/"
cp package.json "$BACKUP_DIR/"
cp ~/.cpolar/cpolar.yml "$BACKUP_DIR/" 2>/dev/null || true

# 备份数据
cp data/projects.json "$BACKUP_DIR/" 2>/dev/null || true

# 备份日志（最近 1 天）
find logs -name "*.log" -mtime -1 -exec cp {} "$BACKUP_DIR/" \;

# 压缩
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "✅ Backup created: $BACKUP_DIR.tar.gz"
```

### 5.3 更新部署

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Deploying Ergo..."

# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖（如果有变化）
npm install

# 3. 运行测试
npm test

# 4. 备份当前运行的服务
ps aux | grep "node server" > /tmp/ergo-processes.txt

# 5. 停止旧服务
pkill -f "node server" || true

# 6. 启动新服务
./start-ergo.sh

# 7. 健康检查
sleep 10
./scripts/health-check.sh

echo "✅ Deployment completed!"
```

### 5.4 性能优化

#### 检查响应时间

```bash
#!/bin/bash
# scripts/perf-check.sh

echo "⚡ Performance Check"
echo "════════════════════════════════════════════"

# 测试前端加载时间
echo -n "Frontend (8081)... "
time curl -sf http://localhost:8081 > /dev/null

# 测试 API 响应时间
echo -n "API /status (cached)... "
time curl -sf http://localhost:8082/api/status > /dev/null

echo -n "API /status (refresh)... "
time curl -sf http://localhost:8082/api/status/refresh > /dev/null

echo "════════════════════════════════════════════"
```

#### 缓存策略

```javascript
// server/api-bridge.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 分钟

app.get('/api/status', async (req, res) => {
    const cacheKey = 'status';

    // 尝试从缓存读取
    const cached = cache.get(cacheKey);
    if (cached) {
        return res.json({ ...cached, _cached: true });
    }

    // 缓存未命中，执行 CLI
    const data = await fetchStatusFromCLI();
    cache.set(cacheKey, data);

    res.json({ ...data, _cached: false });
});
```

---

## 六、监控与告警

### 6.1 Uptime 监控

使用第三方服务监控外网可用性：

- **UptimeRobot**（免费版支持 50 个监控）
- **Pingdom**
- **Freshping**

监控 URL：
- `https://terryzin.cpolar.cn` (前端)
- `https://terryapi.cpolar.cn/api/health` (API)
- `https://terrysopenclaw.cpolar.cn/api/health` (Gateway)

告警渠道：
- Email
- Slack
- 钉钉 Webhook

### 6.2 日志监控

```bash
#!/bin/bash
# scripts/log-monitor.sh
# 监控日志中的错误，发送告警

ERROR_THRESHOLD=10  # 10 个错误/分钟触发告警

while true; do
    ERROR_COUNT=$(tail -1000 logs/api-bridge.log | grep -i error | wc -l)

    if [ "$ERROR_COUNT" -gt "$ERROR_THRESHOLD" ]; then
        # 发送告警（示例：发送邮件）
        echo "⚠️  High error rate: $ERROR_COUNT errors in last 1000 lines" | \
            mail -s "[Ergo Alert] High Error Rate" admin@example.com
    fi

    sleep 60
done
```

### 6.3 Grafana 仪表盘（推荐）

```yaml
# docker-compose.yml
version: '3'
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./logs:/var/log/ergo
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

volumes:
  grafana-data:
```

访问 `http://localhost:3000`，使用日志查询：
```logql
{job="ergo"} |= "error"
```

---

## 七、应急预案

### 7.1 服务完全宕机

**应急流程**：
1. 检查所有进程是否运行
2. 检查端口是否监听
3. 查看最近的错误日志
4. 尝试重启所有服务
5. 如果仍无法恢复，回滚到上一个稳定版本

```bash
#!/bin/bash
# scripts/emergency-restart.sh

echo "🚨 Emergency Restart"

# 杀死所有相关进程
pkill -f "node server"
pkill cpolar

# 等待进程完全退出
sleep 5

# 清理锁文件
rm -f ~/.cpolar/cpolar.lock

# 重启服务
./start-ergo.sh

# 重启 cpolar
cpolar start-all

# 健康检查
sleep 15
./scripts/health-check.sh
```

### 7.2 数据损坏

**应急流程**：
1. 停止所有服务
2. 恢复最近的备份
3. 验证数据完整性
4. 重启服务

```bash
#!/bin/bash
# scripts/restore-backup.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    exit 1
fi

# 停止服务
pkill -f "node server"

# 解压备份
tar -xzf "$BACKUP_FILE" -C /tmp

# 恢复配置
cp /tmp/backup-*/config.js src/
cp /tmp/backup-*/projects.json data/

# 重启服务
./start-ergo.sh

echo "✅ Restore completed"
```

### 7.3 cpolar 域名失效（免费版）

**应急流程**：
1. 获取新的公网域名
2. 更新前端配置（如果硬编码了）
3. 通知用户使用新域名

```bash
#!/bin/bash
# scripts/update-cpolar-domains.sh

echo "📋 Current Cpolar Domains:"
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | "\(.name): \(.public_url)"'

echo ""
echo "Update these URLs in:"
echo "  - src/config.js (if hardcoded)"
echo "  - config.json (if using config file)"
echo "  - CPOLAR_SETUP.md (documentation)"
```

---

## 八、总结

### 运维清单

#### 每天
- [ ] 检查服务健康状态（`./scripts/health-check.sh`）
- [ ] 查看错误日志（`tail -100 logs/*.log | grep -i error`）
- [ ] 检查 cpolar 隧道状态

#### 每周
- [ ] 运行性能测试（`./scripts/perf-check.sh`）
- [ ] 检查磁盘空间（`df -h`）
- [ ] 轮转日志（`./scripts/rotate-logs.sh`）

#### 每月
- [ ] 备份数据和配置（`./scripts/backup.sh`）
- [ ] 更新依赖包（`npm outdated` → `npm update`）
- [ ] 审查监控数据，优化性能

### 关键脚本索引

| 脚本 | 用途 | 频率 |
|------|------|------|
| `health-check.sh` | 健康检查 | 每天 |
| `quick-diagnose.sh` | 快速诊断 | 故障时 |
| `emergency-restart.sh` | 应急重启 | 紧急情况 |
| `backup.sh` | 数据备份 | 每天 |
| `deploy.sh` | 部署更新 | 发版时 |
| `rotate-logs.sh` | 日志轮转 | 每天 |
| `collect-metrics.sh` | 指标采集 | 持续运行 |

### 联系方式

- **技术支持**: [GitHub Issues](https://github.com/your-repo/issues)
- **紧急联系**: admin@example.com
- **文档更新**: 发现问题请更新本文档

---

**文档版本**: v1.0
**最后更新**: 2026-02-21
