# Cpolar 公网访问配置指南

## 问题说明

当从外部网络（手机、其他电脑）访问 Ergo 时，前端无法连接到 `localhost:8082` 的 API Bridge，导致以下错误：

```
localhost:8082/api/status:1 Failed to load resource: net::ERR_CONNECTION_REFUSED
```

**原因：**`localhost` 在外部网络中指向访问者自己的设备，而不是服务器。

## 最终解决方案：前端反向代理（推荐）

**v1.3.0 采用此方案** - 使用 Express 将前端和 API 合并到同一端口，无需第三个隧道。

详细文档：[PROXY_SOLUTION.md](./PROXY_SOLUTION.md)

---

## ~~方案 A：三隧道架构（已废弃）~~

### 第1步：更新 cpolar 配置

cpolar 配置文件已更新，新增了 `ErgoAPI` 隧道：

**文件位置：** `C:\Users\chenlei\.cpolar\cpolar.yml`

**新增配置：**
```yaml
  ErgoAPI:
    subdomain: terryapi
    proto: http
    addr: "8082"
    bind_tls: both
    start_type: enable
```

### 第2步：重启 cpolar 服务

**方法 1：通过服务管理器（推荐）**
1. 按 `Win + R` 打开运行对话框
2. 输入 `services.msc` 并回车
3. 找到 `cpolar` 服务
4. 右键点击 → 重新启动

**方法 2：通过命令行（需要管理员权限）**
```cmd
# 以管理员身份打开 CMD
net stop cpolar
net start cpolar
```

**方法 3：通过 cpolar 客户端**
- 打开 cpolar 客户端程序
- 点击"重启隧道"或"重新加载配置"

### 第3步：验证隧道

重启后，访问 cpolar 管理面板或执行：

```bash
# 检查隧道状态
curl https://terryapi.cpolar.top/health
```

**预期输出：**
```json
{"status":"ok","timestamp":"2026-02-20T..."}
```

### 第4步：验证前端访问

1. **本地访问测试：**
   ```
   http://localhost:8081
   应该正常工作（使用 localhost:8082）
   ```

2. **公网访问测试：**
   ```
   https://terryzin.cpolar.top
   应该正常工作（使用 https://terryapi.cpolar.top）
   ```

## 三隧道架构

配置完成后的完整架构：

```
┌─────────────────────────────────────────────┐
│           Cpolar 公网隧道                   │
├─────────────────────────────────────────────┤
│                                             │
│  1. Ergo 前端                               │
│     https://terryzin.cpolar.top             │
│     ↓                                       │
│     localhost:8081                          │
│                                             │
│  2. API Bridge                              │
│     https://terryapi.cpolar.top  ⬅️ 新增！ │
│     ↓                                       │
│     localhost:8082                          │
│                                             │
│  3. OpenClaw Gateway                        │
│     https://terrysopenclaw.cpolar.top       │
│     ↓                                       │
│     localhost:18789                         │
│                                             │
└─────────────────────────────────────────────┘
```

## 前端自动检测逻辑

前端代码已更新，能自动检测访问环境：

```javascript
const GATEWAY_CONFIG = {
    url: (() => {
        const hostname = window.location.hostname;
        // 公网访问
        if (hostname.includes('cpolar.top')) {
            return 'https://terryapi.cpolar.top';
        }
        // 本地访问
        return 'http://localhost:8082';
    })()
};
```

**效果：**
- 用户从 `https://terryzin.cpolar.top` 访问 → 自动使用 `https://terryapi.cpolar.top`
- 用户从 `http://localhost:8081` 访问 → 自动使用 `http://localhost:8082`

## 测试清单

### ✅ 本地访问测试
- [ ] 访问 http://localhost:8081
- [ ] Gateway 状态显示正常
- [ ] Agents 列表显示正常
- [ ] Cron 任务显示正常
- [ ] 更新日志显示正常

### ✅ 公网访问测试（手机/其他设备）
- [ ] 访问 https://terryzin.cpolar.top
- [ ] Gateway 状态显示正常
- [ ] Agents 列表显示正常
- [ ] Cron 任务显示正常
- [ ] 更新日志显示正常
- [ ] 无 `localhost:8082` 错误

## 常见问题

### Q1: cpolar 服务重启后，terryapi 隧道没有启动？

**检查：**
```bash
# 查看 cpolar 日志
tail -f C:\Users\chenlei\.cpolar\cpolar.log
```

**可能原因：**
- 子域名 `terryapi` 已被占用
- 配置文件格式错误（YAML 缩进）

**解决：**
- 修改 subdomain 为其他名称
- 检查 cpolar.yml 的缩进（使用空格，不用 Tab）

### Q2: 前端仍然提示 localhost:8082 错误？

**检查：**
1. 清除浏览器缓存（Ctrl + Shift + Delete）
2. 强制刷新（Ctrl + F5）
3. 查看浏览器控制台，确认使用的 API 地址

### Q3: API Bridge 返回 502 错误？

**原因：** API Bridge 服务未运行

**解决：**
```bash
cd D:\.openclaw\workspace\my-dashboard
node server/api-bridge.js
```

## 安全建议

### 1. 修改默认子域名
```yaml
ErgoAPI:
  subdomain: your-custom-name  # 修改为不易猜测的名称
```

### 2. 启用 API 密钥（已实现）
- 前端已配置 X-Ergo-Key 认证
- 默认密钥：`ergo-default-secret-key-2026`
- 建议修改为自定义密钥

### 3. 限制访问地域
```yaml
ErgoAPI:
  subdomain: terryapi
  region: cn_top  # 仅中国大陆访问
```

## 费用说明

**Cpolar 免费版：**
- 支持 2 个隧道
- 需升级到专业版支持 3+ 隧道

**解决方案：**
- 方案 A：升级 cpolar 专业版
- 方案 B：合并前端和 API Bridge 到同一端口（需要修改架构）

---

**更新日期：** 2026-02-20
**版本：** v1.3.0
**作者：** Ergo Team
