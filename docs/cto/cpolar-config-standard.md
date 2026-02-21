# Cpolar 配置标准

**版本**: v1.0
**作者**: CTO
**日期**: 2026-02-21

---

## 一、配置原则

### 1.1 Boring Technology 原则

优先使用 cpolar 原生配置能力，不要自己造轮子。

- ✅ 使用 cpolar 配置文件 (`cpolar.yml`)
- ✅ 使用 cpolar 保留域名功能（需 Pro 版）
- ❌ 不要自己写反向代理（除非 cpolar 确实无法满足）

### 1.2 配置即代码（Configuration as Code）

所有配置必须版本控制，可复现部署。

- ✅ 配置文件纳入 Git（敏感信息除外）
- ✅ 文档化配置逻辑
- ✅ 提供配置验证脚本

### 1.3 故障隔离原则

每个服务独立隧道，避免单点故障。

- ✅ 前端 (8081) 独立隧道
- ✅ API Bridge (8082) 独立隧道
- ✅ OpenClaw Gateway (18789) 独立隧道

---

## 二、标准配置文件

### 2.1 cpolar 配置（~/.cpolar/cpolar.yml）

```yaml
# Cpolar 配置文件
# 位置: ~/.cpolar/cpolar.yml (Linux/macOS)
#       C:\Users\{Username}\.cpolar\cpolar.yml (Windows)

version: "2"

# 认证 Token（从 cpolar 官网获取）
authtoken: YOUR_AUTH_TOKEN_HERE

# Web UI 配置
web_addr: localhost:4040
inspect_db_size: 50000000  # 50MB

# 日志配置
log_level: info
log_format: json
log: logs/cpolar.log

# 隧道定义
tunnels:
  # Ergo 前端静态文件服务
  ergo-frontend:
    addr: 8081
    proto: http
    # 保留域名（需 Pro 版）
    subdomain: terryzin
    # 地区选择
    region: cn_vip  # 或 cn, us, eu
    # 开启 Web Inspector（调试用）
    inspect: true
    # 自定义响应头
    host_header: rewrite

  # Ergo API Bridge
  ergo-api:
    addr: 8082
    proto: http
    subdomain: terryapi
    region: cn_vip
    inspect: true
    host_header: rewrite

  # OpenClaw Gateway
  openclaw-gateway:
    addr: 18789
    proto: http
    subdomain: terrysopenclaw
    region: cn_vip
    inspect: true
    host_header: rewrite
```

### 2.2 配置说明

#### authtoken（必需）

- **获取方式**: 登录 cpolar.com → 个人中心 → Authtoken
- **安全**: 不要提交到 Git，使用环境变量或配置模板

#### 域名配置（subdomain）

| 服务 | 端口 | 子域名 | 完整域名 | 用途 |
|------|------|--------|---------|------|
| Ergo 前端 | 8081 | `terryzin` | `https://terryzin.cpolar.cn` | 静态文件服务 |
| API Bridge | 8082 | `terryapi` | `https://terryapi.cpolar.cn` | API 接口 |
| OpenClaw GW | 18789 | `terrysopenclaw` | `https://terrysopenclaw.cpolar.cn` | OpenClaw 管理 |

⚠️ **注意**：
- 免费版每次重启域名会变化
- Pro 版可以保留自定义子域名
- 免费版最多同时运行 2 个隧道，Pro 版无限制

#### 地区选择（region）

- `cn_vip` - 中国 VIP 节点（Pro 版，最快）
- `cn` - 中国普通节点（免费版）
- `us` - 美国节点
- `eu` - 欧洲节点

建议：国内用户选择 `cn_vip` 或 `cn`

#### Web Inspector（inspect）

- `true` - 启用 HTTP 请求监控（可在 `http://localhost:4040` 查看）
- `false` - 禁用（生产环境建议禁用）

---

## 三、配置模板系统

### 3.1 配置模板（cpolar.yml.template）

