# Ergo 配置管理

## 环境配置自动切换

Ergo 使用 `src/config.js` 实现环境自动检测和 API 地址切换。

### 配置原理

```javascript
// src/config.js
class ErgoConfig {
    detectApiBase() {
        const hostname = window.location.hostname;

        // 本地开发环境
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8082';
        }

        // 外网访问（cpolar 或其他域名）
        return ''; // 相对路径，由前端代理转发
    }
}
```

### 环境检测规则

| 访问域名 | 环境类型 | API Base | 说明 |
|---------|---------|----------|------|
| `localhost` | 本地开发 | `http://localhost:8082` | 直连 API Bridge |
| `127.0.0.1` | 本地开发 | `http://localhost:8082` | 直连 API Bridge |
| `*.cpolar.top` | 外网访问 | `''` (相对路径) | 前端代理转发 |
| 其他域名 | 外网访问 | `''` (相对路径) | 前端代理转发 |

### 使用方式

**1. 在 HTML 中引入配置**

```html
<script src="src/config.js"></script>
```

**2. 使用全局配置对象**

```javascript
// 获取 API Key
const apiKey = ergoConfig.getApiKey();

// 获取 API Base URL
const apiBase = ergoConfig.API_BASE;

// 获取完整 API URL
const apiUrl = ergoConfig.getApiUrl('/api/status');

// 示例：API 请求
fetch(ergoConfig.getApiUrl('/api/health'), {
    headers: {
        'X-Ergo-Key': ergoConfig.getApiKey()
    }
});
```

**3. 环境信息调试**

```javascript
// 获取当前环境信息
const info = ergoConfig.getEnvironmentInfo();
console.log(info);
// {
//   hostname: 'localhost',
//   apiBase: 'http://localhost:8082',
//   isLocal: true,
//   apiKey: 'ergo-defau...'
// }
```

### 前端代理配置

外网访问时，前端代理负责将 `/api/*` 请求转发到 `localhost:8082`。

**server/frontend-with-proxy.js**:
```javascript
// API 代理配置
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:8082',
    changeOrigin: true
}));
```

**工作流程**:
```
浏览器 → https://terryzin.cpolar.top/api/status
         ↓
前端服务器 (8081) 接收请求
         ↓
代理转发 → http://localhost:8082/api/status
         ↓
API Bridge 处理请求
         ↓
返回响应 → 前端服务器 → 浏览器
```

## 配置检查工具

访问 `config-check.html` 检查当前环境配置：

```
http://localhost:8081/config-check.html      # 本地环境
https://terryzin.cpolar.top/config-check.html # 外网环境
```

**功能**:
- ✅ 显示当前域名和环境类型
- ✅ 显示 API Base URL 配置
- ✅ 测试 API 连接状态
- ✅ 显示响应时间和数据

## 部署检查清单

在发布到生产环境前，请确认：

- [ ] ✅ 所有页面已引入 `src/config.js`
- [ ] ✅ 所有 API 请求使用 `ergoConfig.getApiUrl()`
- [ ] ✅ 前端代理正确配置 `/api` 转发
- [ ] ✅ 在外网环境测试 API 连接
- [ ] ✅ 使用 `config-check.html` 验证配置

## 已集成页面

- ✅ `file-browser.html` - 文件浏览器
- ✅ `terminal.html` - 终端命令执行
- ✅ `index.html` - 首页（使用相对路径）
- ✅ `dashboard.html` - 仪表盘（使用相对路径）
- ✅ `projects-manage.html` - 项目管理（使用相对路径）

## 常见问题

**Q: 为什么外网访问时 API Base 是空字符串？**

A: 外网环境下，前端和 API 服务在同一个 Cpolar 隧道内，通过前端代理转发请求。使用相对路径可以避免跨域问题，并且更灵活（域名变更时无需修改代码）。

**Q: 本地开发时无法连接 API？**

A: 确保 API Bridge 服务已启动：`node server/api-bridge.js`，并且监听在 `localhost:8082`。

**Q: 外网访问时 API 请求失败？**

A: 检查前端代理是否正确配置，并确保前端服务器（8081）和 API Bridge（8082）都在运行。

**Q: 如何自定义 API Key？**

A: 使用 `ergoConfig.setApiKey('your-key')`，或在 localStorage 中设置 `ergoApiKey`。

## 技术细节

**为什么不使用环境变量？**

- 静态 HTML 页面无法访问服务端环境变量
- 客户端 JavaScript 无法使用 Node.js 的 `process.env`
- 需要在运行时动态检测环境

**为什么使用 hostname 检测？**

- 简单可靠，无需额外配置
- 自动适配本地开发和外网部署
- 无需修改代码即可在不同环境运行

**为什么创建配置单例？**

- 全局唯一配置对象，避免重复实例化
- 统一管理 API Key 和 Base URL
- 便于调试和测试
