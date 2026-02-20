# 公网访问测试指南

## 测试目标
验证通过 https://terryzin.cpolar.top 访问时，前端能正常通过代理连接到 API Bridge，不再出现 `localhost:8082` 错误。

## 前提条件

✅ **服务运行状态：**
```bash
# 检查端口占用
netstat -ano | findstr "8081 8082"

# 应该看到：
# TCP    0.0.0.0:8081    ... LISTENING
# TCP    0.0.0.0:8082    ... LISTENING
```

✅ **Cpolar 隧道状态：**
- Ergo 前端：https://terryzin.cpolar.top → localhost:8081
- OpenClaw Gateway：https://terrysopenclaw.cpolar.top → localhost:18789

## 测试步骤

### 1️⃣ 本地验证（服务器端）

**测试前端代理：**
```bash
# 健康检查
curl http://localhost:8081/api/health
# 预期：{"status":"ok","timestamp":"2026-02-20T..."}

# API 状态（需要密钥）
curl -H "X-Ergo-Key: ergo-default-secret-key-2026" \
     http://localhost:8081/api/status
# 预期：返回 Gateway 状态 JSON

# 前端页面
curl http://localhost:8081 | grep "Ergo"
# 预期：包含 "Ergo" 的 HTML
```

### 2️⃣ 公网 API 测试（任意设备）

**测试 cpolar 通道 + 前端代理：**
```bash
# 健康检查（无需认证）
curl https://terryzin.cpolar.top/api/health
# 预期：{"status":"ok","timestamp":"..."}

# API 状态（带认证）
curl -H "X-Ergo-Key: ergo-default-secret-key-2026" \
     https://terryzin.cpolar.top/api/status
# 预期：Gateway 状态 JSON
```

### 3️⃣ 浏览器测试（手机/其他电脑）

**A. 清除浏览器缓存：**
- Chrome/Edge: `Ctrl + Shift + Delete` → 清除缓存和 Cookie
- Safari: 设置 → Safari → 清除历史记录和网站数据
- 或使用隐私/无痕模式

**B. 访问前端：**
```
https://terryzin.cpolar.top
```

**C. 检查控制台（F12 → Console）：**

✅ **成功标志：**
```
[console.log] 使用相对路径 API: /api/status
[console.log] 网络状态: 实时
```

❌ **失败标志：**
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
localhost:8082/api/status
```

**D. 检查网络请求（F12 → Network）：**

✅ **正确行为：**
- 请求 URL: `https://terryzin.cpolar.top/api/status`
- Status: 200 OK
- Response: JSON 数据

❌ **错误行为：**
- 请求 URL: `http://localhost:8082/api/status`
- Status: Failed (CORS/Connection Refused)

### 4️⃣ 功能验证

**在浏览器中测试以下功能：**

| 功能 | 预期结果 |
|------|---------|
| Gateway 状态卡片 | 显示"运行中"（绿色） |
| 网络状态 | "实时"（绿色）或"缓存"（蓝色） |
| Agents 列表 | 显示真实 Agent 列表 |
| Cron 任务 | 显示真实任务列表 |
| 更新日志 | 显示 changelog.html 内容 |
| 手动刷新按钮 | 点击后重新加载数据 |
| Gateway 重启 | 弹出确认，API 调用成功 |

### 5️⃣ 错误处理测试

**A. 停止 API Bridge：**
```bash
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Ergo API Bridge"
```

**预期表现：**
- Gateway 状态：离线（红色）
- 网络状态：连接失败（红色）
- Agents 列表：无法加载 / --
- **不应显示** Mock 数据

**B. 恢复 API Bridge：**
```bash
node server/api-bridge.js
```

**预期表现：**
- 刷新页面后恢复正常
- 自动从缓存加载（如果有）

## 测试检查清单

### ✅ 本地访问（localhost:8081）

- [ ] `/api/health` 返回 200 OK
- [ ] `/api/status` 返回完整 JSON
- [ ] 前端页面正常显示
- [ ] 控制台无错误

### ✅ 公网访问（terryzin.cpolar.top）

- [ ] `/api/health` 返回 200 OK
- [ ] `/api/status` 返回完整 JSON
- [ ] 前端页面正常显示
- [ ] 控制台无 `localhost:8082` 错误
- [ ] Network 标签显示请求正确代理

### ✅ 功能测试

- [ ] Gateway 状态正确显示
- [ ] Agents 列表正确显示
- [ ] Cron 任务正确显示
- [ ] 更新日志正确显示
- [ ] 手动刷新按钮工作正常
- [ ] Gateway 重启功能工作正常

### ✅ 错误处理

- [ ] API Bridge 停止时显示"连接失败"
- [ ] 不显示 Mock 数据
- [ ] API Bridge 恢复后正常工作

## 常见问题

### Q1: 仍然显示 localhost:8082 错误

**原因：** 浏览器缓存了旧版本前端代码

**解决：**
1. 强制刷新：`Ctrl + F5` (Windows/Linux) 或 `Cmd + Shift + R` (Mac)
2. 清除缓存：浏览器设置 → 清除缓存
3. 使用隐私/无痕模式重新打开

### Q2: API 返回 502 错误

**原因：** API Bridge (8082) 未运行

**检查：**
```bash
netstat -ano | findstr "8082"
```

**解决：**
```bash
node server/api-bridge.js
```

### Q3: cpolar 隧道 502 错误

**原因：** 前端服务 (8081) 未运行

**检查：**
```bash
netstat -ano | findstr "8081"
```

**解决：**
```bash
node server/frontend-with-proxy.js
```

### Q4: CORS 跨域错误

**原因：** 理论上不应出现（代理已处理）

**检查：**
- 确认 `frontend-with-proxy.js` 中有 `changeOrigin: true`
- 确认前端使用相对路径 `/api/*` 而非绝对路径

### Q5: API 返回 401 Unauthorized

**原因：** 前端未正确传递密钥

**检查：**
```javascript
// 浏览器控制台
localStorage.getItem('ergo-api-key')
// 应该返回: "ergo-default-secret-key-2026"
```

**解决：**
```javascript
localStorage.setItem('ergo-api-key', 'ergo-default-secret-key-2026');
location.reload();
```

## 性能基准

**期望响应时间：**
- 本地访问：< 50ms
- 公网访问（cpolar）：100-300ms（取决于网络）
- 缓存命中：< 10ms

**负载测试：**
```bash
# 测试 100 个并发请求
ab -n 100 -c 10 https://terryzin.cpolar.top/api/health
```

## 回滚方案

如果新方案出现问题，可以临时回滚到 Python 服务器：

```bash
# 停止 Express 服务
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Ergo Frontend"

# 启动 Python 服务器
cd D:\.openclaw\workspace\my-dashboard
python -m http.server 8081

# 恢复旧版代码
git revert 17efd15
```

**注意：** 回滚后外部访问仍会有 `localhost:8082` 问题。

---

**测试日期：** 2026-02-20
**版本：** v1.3.0
**测试人员：** [待填写]
**测试结果：** [ ] 通过 / [ ] 失败

**备注：**
_____________________________________
_____________________________________