```yaml
# Cpolar 配置模板
# 使用方式: cp cpolar.yml.template ~/.cpolar/cpolar.yml
#          然后编辑 authtoken

version: "2"
authtoken: ${CPOLAR_AUTHTOKEN}  # 从环境变量读取

tunnels:
  ergo-frontend:
    addr: ${ERGO_FRONTEND_PORT:-8081}
    proto: http
    subdomain: ${ERGO_FRONTEND_SUBDOMAIN:-terryzin}
    region: cn_vip

  ergo-api:
    addr: ${ERGO_API_PORT:-8082}
    proto: http
    subdomain: ${ERGO_API_SUBDOMAIN:-terryapi}
    region: cn_vip

  openclaw-gateway:
    addr: ${OPENCLAW_PORT:-18789}
    proto: http
    subdomain: ${OPENCLAW_SUBDOMAIN:-terrysopenclaw}
    region: cn_vip
```

### 3.2 环境变量配置（.env）

```bash
# Cpolar 配置
CPOLAR_AUTHTOKEN=your_token_here
ERGO_FRONTEND_PORT=8081
ERGO_FRONTEND_SUBDOMAIN=terryzin
ERGO_API_PORT=8082
ERGO_API_SUBDOMAIN=terryapi
OPENCLAW_PORT=18789
OPENCLAW_SUBDOMAIN=terrysopenclaw
```

### 3.3 配置生成脚本

```bash
#!/bin/bash
# scripts/generate-cpolar-config.sh

set -e

# 检查环境变量
if [ -z "$CPOLAR_AUTHTOKEN" ]; then
    echo "❌ Error: CPOLAR_AUTHTOKEN not set"
    echo "Please set your cpolar authtoken:"
    echo "  export CPOLAR_AUTHTOKEN=your_token_here"
    exit 1
fi

# 配置目录
CPOLAR_CONFIG_DIR="$HOME/.cpolar"
CPOLAR_CONFIG_FILE="$CPOLAR_CONFIG_DIR/cpolar.yml"

# 创建配置目录
mkdir -p "$CPOLAR_CONFIG_DIR"

# 生成配置文件
cat > "$CPOLAR_CONFIG_FILE" <<EOF
version: "2"
authtoken: $CPOLAR_AUTHTOKEN

web_addr: localhost:4040
log_level: info
log_format: json

tunnels:
  ergo-frontend:
    addr: ${ERGO_FRONTEND_PORT:-8081}
    proto: http
    subdomain: ${ERGO_FRONTEND_SUBDOMAIN:-terryzin}
    region: cn_vip
    inspect: true

  ergo-api:
    addr: ${ERGO_API_PORT:-8082}
    proto: http
    subdomain: ${ERGO_API_SUBDOMAIN:-terryapi}
    region: cn_vip
    inspect: true

  openclaw-gateway:
    addr: ${OPENCLAW_PORT:-18789}
    proto: http
    subdomain: ${OPENCLAW_SUBDOMAIN:-terrysopenclaw}
    region: cn_vip
    inspect: true
EOF

echo "✅ Cpolar config generated: $CPOLAR_CONFIG_FILE"
echo ""
echo "Next steps:"
echo "  1. Start cpolar: cpolar start-all"
echo "  2. Check status: curl http://localhost:4040/api/tunnels"
```

---

## 四、隧道管理

### 4.1 启动隧道

```bash
# 启动所有隧道（推荐）
cpolar start-all

# 启动单个隧道
cpolar start ergo-frontend
cpolar start ergo-api
cpolar start openclaw-gateway

# 后台运行
nohup cpolar start-all > logs/cpolar.log 2>&1 &
```

### 4.2 查看隧道状态

```bash
# 方式 1: Web UI
open http://localhost:4040

# 方式 2: API
curl -s http://localhost:4040/api/tunnels | jq

# 方式 3: 提取公网 URL
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[].public_url'
```

### 4.3 隧道健康检查脚本

```bash
#!/bin/bash
# scripts/cpolar-health-check.sh

set -e

echo "🔍 Checking cpolar status..."

# 检查进程
if ! pgrep -x "cpolar" > /dev/null; then
    echo "❌ cpolar process not running"
    exit 1
fi

echo "✅ cpolar process is running"

# 检查 Web UI
if ! curl -s http://localhost:4040 > /dev/null; then
    echo "❌ cpolar Web UI not accessible"
    exit 1
fi

echo "✅ cpolar Web UI is accessible"

# 检查隧道
TUNNEL_COUNT=$(curl -s http://localhost:4040/api/tunnels | jq '.tunnels | length')

if [ "$TUNNEL_COUNT" -eq 0 ]; then
    echo "❌ No active tunnels"
    exit 1
fi

echo "✅ $TUNNEL_COUNT active tunnel(s)"

# 列出隧道
echo ""
echo "Active tunnels:"
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | "  - \(.name): \(.public_url)"'

echo ""
echo "✅ All checks passed!"
```

