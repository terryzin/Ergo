# v1.3.0 自动配对系统 - 手动测试指南

## 测试准备

### 1. 确认服务运行状态

**API Bridge:**
```bash
# 应该看到以下输出：
╔════════════════════════════════════════════╗
║   Ergo API Bridge Server                  ║
╠════════════════════════════════════════════╣
║   Auth: Enabled ✓            ║
║   Secret: ergo-def...              ║
╚════════════════════════════════════════════╝

🔐 认证已启用 - 前端需要提供 X-Ergo-Key
   密钥: ergo-default-secret-key-2026
```

**前端服务器:**
```bash
# 访问应该正常：http://localhost:8081
```

---

## 测试场景

### 场景 1：首次访问（自动使用默认密钥）✅

**步骤：**
1. 打开浏览器隐私模式（确保 localStorage 为空）
2. 访问 http://localhost:8081
3. 打开浏览器控制台（F12）

**预期结果：**
- ✅ 页面正常加载
- ✅ Gateway 状态显示"在线"
- ✅ Agent、Cron 任务正常显示
- ✅ 更新日志正常加载
- ✅ 控制台无 401 错误
- ✅ localStorage 中存在 `ergoApiKey` = `ergo-default-secret-key-2026`

**验证命令（浏览器控制台）：**
```javascript
// 检查密钥
localStorage.getItem('ergoApiKey')
// 应该输出: "ergo-default-secret-key-2026"
```

---

### 场景 2：访问设置页面 ✅

**步骤：**
1. 在首页向下滚动到"系统设置"卡片
2. 点击"API 密钥配置"
3. 查看当前密钥（点击"显示"按钮）

**预期结果：**
- ✅ 成功跳转到 settings.html
- ✅ 显示当前密钥：`ergo-default-secret-key-2026`
- ✅ 页面样式正常（Apple 风格深色主题）
- ✅ "使用说明"和"安全提示"显示正常

---

### 场景 3：修改密钥（成功场景）✅

**步骤：**
1. 在 settings.html 页面
2. 点击"使用默认密钥"按钮（填充输入框）
3. 修改为相同的密钥：`ergo-default-secret-key-2026`
4. 点击"保存设置"
5. 返回首页（点击"← 返回首页"）

**预期结果：**
- ✅ 显示"设置已保存！刷新页面后生效。"
- ✅ 返回首页后页面正常工作
- ✅ 数据正常加载
- ✅ 无 401 错误

---

### 场景 4：错误密钥（认证失败）❌

**步骤：**
1. 打开浏览器控制台（F12）
2. 执行以下命令修改密钥为错误值：
```javascript
localStorage.setItem('ergoApiKey', 'wrong-wrong-wrong');
```
3. 刷新页面（F5）

**预期结果：**
- ❌ 页面显示"无法连接到 Gateway"
- ❌ 控制台出现 401 错误
- ✅ 自动弹出密钥配置提示框
- ✅ 提示信息：`🔐 需要配置 API 密钥`

**修复步骤：**
1. 在弹出的提示框中输入正确密钥：`ergo-default-secret-key-2026`
2. 点击确定

**修复后结果：**
- ✅ 页面自动刷新
- ✅ 数据正常加载
- ✅ 无错误提示

---

### 场景 5：清空密钥（自动回退默认）✅

**步骤：**
1. 打开浏览器控制台（F12）
2. 清空密钥：
```javascript
localStorage.removeItem('ergoApiKey');
```
3. 刷新页面（F5）

**预期结果：**
- ✅ 自动使用默认密钥
- ✅ localStorage 中重新保存 `ergoApiKey`
- ✅ 页面正常工作
- ✅ 数据正常加载

---

### 场景 6：后端 API 测试（curl）✅

**无密钥访问：**
```bash
curl http://localhost:8082/api/status
```
**预期输出：**
```json
{
  "error": "Missing API key",
  "message": "请在请求头中提供 X-Ergo-Key",
  "hint": "首次访问请配置密钥"
}
```

