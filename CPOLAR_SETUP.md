# Cpolar 隧道配置指南

## 当前问题

外网访问 Ergo Dashboard 时，无法连接到 API Bridge (8082)，导致所有状态显示离线。

## 解决方案：创建第三个 cpolar 隧道

### 当前隧道配置

1. **Ergo Dashboard** (8081)
   - 域名: https://terryzin.cpolar.cn
   - 映射: localhost:8081
   - 状态: ✅ 正常

2. **OpenClaw Gateway** (18789)
   - 域名: https://terrysopenclaw.cpolar.cn
   - 映射: localhost:18789
   - 状态: ✅ 正常

### 需要新增的隧道

3. **Ergo API Bridge** (8082) - **缺失！**
   - 映射: localhost:8082
   - 建议域名: `https://terryapi.cpolar.cn`

## 配置步骤

### 方式 1：通过 cpolar Web UI（推荐）

1. **打开 cpolar 管理界面**
   ```
   http://localhost:4040
   ```

2. **创建新隧道**
   - 进入"隧道管理" → "创建隧道"
   - 配置项：
     - 隧道名称: `ergo-api-bridge`
     - 协议: `http`
     - 本地地址: `8082`
     - 域名类型: `二级子域名`（需 Pro 版）
     - 子域名前缀: `terryapi`（或其他可用名称）
     - 地区: `China VIP` 或 `China`

3. **启动隧道**
   - 点击"启动"按钮
   - 复制生成的公网域名（如 `https://terryapi.cpolar.cn`）

### 方式 2：通过命令行

```bash
# 启动临时隧道（重启后失效）
cpolar http 8082

# 或者使用保留域名（需要先在 Web UI 中保留域名）
cpolar http -subdomain=terryapi 8082
```

### 方式 3：配置文件（持久化配置）

创建或编辑 cpolar 配置文件（通常在 `~/.cpolar/cpolar.yml`）：

```yaml
tunnels:
  ergo-dashboard:
    addr: 8081
    proto: http
    subdomain: terryzin

  openclaw-gateway:
    addr: 18789
    proto: http
    subdomain: terrysopenclaw

  ergo-api-bridge:
    addr: 8082
    proto: http
    subdomain: terryapi  # 改成你的保留域名
```

然后重启 cpolar：
```bash
cpolar restart
```

## 验证配置

### 1. 检查隧道状态

访问 http://localhost:4040/status 查看所有活跃隧道。

### 2. 测试 API 连接

```bash
# 测试健康检查接口
curl https://terryapi.cpolar.cn/api/health

# 应该返回：
# {"status":"ok","timestamp":"..."}
```

### 3. 测试完整 API

```bash
curl -H "X-Ergo-Key: ergo-default-secret-key-2026" \
  https://terryapi.cpolar.cn/api/status
```

## 更新前端配置

隧道创建成功后，更新 `src/config.js`：

```javascript
detectApiBase() {
    const hostname = window.location.hostname;

    // 本地开发环境
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8082';
    }

    // 外网访问 - 使用 API Bridge 隧道
    if (hostname.includes('cpolar.cn')) {
        return 'https://terryapi.cpolar.cn';  // 你的 API 隧道域名
    }

    // 其他域名 - 相对路径（如果有反向代理）
    return '';
}
```

## 注意事项

⚠️ **免费版限制**
- 免费版只能同时运行 2 个隧道
- 需要升级到 **cpolar Pro** 才能运行 3 个隧道
- 免费版域名会随机变化（每次重启）

✅ **推荐方案（如果是免费版）**
- 升级到 cpolar Pro（支持保留域名 + 多隧道）
- 或者使用其他内网穿透工具（frp, ngrok 等）

## 临时解决方案（免费版用户）

如果无法升级 Pro，可以采用**代理转发方案**：

1. 停止 Python http.server (8081)
2. 使用 Node.js + Express 作为前端服务器
3. 在前端服务器中配置代理规则：`/api/* -> http://localhost:8082`

配置文件示例见：`server/frontend-server.js`

## 架构说明

```
外网用户
  │
  ├─ https://terryzin.cpolar.cn (Ergo Dashboard)
  │    └─ cpolar tunnel → localhost:8081 (静态 HTML/CSS/JS)
  │
  ├─ https://terryapi.cpolar.cn (Ergo API Bridge) ⚠️ 需要创建
  │    └─ cpolar tunnel → localhost:8082 (Express API Server)
  │
  └─ https://terrysopenclaw.cpolar.cn (OpenClaw Gateway)
       └─ cpolar tunnel → localhost:18789 (OpenClaw WebUI + CLI)
```

## 相关文档

- cpolar 官方文档: https://www.cpolar.com/docs
- Ergo 配置说明: docs/CONFIG.md
- 架构设计: docs/architecture/architecture.md