### 4.4 自动重连脚本

```bash
#!/bin/bash
# scripts/cpolar-auto-reconnect.sh
# 功能: 监控 cpolar 隧道，断线自动重连

INTERVAL=60  # 检查间隔（秒）
LOG_FILE="logs/cpolar-monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

while true; do
    # 检查进程
    if ! pgrep -x "cpolar" > /dev/null; then
        log "❌ cpolar process died, restarting..."
        nohup cpolar start-all > logs/cpolar.log 2>&1 &
        sleep 10
        continue
    fi

    # 检查隧道数量
    TUNNEL_COUNT=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | jq '.tunnels | length' 2>/dev/null || echo "0")

    if [ "$TUNNEL_COUNT" -lt 3 ]; then
        log "⚠️  Only $TUNNEL_COUNT tunnel(s) active, expected 3. Restarting cpolar..."
        pkill cpolar
        sleep 5
        nohup cpolar start-all > logs/cpolar.log 2>&1 &
        sleep 10
    else
        log "✅ $TUNNEL_COUNT tunnels active"
    fi

    sleep $INTERVAL
done
```

---

## 五、配置验证

### 5.1 验证清单

```bash
#!/bin/bash
# scripts/validate-cpolar-config.sh

set -e

echo "🔍 Validating cpolar configuration..."

# 1. 检查配置文件存在
if [ ! -f "$HOME/.cpolar/cpolar.yml" ]; then
    echo "❌ Config file not found: $HOME/.cpolar/cpolar.yml"
    exit 1
fi
echo "✅ Config file exists"

# 2. 检查 authtoken
if ! grep -q "authtoken:" "$HOME/.cpolar/cpolar.yml"; then
    echo "❌ authtoken not configured"
    exit 1
fi
echo "✅ authtoken configured"

# 3. 检查隧道定义
for tunnel in ergo-frontend ergo-api openclaw-gateway; do
    if ! grep -q "$tunnel:" "$HOME/.cpolar/cpolar.yml"; then
        echo "❌ Tunnel '$tunnel' not defined"
        exit 1
    fi
done
echo "✅ All 3 tunnels defined"

# 4. 检查端口冲突
for port in 8081 8082 18789; do
    if lsof -i:$port -sTCP:LISTEN > /dev/null 2>&1; then
        echo "✅ Port $port is listening"
    else
        echo "⚠️  Port $port is not listening (service not started?)"
    fi
done

# 5. 检查 cpolar 运行
if pgrep -x "cpolar" > /dev/null; then
    echo "✅ cpolar is running"
else
    echo "⚠️  cpolar is not running"
fi

echo ""
echo "✅ Configuration validation completed!"
```

### 5.2 端到端测试

```bash
#!/bin/bash
# scripts/e2e-test-cpolar.sh

set -e

echo "🧪 Running end-to-end cpolar tests..."

# 获取公网 URL
FRONTEND_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.name=="ergo-frontend") | .public_url')
API_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.name=="ergo-api") | .public_url')
GATEWAY_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.name=="openclaw-gateway") | .public_url')

if [ -z "$FRONTEND_URL" ] || [ -z "$API_URL" ] || [ -z "$GATEWAY_URL" ]; then
    echo "❌ Failed to get tunnel URLs"
    exit 1
fi

echo "Testing URLs:"
echo "  Frontend: $FRONTEND_URL"
echo "  API:      $API_URL"
echo "  Gateway:  $GATEWAY_URL"

# 测试前端
echo -n "Testing frontend... "
if curl -sf "$FRONTEND_URL" > /dev/null; then
    echo "✅"
else
    echo "❌"
fi

# 测试 API
echo -n "Testing API health... "
if curl -sf "$API_URL/api/health" > /dev/null; then
    echo "✅"
else
    echo "❌"
fi

# 测试 Gateway
echo -n "Testing Gateway health... "
if curl -sf "$GATEWAY_URL/api/health" > /dev/null; then
    echo "✅"
else
    echo "❌"
fi

echo ""
echo "✅ End-to-end tests completed!"
```

---

## 六、故障处理

