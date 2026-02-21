# Ergo 快速启动指南

> 从安装到上线，5 分钟完成 Ergo 部署

---

## 📦 安装

### 前置要求

- Node.js >= 16.x
- OpenClaw >= 2026.2
- Cpolar Pro 账号（用于持久化域名）

### 克隆项目

```bash
cd D:\.openclaw\workspace
git clone https://github.com/terryzin/Ergo.git my-dashboard
cd my-dashboard
```

### 安装依赖

```bash
npm install
```

### 配置环境

```bash
# 复制环境配置模板
copy .env.example .env

# 编辑配置（使用记事本或 VS Code）
notepad .env
```

必填配置项：

```env
# Ergo API 认证 Token（请修改为自定义值）
ERGO_API_KEY=your-custom-secret-key

# OpenClaw Gateway Token（从 OpenClaw 配置中获取）
OPENCLAW_TOKEN=your-openclaw-token

# Ergo 公网域名（Cpolar 分配）
CPOLAR_URL=https://your-subdomain.cpolar.top
```

---

## 🚀 启动服务

### 方式 1：一键启动（推荐）

```bash
scripts\start.bat
```

启动脚本会自动：
1. 检查环境变量配置
2. 检查 Node.js 安装
3. 安装依赖（如果缺失）
4. 启动所有服务（前端 + API + 自动配对）
5. 运行健康检查
6. 打开浏览器访问 Dashboard

### 方式 2：手动启动

```bash
# 启动所有服务
npm run start:all

# 或分别启动
npm run start  # 前端代理 (8081)
npm run api    # API Bridge (8082)
npm run pairing # 自动配对服务
```

### 方式 3：开发模式

```bash
# 前端开发（支持热重载）
npm run dev
```

---

## 🌐 配置公网访问（Cpolar）

### 步骤 1：编辑 Cpolar 配置

```bash
notepad cpolar.yml
```

修改子域名（仅 Pro 用户）：

```yaml
tunnels:
  ergo:
    proto: http
    addr: 8081
    subdomain: your-subdomain  # 替换为你的子域名
```

### 步骤 2：启动 Cpolar 隧道

**方式 A：使用启动脚本**

```bash
scripts\start-cpolar.bat
```

**方式 B：手动启动**

```bash
cpolar start ergo -config cpolar.yml
```

**方式 C：安装为 Windows 服务（推荐生产环境）**

```bash
cpolar service install -config D:\.openclaw\workspace\my-dashboard\cpolar.yml
cpolar service start
```

### 步骤 3：验证隧道状态

访问 Cpolar Web UI：http://localhost:4040

确认：
- ✅ 隧道名称：`ergo`
- ✅ 本地地址：`http://localhost:8081`
- ✅ 公网地址：`https://your-subdomain.cpolar.top`
- ✅ 状态：`online`

---

## ✅ 验证部署

### 本地访问测试

```bash
# 1. 打开 Dashboard
start http://localhost:8081

# 2. 运行健康检查
npm test
```

预期结果：
- ✅ Dashboard 页面正常加载
- ✅ Gateway 状态显示 "Online"
- ✅ 所有 Smoke Test 通过（34/34）

### 公网访问测试

访问你的公网域名：https://your-subdomain.cpolar.top

检查项：
- [ ] Dashboard 正常加载（无空白页）
- [ ] Gateway 状态显示 "Online"
- [ ] 项目列表正常显示
- [ ] Cron 任务列表正常显示
- [ ] 浏览器控制台无错误（F12 查看）

---

## 🛠️ 常见问题

### Q1: 启动后 Dashboard 空白？

**原因：** 前端代理未启动。

**解决：**
```bash
# 检查 8081 端口是否被占用
netstat -ano | findstr "8081"

# 重启服务
npm run start:all
```

### Q2: Gateway 状态显示 "Offline"？

**原因：** API Bridge 未启动或 OpenClaw Gateway 未运行。

**解决：**
```bash
# 检查 API Bridge (8082)
netstat -ano | findstr "8082"

# 检查 OpenClaw Gateway (18789)
openclaw status

# 重启 Gateway
openclaw gateway restart
```

### Q3: 外网访问报 502 错误？

**原因：** Cpolar 隧道未启动或配置错误。

**解决：**
```bash
# 1. 检查 Cpolar 隧道状态
访问 http://localhost:4040

# 2. 重启 Cpolar
cpolar service restart

# 3. 检查 cpolar.yml 配置
notepad cpolar.yml
```

### Q4: API 调用报 CORS 错误？

**原因：** 环境检测失败，前端使用了错误的 API 地址。

**解决：**
```bash
# 访问配置检查页面
https://your-subdomain.cpolar.top/config-check.html

# 查看环境信息，确认 API Base 是相对路径
```

### Q5: Smoke Test 失败？

**原因：** 服务未完全启动或 API 异常。

**解决：**
```bash
# 等待 10 秒后重试
timeout /t 10
npm test

# 查看详细错误
npm run test:local
```

---

## 📚 更多资源

- [完整部署指南](./architecture/single-domain-migration.md)
- [配置说明](./CONFIG.md)
- [项目上下文](../CLAUDE.md)
- [更新日志](../CHANGELOG.md)
- [架构设计](./architecture/architecture.md)

---

## 🆘 获取帮助

如果遇到问题：

1. 查看 [常见问题](./architecture/single-domain-migration.md#常见问题)
2. 运行健康检查：`npm test`
3. 查看日志：检查启动窗口输出
4. 提交 Issue：https://github.com/terryzin/Ergo/issues

---

**最后更新：** 2026-02-21
**版本：** v1.7.0
