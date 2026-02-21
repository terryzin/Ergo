# Ergo 部署指南

> 一次配置，长期稳定运行 —— Convention over Configuration

## 快速开始

### 1. 环境准备

```bash
# 安装 Node.js (v18+)
# 访问 https://nodejs.org/ 下载安装

# 验证安装
node --version
npm --version
```

### 2. 配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置（Windows）
notepad .env

# 编辑配置（Unix/Linux/macOS）
nano .env
```

**必需配置项：**
- `OPENCLAW_TOKEN` - 从 OpenClaw Gateway 获取
- `CPOLAR_FRONTEND_URL` - Cpolar 分配的前端域名
- `CPOLAR_GATEWAY_URL` - Cpolar 分配的 Gateway 域名

### 3. 安装依赖

```bash
npm install
```

### 4. 启动服务

**Windows:**
```cmd
scripts\start.bat
```

**Unix/Linux/macOS:**
```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

**或使用 npm:**
```bash
npm run start:all
```

### 5. 验证部署

```bash
# 运行健康检查
npm run health

# 运行完整测试
npm test
```

---

## 架构说明

### 服务架构

```
外部访问
  │
  ├─ https://terryzin.cpolar.cn (Cpolar 隧道)
  │    └─ localhost:8081 (Ergo Frontend + API Proxy)
  │         ├─ 静态文件服务
  │         └─ /api/* → localhost:8082 (API Bridge)
  │              └─ → localhost:18789 (OpenClaw Gateway)
  │
  └─ https://terrysopenclaw.cpolar.cn (Cpolar 隧道)
       └─ localhost:18789 (OpenClaw Gateway WebUI)
```

### 端口说明

| 服务 | 端口 | 用途 |
|------|------|------|
| Ergo Frontend | 8081 | 静态服务 + API 代理 |
| API Bridge | 8082 | OpenClaw API 封装 |
| OpenClaw Gateway | 18789 | AI Gateway (只读) |
| Cpolar Web | 4040 | 隧道管理界面 |

---

## Cpolar 配置

### 方式 1：使用配置文件（推荐）

```bash
# 复制配置文件到 cpolar 目录
cp cpolar.yml ~/.cpolar/cpolar.yml  # Unix/Linux/macOS
copy cpolar.yml %USERPROFILE%\.cpolar\cpolar.yml  # Windows

# 启动所有隧道
cpolar start-all
```

### 方式 2：使用命令行

```bash
# 启动 Ergo Frontend 隧道
cpolar http 8081 --region=cn --subdomain=terryzin

# 启动 OpenClaw Gateway 隧道
cpolar http 18789 --region=cn --subdomain=terrysopenclaw
```

### 方式 3：安装为 Windows 服务（推荐生产环境）

```cmd
# 使用项目提供的安装脚本
scripts\cpolar-service-install.bat

# 或手动安装
cpolar service install -config cpolar.yml
cpolar service start
```

---

## 常见问题排查

### 问题 1: 服务启动失败

**症状：**
```
[ERROR] Cannot connect to API Bridge
```

**排查步骤：**
1. 检查 `.env` 配置是否正确
2. 验证端口未被占用：`netstat -ano | findstr "8081 8082 18789"`
3. 查看服务日志
4. 运行健康检查：`npm run health`

**解决方案：**
```bash
# 停止所有服务
Ctrl+C

# 清理端口（Windows）
taskkill /F /IM node.exe
taskkill /F /IM python.exe

# 重新启动
scripts\start.bat
```

---

### 问题 2: 外网访问失败

**症状：**
```
Cannot access https://terryzin.cpolar.cn
```

**排查步骤：**
1. 检查 Cpolar 隧道状态：访问 `http://localhost:4040`
2. 验证本地服务正常：`curl http://localhost:8081`
3. 检查 `.env` 中的域名配置

**解决方案：**
```bash
# 重启 Cpolar 隧道
cpolar stop-all
cpolar start-all

# 更新 .env 中的域名配置（如果 cpolar 分配了新域名）
notepad .env
```

---

### 问题 3: API 认证失败

**症状：**
```
401 Unauthorized
```

**排查步骤：**
1. 检查 `.env` 中的 `OPENCLAW_TOKEN` 是否正确
2. 验证 Token 未过期
3. 检查 OpenClaw Gateway 日志

**解决方案：**
```bash
# 从 OpenClaw Gateway 重新获取 Token
# 访问 http://localhost:18789/settings

# 更新 .env
OPENCLAW_TOKEN=新的token

# 重启服务
npm run start:all
```

---

### 问题 4: WebSocket 连接失败

**症状：**
```
WebSocket connection failed
```

**排查步骤：**
1. 检查 Cpolar 隧道是否支持 WebSocket（需要 Pro 版）
2. 验证防火墙/代理设置
3. 查看浏览器控制台错误

**解决方案：**
```bash
# 1. 升级 Cpolar Pro 版（支持 WebSocket）
# 2. 或使用本地访问（WebSocket 原生支持）
```