### 6.1 常见问题

#### 问题 1：隧道无法启动

**症状**：`cpolar start-all` 报错
**原因**：
- authtoken 未配置或无效
- 端口已被占用
- 配置文件格式错误

**解决**：
```bash
# 检查配置文件
cat ~/.cpolar/cpolar.yml

# 检查端口占用
lsof -i:8081
lsof -i:8082
lsof -i:18789

# 验证 authtoken
cpolar authtoken YOUR_TOKEN
```

#### 问题 2：域名随机变化（免费版）

**症状**：每次重启域名不一样
**原因**：免费版不支持保留域名

**解决**：
1. **推荐**：升级到 cpolar Pro（¥9/月）
2. **临时方案**：使用配置 API 动态获取域名

```javascript
// server/api-bridge.js
app.get('/api/config', async (req, res) => {
    // 从 cpolar API 动态获取当前域名
    const tunnels = await fetch('http://localhost:4040/api/tunnels').then(r => r.json());
    const apiTunnel = tunnels.tunnels.find(t => t.name === 'ergo-api');

    res.json({
        apiBase: apiTunnel ? apiTunnel.public_url : 'http://localhost:8082'
    });
});
```

#### 问题 3：免费版只能 2 个隧道

**症状**：启动第 3 个隧道失败
**原因**：免费版限制

**解决**：
1. **推荐**：升级到 cpolar Pro
2. **临时方案**：合并服务（前端 + API 在同一个服务器）

```bash
# 使用 Express 同时服务前端和 API
node server/frontend-with-proxy.js  # 8081 端口
# 只需要 2 个隧道：8081 (前端+API), 18789 (Gateway)
```

### 6.2 应急预案

#### 场景 1：cpolar 服务挂了

```bash
# 1. 检查进程
ps aux | grep cpolar

# 2. 查看日志
tail -f logs/cpolar.log

# 3. 重启
pkill cpolar
cpolar start-all

# 4. 验证
curl http://localhost:4040/api/tunnels
```

#### 场景 2：隧道断开无法重连

```bash
# 1. 完全重启 cpolar
pkill cpolar
sleep 5
rm ~/.cpolar/cpolar.lock  # 删除锁文件
cpolar start-all

# 2. 检查网络
ping cpolar.com

# 3. 检查 authtoken 是否过期
# 登录 cpolar.com 重新生成 token
```

---

## 七、生产环境部署

### 7.1 Systemd 服务配置（推荐）

```ini
# /etc/systemd/system/cpolar.service
[Unit]
Description=Cpolar Tunnel Service
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=terry
WorkingDirectory=/home/terry
ExecStart=/usr/local/bin/cpolar start-all
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# 健康检查
ExecStartPost=/bin/sleep 10
ExecStartPost=/usr/local/bin/cpolar-health-check.sh

[Install]
WantedBy=multi-user.target
```

**启用服务**：
```bash
sudo systemctl daemon-reload
sudo systemctl enable cpolar
sudo systemctl start cpolar
sudo systemctl status cpolar
```

### 7.2 监控配置

```yaml
# prometheus/cpolar-exporter.yml
scrape_configs:
  - job_name: 'cpolar'
    static_configs:
      - targets: ['localhost:4040']
    metrics_path: '/api/tunnels'
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: 'cpolar'
```

---

## 八、总结

### 配置最佳实践

✅ **DO**
- 使用配置文件管理隧道
- 环境变量管理敏感信息（authtoken）
- 定期检查隧道健康状态
- 使用 Systemd 管理进程生命周期

❌ **DON'T**
- 不要硬编码 cpolar 域名到代码
- 不要提交 authtoken 到 Git
- 不要依赖免费版的固定域名
- 不要手动重启服务（自动化！）

### 关键指标

| 指标 | 目标 |
|------|------|
| 隧道可用性 | > 99.5% |
| 重连时间 | < 30s |
| 配置变更时间 | < 2min |

### 下一步

1. 生成配置文件：`scripts/generate-cpolar-config.sh`
2. 验证配置：`scripts/validate-cpolar-config.sh`
3. 启动服务：`cpolar start-all`
4. 运行健康检查：`scripts/cpolar-health-check.sh`
5. 部署监控：`scripts/cpolar-auto-reconnect.sh`

---

**文档版本**: v1.0
**最后更新**: 2026-02-21
