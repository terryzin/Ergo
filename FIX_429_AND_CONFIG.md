# 🔧 配置修复和 429 错误解决方案

**修复时间**: 2026-02-21
**问题**: Gateway 无法访问 + API 配置错误 + 429 限流错误

---

## ✅ 已修复的问题

### 1. Gateway 外网访问恢复 ⭐

**问题**: 之前添加了 alert 阻止外网访问 Gateway

**修复**:
```javascript
// index.html (行 1684-1692)
if (hostname === 'localhost' || hostname === '127.0.0.1') {
    gatewayUrl = 'http://localhost:18789';
} else {
    // 通过 API 代理访问 Gateway
    gatewayUrl = '/api/gateway/webui';
}
```

**说明**: 外网环境下，Gateway 通过前端代理 (`/api`) 访问，而不是完全禁止。

---

### 2. API Base 配置修复 ⭐

**问题**: `apiBase: ''` 导致所有 API 调用失败

**修复**:
```javascript
// src/config.js (行 32-34)
// 外网环境 - 通过前端代理访问 API
return '/api';  // 之前是 return '';
```

**效果**:
- **本地**: `apiBase = 'http://localhost:8082'`
- **外网**: `apiBase = '/api'`

**API 调用路径**:
- 本地: `http://localhost:8082/api/health`
- 外网: `https://terryzin.cpolar.cn/api/health`

---

## ⚠️ 待解决：429 Too Many Requests

### 问题分析

**错误日志**:
```
GET https://terryzin.cpolar.cn/api/changelog 429 (Too Many Requests)
GET https://terryzin.cpolar.cn/api/health 429 (Too Many Requests)
GET https://terryzin.cpolar.cn/assets/logo.png 429 (Too Many Requests)
```

**原因**: cpolar 对免费/Pro 版有请求频率限制

- 免费版: ~1000 请求/天
- Pro 版: 限制更宽松，但仍有限制

**触发因素**:
1. 页面加载时多个并发请求
2. WebSocket 频繁重连
3. 定时器（health check每 10 秒）
4. 静态资源请求也计入配额

---

### 解决方案

#### 方案 1: 优化请求频率（推荐）⭐

**1.1 增加健康检查间隔**

找到 `index.html` 中的健康检查代码：
```javascript
// 当前：每 10 秒检查一次
setInterval(checkNetworkHealth, 10000);

// 修改为：每 30 秒检查一次
setInterval(checkNetworkHealth, 30000);
```

**1.2 延迟非关键请求**

```javascript
// 页面加载完成后延迟 2 秒再加载 changelog
setTimeout(() => {
    renderChangelog();
}, 2000);
```

**1.3 添加请求失败重试间隔**

```javascript
// WebSocket 重连间隔从 1 秒增加到 5 秒
reconnectInterval: 5000  // 之前是 1000
```

#### 方案 2: 静态资源本地化

**问题**: logo.png 等静态资源也计入配额

**解决**: 使用 base64 内联或本地缓存

```html
<!-- 使用 base64 编码图片 -->
<img src="data:image/png;base64,..." alt="Logo">
```

#### 方案 3: 使用 localStorage 缓存

**针对 changelog 等不常变化的数据**:

```javascript
// 缓存 changelog，1 小时内不重复请求
const cachedChangelog = localStorage.getItem('changelog');
const cacheTime = localStorage.getItem('changelogTime');

if (cachedChangelog && (Date.now() - cacheTime < 3600000)) {
    // 使用缓存
    renderFromCache(cachedChangelog);
} else {
    // 请求新数据
    fetch('/api/changelog')
        .then(res => res.json())
        .then(data => {
            localStorage.setItem('changelog', JSON.stringify(data));
            localStorage.setItem('changelogTime', Date.now());
        });
}
```

#### 方案 4: 升级 cpolar 套餐

如果以上方案仍不够：
- 考虑升级到更高级别的 cpolar 套餐
- 或者自建反向代理服务器

---

## 🚀 立即执行的修复

### 步骤 1: 刷新页面测试配置修复

```bash
# 清除浏览器缓存
Ctrl + Shift + Delete

# 访问
https://terryzin.cpolar.cn
```

**预期**:
- ✅ `apiBase` 不再为空
- ✅ API 调用路径正确（/api/health）

### 步骤 2: 检查 429 错误是否减少

打开浏览器开发者工具（F12）→ Network 标签

查看请求：
- 如果仍然 429 → 执行方案 1（优化频率）
- 如果正常 → 问题已解决

### 步骤 3: 测试 Gateway 访问

点击 "OpenClaw Dashboard" 按钮

**预期**:
- ✅ 不再显示 alert
- ✅ 打开 Gateway WebUI（通过代理）

---

## 📝 需要你执行的优化代码

如果 429 错误仍然频繁，请告诉我，我会帮你修改以下代码：

1. **健康检查间隔** - 从 10s 改为 30s
2. **WebSocket 重连** - 从 1s 改为 5s
3. **Changelog 加载** - 延迟加载 + 缓存
4. **Logo 图片** - base64 内联

---

## 🎯 验证清单

### ✅ 配置修复验证

- [ ] 刷新页面后 `apiBase` 显示为 `/api`
- [ ] Network 标签中 API 请求路径正确
- [ ] Gateway 按钮可以点击（不弹 alert）

### ⚠️ 429 错误验证

- [ ] 查看 Network 标签中 429 错误数量
- [ ] 如果仍然很多，执行优化方案 1

---

## 💡 关于 429 错误的说明

**429 错误不会影响核心功能**，因为：

1. **健康检查有重试机制** - 失败会自动重试
2. **WebSocket 有重连机制** - 断开会自动重连
3. **API 调用有错误处理** - 失败不会崩溃

但是：
- ⚠️ 会导致功能响应变慢
- ⚠️ 用户体验下降
- ⚠️ 可能触发 cpolar 限制

**建议**: 应用方案 1 的优化，减少请求频率。

---

## 🔄 后续步骤

1. **立即**: 刷新页面测试配置修复
2. **如果 429 仍频繁**: 告诉我，我修改请求频率
3. **长期**: 考虑优化资源加载策略

---

**现在请刷新浏览器，清除缓存，测试配置是否修复！** 🚀