---

### 问题 5: 配置反复失效

**根本原因：**
- 硬编码配置散落在代码中
- 缺乏环境变量管理
- 没有统一的配置入口

**解决方案（已在本次重构中修复）：**
1. 所有配置集中在 `.env` 文件
2. 使用 `process.env` 读取配置
3. 禁止硬编码配置值
4. 通过 `.env.example` 提供模板

---

## 健康检查

### 手动检查

```bash
# 运行健康检查脚本
npm run health

# 期望输出：
# ✓ ONLINE Ergo Frontend (HTTP 200)
# ✓ ONLINE API Bridge (HTTP 200)
# ✓ ONLINE OpenClaw Gateway (HTTP 200)
# ✓ ONLINE https://terryzin.cpolar.cn
```

### 自动化监控（可选）

创建 Cron Job 定期检查：

**Windows 任务计划：**
```cmd
schtasks /create /tn "Ergo Health Check" /tr "npm run health" /sc hourly
```

**Unix Cron：**
```bash
# 每小时检查一次
0 * * * * cd /path/to/ergo && npm run health
```

---

## 生产环境建议

### 1. 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动 Ergo
pm2 start npm --name "ergo" -- run start:all

# 开机自启
pm2 startup
pm2 save
```

### 2. 配置日志轮转

```bash
# 安装 pm2-logrotate
pm2 install pm2-logrotate

# 配置（保留 7 天日志）
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 3. 监控告警

使用 PM2 监控或接入 Prometheus/Grafana。

---

## 更新升级

### 拉取最新代码

```bash
git pull origin main
npm install
npm test
npm run start:all
```

### 回滚版本

```bash
git log --oneline  # 查看历史
git checkout <commit-hash>
npm install
npm run start:all
```

---

## 备份策略

### 必备备份内容

1. **环境配置**
   ```bash
   # 备份 .env 文件（注意安全，不要上传到 Git）
   cp .env .env.backup.$(date +%Y%m%d)
   ```

2. **Cpolar 配置**
   ```bash
   cp cpolar.yml cpolar.yml.backup
   ```

3. **OpenClaw 数据**
   ```bash
   # 备份 OpenClaw 工作空间
   tar -czf openclaw-backup-$(date +%Y%m%d).tar.gz ~/.openclaw
   ```

---

## 安全建议

1. **保护敏感配置**
   - `.env` 文件不要提交到 Git
   - 定期更换 `ERGO_API_KEY`
   - 使用强密码/Token

2. **限制公网访问**
   - 配置 Cpolar IP 白名单（Pro 版）
   - 启用 Basic Auth
   - 使用 VPN

3. **监控异常访问**
   - 查看 Cpolar 访问日志
   - 配置告警规则

---

## 性能优化

### 1. 启用 HTTP/2（Cpolar Pro）

```yaml
# cpolar.yml
tunnels:
  ergo-frontend:
    proto: http
    addr: 8081
    http2: true  # 启用 HTTP/2
```

### 2. 启用 Gzip 压缩

已在 `server/frontend-with-proxy.js` 中默认启用。

### 3. 缓存策略

- HTML: `no-cache`（防止更新不生效）
- JS/CSS: `max-age=3600`
- 静态资源: `max-age=86400`

---

## 技术支持

遇到问题？按以下顺序排查：

1. **运行健康检查**：`npm run health`
2. **查看日志**：服务启动窗口
3. **查看文档**：`docs/` 目录
4. **提交 Issue**：[GitHub Issues](https://github.com/terryzin/Ergo/issues)

---

## 附录

### 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 8081 | Ergo Frontend 端口 |
| API_BRIDGE_PORT | 8082 | API Bridge 端口 |
| OPENCLAW_GATEWAY_PORT | 18789 | OpenClaw Gateway 端口 |
| ERGO_API_KEY | ergo-default-... | Ergo API 认证 Key |
| OPENCLAW_TOKEN | (必需) | OpenClaw Gateway Token |
| CPOLAR_FRONTEND_URL | (可选) | Cpolar 前端域名 |
| CPOLAR_GATEWAY_URL | (可选) | Cpolar Gateway 域名 |
| LOG_LEVEL | info | 日志级别 (debug/info/warn/error) |

### 端口占用检查

**Windows:**
```cmd
netstat -ano | findstr "8081 8082 18789"
```

**Unix/Linux/macOS:**
```bash
lsof -i :8081
lsof -i :8082
lsof -i :18789
```

### 清理端口占用

**Windows:**
```cmd
# 查找占用进程
netstat -ano | findstr "8081"

# 杀死进程（PID 从上一步获取）
taskkill /F /PID <PID>
```

**Unix/Linux/macOS:**
```bash
# 杀死占用 8081 端口的进程
kill -9 $(lsof -t -i:8081)
```

---

**Made with ❤️ by Ergo Team**

*Last updated: 2026-02-21*
