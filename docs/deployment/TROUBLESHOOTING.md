# Ergo 故障排查清单

> 系统化的问题诊断流程 🔍

## 🚨 问题诊断流程

遇到问题时，按以下顺序执行：

```
1. 运行健康检查 → npm run health
2. 查看服务日志 → 启动窗口输出
3. 检查配置文件 → .env 文件
4. 验证端口占用 → netstat 命令
5. 重启服务    → scripts\start.bat
```

---

## ✅ 健康检查

### 自动诊断

```bash
# 运行健康检查脚本
npm run health

# 期望输出：
# ✓ ONLINE Ergo Frontend (HTTP 200)
# ✓ ONLINE API Bridge (HTTP 200)
# ✓ ONLINE OpenClaw Gateway (HTTP 200)
```

### 手动验证

```bash
# 测试 Ergo Frontend
curl http://localhost:8081

# 测试 API Bridge
curl http://localhost:8082/api/status

# 测试 OpenClaw Gateway
curl http://localhost:18789/api/status
```

---

## 🔧 常见问题速查表

| 错误信息 | 原因 | 解决方案 | 文档链接 |
|---------|------|----------|----------|
| `Cannot connect to API Bridge` | API Bridge 未启动 | `npm run api` | [链接](#问题-1-服务启动失败) |
| `401 Unauthorized` | Token 错误 | 检查 `.env` 中的 `OPENCLAW_TOKEN` | [链接](#问题-2-api-认证失败) |
| `EADDRINUSE: address already in use` | 端口被占用 | 杀死占用进程 | [链接](#问题-3-端口被占用) |
| `WebSocket connection failed` | WebSocket 不支持 | 检查 Cpolar 版本 | [链接](#问题-4-websocket-连接失败) |
| `Cannot access cpolar URL` | Cpolar 隧道未启动 | `cpolar start-all` | [链接](#问题-5-外网访问失败) |
| `.env file not found` | 配置文件缺失 | `cp .env.example .env` | [链接](#问题-6-配置文件缺失) |
| `Module not found` | 依赖未安装 | `npm install` | [链接](#问题-7-依赖缺失) |

---

## 🐛 详细排查步骤

### 问题 1: 服务启动失败

**症状：**
```
[ERROR] Cannot start service
Error: listen EADDRINUSE: address already in use :::8081
```

**诊断步骤：**

1. **检查端口占用**
   ```bash
   # Windows
   netstat -ano | findstr "8081 8082 18789"

   # Unix/Linux/macOS
   lsof -i :8081
   lsof -i :8082
   lsof -i :18789
   ```

2. **查看进程**
   ```bash
   # Windows
   tasklist | findstr "node.exe\|python.exe"

   # Unix/Linux/macOS
   ps aux | grep "node\|python"
   ```

3. **检查配置**
   ```bash
   # 验证 .env 文件存在且配置正确
   cat .env  # Unix/Linux/macOS
   type .env  # Windows
   ```

**解决方案：**

```bash
# 方案 1: 杀死占用进程
# Windows
taskkill /F /IM node.exe
taskkill /F /IM python.exe

# Unix/Linux/macOS
killall node
killall python

# 方案 2: 更改端口
# 编辑 .env 文件
PORT=8091  # 改为其他端口
API_BRIDGE_PORT=8092

# 方案 3: 清理僵尸进程
# Windows
taskkill /F /FI "STATUS eq NOT RESPONDING"

# Unix/Linux/macOS
kill -9 $(ps aux | grep '[n]ode' | awk '{print $2}')
```

**重新启动：**
```bash
scripts\start.bat  # Windows
./scripts/start.sh  # Unix/Linux/macOS
```

---

### 问题 2: API 认证失败

**症状：**
```
401 Unauthorized
Invalid or missing API token
```

**诊断步骤：**

1. **验证 Token 配置**
   ```bash
   # 检查 .env 文件
   cat .env | grep OPENCLAW_TOKEN

   # 应该看到：
   # OPENCLAW_TOKEN=f2009973e92e96b0e31c30b30500e997
   ```

2. **测试 Token**
   ```bash
   # 使用 curl 测试
   curl -H "Authorization: Bearer f2009973e92e96b0e31c30b30500e997" \
        http://localhost:18789/api/status
   ```

3. **检查 Gateway 配置**
   - 访问 http://localhost:18789/settings
   - 查看 Token 配置

**解决方案：**

```bash
# 1. 从 OpenClaw Gateway 获取正确的 Token
# 访问 http://localhost:18789/settings
# 复制 "API Token" 字段

# 2. 更新 .env 文件
notepad .env  # Windows
nano .env     # Unix/Linux/macOS

# 修改这一行：
OPENCLAW_TOKEN=新的token值

# 3. 重启服务
npm run start:all

# 4. 验证修复
npm run health
```

---

### 问题 3: 端口被占用

**症状：**
```
Error: listen EADDRINUSE: address already in use :::8081
```

**诊断步骤：**

1. **查找占用进程**
   ```bash
   # Windows
   netstat -ano | findstr ":8081"
   # 记录最后一列的 PID

   # Unix/Linux/macOS
   lsof -i :8081
   # 记录 PID 列
   ```

2. **识别进程**
   ```bash
   # Windows
   tasklist | findstr "<PID>"

   # Unix/Linux/macOS
   ps -p <PID> -o comm=
   ```

**解决方案：**

```bash
# 方案 1: 杀死占用进程（推荐）
# Windows
taskkill /F /PID <PID>

# Unix/Linux/macOS
kill -9 <PID>

# 方案 2: 批量清理（谨慎使用）
# Windows
taskkill /F /IM node.exe

# Unix/Linux/macOS
killall node

# 方案 3: 更改端口
# 编辑 .env 文件，更改 PORT 值
```

---

### 问题 4: WebSocket 连接失败

**症状：**
```javascript
WebSocket connection to 'wss://terryzin.cpolar.cn/api/ws' failed
```

**诊断步骤：**

1. **检查 Cpolar 版本**
   ```bash
   cpolar version

   # WebSocket 需要 Pro 版
   # 免费版不支持 WebSocket
   ```

2. **验证本地 WebSocket**
   ```bash
   # 使用 websocat 或浏览器测试
   # 访问 http://localhost:8081
   # 打开浏览器控制台，查看 WebSocket 连接
   ```

3. **检查代理配置**
   - 查看 `server/frontend-with-proxy.js`
   - 确认 `ws: true` 配置存在

**解决方案：**

```bash
# 方案 1: 升级 Cpolar Pro（推荐）
# 访问 https://cpolar.com/pricing

# 方案 2: 使用本地访问（开发环境）
# WebSocket 在本地环境原生支持
http://localhost:8081

# 方案 3: 使用 HTTP 轮询（降级方案）
# 修改前端代码，使用 HTTP 长轮询替代 WebSocket
# 参考：docs/architecture/websocket-fallback.md
```

---

### 问题 5: 外网访问失败

**症状：**
```
Cannot access https://terryzin.cpolar.cn
ERR_NAME_NOT_RESOLVED
```

**诊断步骤：**

1. **检查 Cpolar 隧道状态**
   ```bash
   # 访问 Cpolar Web 管理界面
   http://localhost:4040

   # 查看隧道列表，确认状态为 "online"
   ```

2. **验证本地服务**
   ```bash
   # 确认本地服务正常运行
   curl http://localhost:8081
   ```

3. **测试域名解析**
   ```bash
   # Windows
   nslookup terryzin.cpolar.cn

   # Unix/Linux/macOS
   dig terryzin.cpolar.cn
   ```

**解决方案：**

```bash
# 方案 1: 重启 Cpolar 隧道
cpolar stop-all
cpolar start-all

# 方案 2: 检查 Cpolar 配置
cat ~/.cpolar/cpolar.yml  # Unix/Linux/macOS
type %USERPROFILE%\.cpolar\cpolar.yml  # Windows

# 方案 3: 使用最新域名
# Cpolar 免费版域名会变化，访问 http://localhost:4040 获取最新域名
# 更新 .env 文件：
CPOLAR_FRONTEND_URL=https://新域名.cpolar.cn

# 方案 4: 手动启动隧道
cpolar http 8081 --region=cn
```

---

### 问题 6: 配置文件缺失

**症状：**
```
Error: Cannot find module '.env'
.env file not found
```

**诊断步骤：**

1. **检查文件存在**
   ```bash
   ls -la | grep .env  # Unix/Linux/macOS
   dir | findstr .env  # Windows
   ```

2. **检查 .gitignore**
   ```bash
   cat .gitignore | grep .env

   # 应该看到：
   # .env
   # .env.local
   ```

**解决方案：**

```bash
# 1. 复制配置模板
cp .env.example .env  # Unix/Linux/macOS
copy .env.example .env  # Windows

# 2. 编辑配置
notepad .env  # Windows
nano .env     # Unix/Linux/macOS

# 3. 必须配置的项：
# - OPENCLAW_TOKEN
# - CPOLAR_FRONTEND_URL (如果使用外网访问)
# - CPOLAR_GATEWAY_URL (如果使用外网访问)

# 4. 验证配置
cat .env  # Unix/Linux/macOS
type .env  # Windows
```

---

### 问题 7: 依赖缺失

**症状：**
```
Error: Cannot find module 'express'
Module not found: Error: Can't resolve 'chokidar'
```

**诊断步骤：**

1. **检查 node_modules**
   ```bash
   ls node_modules  # Unix/Linux/macOS
   dir node_modules  # Windows
   ```

2. **检查 package.json**
   ```bash
   cat package.json | grep dependencies
   ```

**解决方案：**

```bash
# 方案 1: 安装依赖
npm install

# 方案 2: 清理缓存后重装（依赖损坏时）
rm -rf node_modules package-lock.json  # Unix/Linux/macOS
rmdir /s /q node_modules && del package-lock.json  # Windows

npm install

# 方案 3: 使用 npm ci（精确安装）
npm ci

# 方案 4: 更新依赖（谨慎使用）
npm update
```

---

## 🔍 日志分析

### 查看服务日志

**实时日志：**
- 启动脚本会打开新窗口显示日志
- 查看对应窗口的输出

**日志位置：**
```bash
# 如果使用 PM2
pm2 logs ergo

# 如果使用 systemd (Linux)
journalctl -u ergo -f

# 如果使用 nohup
tail -f nohup.out
```

### 常见日志模式

| 日志内容 | 含义 | 处理方式 |
|---------|------|----------|
| `[PROXY] GET /api/status → http://localhost:8082` | API 代理正常 | 无需处理 |
| `[PROXY ERROR] connect ECONNREFUSED` | API Bridge 未启动 | 启动 API Bridge |
| `[AUTH] Token validation failed` | Token 错误 | 检查 `.env` 配置 |
| `[WARN] High memory usage` | 内存占用过高 | 重启服务 |
| `[ERROR] EADDRINUSE` | 端口被占用 | 杀死占用进程 |

---

## 🛠️ 高级诊断工具

### 网络连接测试

```bash
# 测试 TCP 连接
telnet localhost 8081
nc -zv localhost 8081

# 测试 HTTP 连接
curl -v http://localhost:8081

# 测试 API 端点
curl http://localhost:8082/api/status | jq
```

### 进程监控

```bash
# 查看进程树
# Windows
wmic process where "name='node.exe'" get ProcessId,CommandLine

# Unix/Linux/macOS
pstree -p | grep node

# 查看资源占用
# Windows
tasklist /FI "IMAGENAME eq node.exe" /FO TABLE

# Unix/Linux/macOS
ps aux | grep node
```

### 性能分析

```bash
# Node.js 性能分析
node --inspect server/frontend-with-proxy.js

# 打开 Chrome DevTools
# 访问 chrome://inspect

# 查看内存使用
node --max-old-space-size=4096 server/frontend-with-proxy.js
```

---

## 📋 故障排查检查清单

使用此清单系统化地排查问题：

```
□ 运行健康检查 (npm run health)
□ 检查 .env 文件是否存在
□ 验证 OPENCLAW_TOKEN 配置
□ 检查端口占用 (8081, 8082, 18789)
□ 验证 Node.js 版本 (>= 18)
□ 检查 node_modules 是否存在
□ 查看服务日志输出
□ 测试本地访问 (localhost:8081)
□ 检查 Cpolar 隧道状态 (localhost:4040)
□ 测试外网访问 (cpolar 域名)
□ 验证防火墙/代理设置
□ 重启服务
□ 重启电脑（最后手段）
```

---

## 🆘 获取帮助

如果以上方法都无法解决问题：

1. **收集诊断信息**
   ```bash
   # 运行完整诊断
   npm run health > health-report.txt
   npm test > test-report.txt

   # 收集系统信息
   # Windows
   systeminfo > system-info.txt

   # Unix/Linux/macOS
   uname -a > system-info.txt
   node --version >> system-info.txt
   npm --version >> system-info.txt
   ```

2. **提交 Issue**
   - 访问 [GitHub Issues](https://github.com/terryzin/Ergo/issues)
   - 使用 Issue 模板
   - 附上诊断信息

3. **社区讨论**
   - [GitHub Discussions](https://github.com/terryzin/Ergo/discussions)

---

## 📚 相关文档

- [部署指南](DEPLOYMENT_GUIDE.md) - 完整部署流程
- [快速开始](../../QUICK_START.md) - 快速上手
- [架构文档](../architecture/architecture.md) - 系统架构
- [API 文档](../api/README.md) - API 接口说明

---

**Made with ❤️ by Ergo Team**

*Last updated: 2026-02-21*