**错误密钥：**
```bash
curl -H "X-Ergo-Key: wrong-key" http://localhost:8082/api/status
```
**预期输出：**
```json
{
  "error": "Invalid API key",
  "message": "密钥无效，请检查配置"
}
```

**正确密钥：**
```bash
curl -H "X-Ergo-Key: ergo-default-secret-key-2026" http://localhost:8082/api/status
```
**预期输出：**
```json
{
  "gateway": { "status": "online", ... },
  "agents": [...],
  "cron": [...],
  "_meta": { "cached": true, ... }
}
```

**健康检查（无需密钥）：**
```bash
curl http://localhost:8082/health
```
**预期输出：**
```json
{
  "status": "ok",
  "timestamp": "2026-02-20T..."
}
```

---

### 场景 7：多浏览器同步（模拟多端）✅

**步骤：**
1. 在 Chrome 访问 http://localhost:8081
2. 打开控制台，执行：
```javascript
localStorage.setItem('ergoApiKey', 'my-custom-key-123');
```
3. 修改后端密钥：
```bash
# 重启 API Bridge 并设置自定义密钥
set ERGO_SECRET=my-custom-key-123 && node server/api-bridge.js
```
4. 刷新 Chrome 页面

**预期结果：**
- ✅ Chrome 页面正常工作（使用 my-custom-key-123）

**然后在 Firefox/Edge：**
1. 访问 http://localhost:8081
2. 打开控制台，执行：
```javascript
localStorage.setItem('ergoApiKey', 'my-custom-key-123');
```
3. 刷新页面

**预期结果：**
- ✅ Firefox/Edge 也正常工作
- ✅ 多端使用同一密钥，体验一致

---

## 测试检查清单

### 基本功能
- [ ] 首次访问自动使用默认密钥
- [ ] 密钥保存到 localStorage
- [ ] 所有 API 请求自动添加 X-Ergo-Key Header
- [ ] 401 错误触发重新配对提示
- [ ] 设置页面正常显示和保存

### 认证逻辑
- [ ] 无密钥返回 401
- [ ] 错误密钥返回 401
- [ ] 正确密钥返回 200
- [ ] 健康检查无需认证
- [ ] 错误提示信息友好

### 用户体验
- [ ] 首次访问无感知（自动配对）
- [ ] 密钥配置界面友好
- [ ] 显示/隐藏密钥功能正常
- [ ] 使用说明清晰
- [ ] 返回首页导航正常

### 边界情况
- [ ] localStorage 清空后能恢复
- [ ] 密钥修改后立即生效
- [ ] 页面刷新不丢失密钥
- [ ] 错误密钥能正常修复
- [ ] 缓存元数据正确返回

---

## 常见问题排查

### 问题 1：页面一直显示"无法连接"

**原因：** 密钥不匹配

**解决：**
1. 检查后端密钥（控制台日志）
2. 检查前端密钥：
```javascript
localStorage.getItem('ergoApiKey')
```
3. 确保两者一致

---

### 问题 2：设置页面 404

**原因：** settings.html 未部署

**解决：**
```bash
cd D:\.openclaw\workspace\my-dashboard
git pull origin main
```

---

### 问题 3：控制台报跨域错误

**原因：** API Bridge CORS 配置

**解决：** API Bridge 已启用 CORS，检查是否正确启动

---

## 自动化测试

运行自动化测试验证认证系统：

```bash
cd D:\.openclaw\workspace\my-dashboard
node tests/run-auth-tests.js
```

**预期输出：**
```
╔════════════════════════════════════════╗
║  测试结果: 10 通过 / 0 失败       ║
╚════════════════════════════════════════╝
```

---

## 测试完成标准

✅ 所有场景测试通过
✅ 无控制台错误
✅ 用户体验流畅
✅ 密钥配置简单
✅ 多端同步正常

---

**测试日期：** 2026-02-20
**版本：** v1.3.0
**测试人：** _________
**测试结果：** ✅ 通过 / ❌ 失败
