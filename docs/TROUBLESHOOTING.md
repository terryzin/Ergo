# 故障排查指南

## 浏览器缓存问题

### 症状
- 页面显示 "404 Not Found" 错误（logo.png, realtime.js 等）
- 控制台出现 `ReferenceError: RealtimeService is not defined`
- 页面内容与服务器实际文件不一致

### 原因
浏览器缓存了旧版本的 HTML 文件，导致加载过期的代码或资源引用。

### 解决方案

#### 方案 1：硬刷新浏览器缓存（推荐）⭐
1. **Windows/Linux**: 按 `Ctrl + F5` 或 `Ctrl + Shift + R`
2. **Mac**: 按 `Cmd + Shift + R`
3. 刷新后检查控制台是否还有错误

#### 方案 2：清除浏览器缓存
1. 打开浏览器设置
2. 进入 "隐私和安全" → "清除浏览数据"
3. 勾选 "缓存的图片和文件"
4. 点击 "清除数据"

#### 方案 3：使用无痕/隐私模式
1. **Chrome**: `Ctrl + Shift + N`
2. **Firefox**: `Ctrl + Shift + P`
3. **Edge**: `Ctrl + Shift + N`

### 预防措施
从 v1.5.0 开始，前端服务器已配置 `Cache-Control: no-cache` 响应头，防止 HTML 文件被浏览器缓存。

如仍遇到缓存问题，可在 URL 后添加版本参数强制刷新：
```
https://terryzin.cpolar.cn/projects-manage.html?v=1.5.0
```

---

## API Bridge 连接失败

### 症状
- `net::ERR_CONNECTION_REFUSED` 错误
- 项目管理页面显示 "加载失败"
- Gateway 状态显示 "离线"

### 解决方案

#### 1. 检查 API Bridge 是否运行
```bash
netstat -ano | grep :8082
```
如果没有输出，说明 API Bridge 未启动：
```bash
cd D:\.openclaw\workspace\my-dashboard
node server/api-bridge.js
```

#### 2. 检查前端服务器是否运行
```bash
netstat -ano | grep :8081
```
如果没有输出，启动前端服务器：
```bash
npm start
```

#### 3. 确认使用代理模式访问
从外部网络（如 cpolar 公网）访问时，**必须使用代理模式**而非直接访问 `localhost:8082`。

✅ **正确**：前端代码使用相对路径
```javascript
const GATEWAY_CONFIG = {
    url: '' // 空字符串使用代理
};
```

❌ **错误**：硬编码 localhost
```javascript
const GATEWAY_CONFIG = {
    url: 'http://localhost:8082' // 外网无法访问
};
```

---

## WebSocket 连接失败

### 症状
- 控制台显示 WebSocket 连接错误
- 实时更新功能不工作
- 连接状态显示 "离线"

### 解决方案

#### 1. 检查 WebSocket URL 配置
index.html 和 dashboard.html 应使用**动态协议**：
```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.host;
const wsUrl = `${protocol}//${host}`;
```

#### 2. 确认前端服务器启用 WebSocket 代理
检查 `server/frontend-with-proxy.js`:
```javascript
const apiProxy = createProxyMiddleware({
    target: API_BRIDGE_URL,
    ws: true, // 必须启用
    // ...
});

// 必须绑定 upgrade 事件
server.on('upgrade', (req, socket, head) => {
    apiProxy.upgrade(req, socket, head);
});
```

#### 3. 检查 API Bridge 的 WebSocket 服务器
确认 `server/api-bridge.js` 已创建 WebSocket 服务器：
```javascript
const wss = new WebSocket.Server({ noServer: true });
```

---

## Cpolar 隧道问题

### 症状
- 公网域名无法访问
- 显示 "隧道未连接" 或 "404 Not Found"

### 解决方案

#### 1. 检查 cpolar 进程是否运行
```bash
tasklist | grep cpolar
```

#### 2. 重启 cpolar 服务
```bash
# 停止服务
net stop cpolar

# 启动服务
net start cpolar
```

#### 3. 验证隧道配置
访问 cpolar 控制台：http://localhost:9200

确认以下隧道已启动：
- `ergo-dashboard`: `localhost:8081` → `https://terryzin.cpolar.cn`
- `openclaw-gateway`: `localhost:18789` → `https://terrysopenclaw.cpolar.cn`

---

## 测试失败

### 症状
- `npm test` 运行失败
- 部分测试用例报错

### 解决方案

#### 1. 确保所有服务都在运行
```bash
# 检查端口占用
netstat -ano | grep -E ':(8081|8082|18789)'
```

必须有 3 个服务在运行：
- Frontend Server (8081)
- API Bridge (8082)
- OpenClaw Gateway (18789)

#### 2. 公网测试超时
公网延迟测试（如缓存响应时间 < 500ms）可能因网络波动失败，属于正常现象。

可以单独运行本地测试：
```bash
npm run test:local
```

#### 3. API 认证失败
确认 API Key 配置正确：
```javascript
localStorage.setItem('ergoApiKey', 'ergo-default-secret-key-2026');
```

---

## 常见错误代码

| 错误代码 | 含义 | 解决方案 |
|---------|------|---------|
| `ERR_CONNECTION_REFUSED` | 服务器未运行 | 启动对应服务（8081/8082/18789） |
| `ERR_NAME_NOT_RESOLVED` | 域名无法解析 | 检查 cpolar 隧道状态 |
| `404 Not Found` | 资源不存在 | 清除浏览器缓存并硬刷新 |
| `502 Bad Gateway` | API Bridge 不可用 | 启动 `node server/api-bridge.js` |
| `CORS Error` | 跨域请求被阻止 | 使用代理模式而非直接访问 |

---

## 快速诊断命令

```bash
# 一键检查所有服务状态
netstat -ano | grep -E ':(8081|8082|18789)' | grep LISTENING

# 查看前端服务器日志
tail -f frontend-server.log

# 查看 API Bridge 日志
tail -f api-bridge.log

# 测试 API 连接性
curl -I http://localhost:8082/api/status

# 测试前端访问
curl -I http://localhost:8081/

# 清除所有 Node.js 进程（谨慎使用）
taskkill /F /IM node.exe
```

---

## 联系支持

如果以上方案都无法解决问题，请提供以下信息：

1. **错误截图**（包含完整控制台输出）
2. **服务运行状态**：
   ```bash
   netstat -ano | grep -E ':(8081|8082|18789)'
   ```
3. **浏览器信息**（Chrome/Firefox/Edge 版本号）
4. **访问方式**（本地 localhost / 公网 cpolar）
5. **复现步骤**

请在 GitHub Issues 提交问题：https://github.com/your-repo/ergo/issues
