# Cpolar + Ergo + OpenClaw 外部访问问题汇总

> 生成时间: 2026-02-18 22:59
> 作者: OpenClaw Agent

---

## 需求背景

陈磊需要在外部网络（家用电脑、手机）通过cpolar访问：
1. **Ergo Dashboard** - 项目总入口
2. **OpenClaw Gateway** - OpenClaw控制台

目标：
- 使用单一域名 `terryzin.cpolar.cn`
- Ergo作为根路径 `/`
- OpenClaw作为子路径 `/openclaw`

---

## 当前基础设施

### 本地服务端口
| 服务 | 端口 | 状态 |
|------|------|------|
| Ergo Dashboard | 8081 (Python http.server) | ✅ 运行中 |
| OpenClaw Gateway | 18789 | ✅ 运行中 |
| 代理服务 | 8081 (当前) | ✅ 运行中 |

### OpenClaw Gateway 认证
- 端口: 18789
- Token: `f2009973e92e96b0e31c30b30500e997`
- 认证方式: Bearer Token

### Cpolar配置
```yaml
authtoken: YmM1NmM5M2YtMjUwNS00ODQwLWEzYzYtZmVkY2M2ZDYyYTk0
tunnels:
  ergo:
    proto: http
    addr: "8081"
    subdomain: terryzin
    websocket: true
```

---

## 问题与解决方案演进

### 方案1: 双 subdomain（付费版）

**配置:**
- `terryzin.cpolar.cn` → Ergo (8081)
- `openclaw.terryzin.cpolar.cn` → OpenClaw (8082)

**问题:** 陈磊要求用单一域名 + 子路径

---

### 方案2: 单域名 + 路径转发（当前方案）

**思路:** 用代理服务器做路径转发

#### 2.1 初始代理（简单HTTP代理）
- 监听 8090 端口
- `/` → 8081 (Ergo)
- `/openclaw` → 8082 (status-server.js)

**问题:** 
- Ergo服务没有运行在8081
- 8082返回404

---

#### 2.2 直接代理到 Gateway WebUI
- `/openclaw` → 127.0.0.1:18789

**问题:**
- Cpolar配置两个相同subdomain冲突
- 需要重启cpolar服务

---

#### 2.3 静态文件服务 + 代理混合
- 自己服务Ergo静态文件
- `/openclaw` 转发到 Gateway

**文件:** `D:\.openclaw\workspace\proxy-server.js`

**问题:**
- OpenClaw前端资源路径错误
- 404: `/assets/index-*.css`, `/assets/index-*.js`

---

#### 2.4 修复资源路径
- 代理转发时重写HTML中的资源路径
- `./assets/` → `/openclaw/assets/`

**问题:**
- 页面能打开
- WebSocket连接失败
- 错误: `disconnected (1006): no reason`

---

#### 2.5 添加WebSocket支持
- 添加WebSocket升级代理

**问题:**
- Cpolar默认不支持WebSocket
- 需要在cpolar.yml添加 `websocket: true`

---

#### 2.6 启用WebSocket + 重启
- 添加 `websocket: true` 到cpolar配置
- 重启cpolar服务

**当前状态:**
- 代理运行正常 (`localhost:8081`测试通过)
- Cpolar隧道有时不稳定
- WebSocket连接仍然失败

---

## 已知问题

### 1. Cpolar隧道不稳定
**症状:** 
- Tunnel unavailable
- "A website server must be running on port http://localhost:8081"

**可能原因:**
- 代理服务意外终止
- Cpolar服务需要重启

### 2. WebSocket连接失败
**症状:**
- 页面打开成功
- "Disconnected from gateway. disconnected (1006): no reason"

**可能原因:**
- Cpolar WebSocket配置未生效
- 代理WebSocket转发逻辑问题
- Gateway WebUI的WebSocket路径需要特殊处理

---

## 当前文件清单

### 代理服务
- `D:\.openclaw\workspace\proxy-server.js` - 主代理服务

### Cpolar配置
- `C:\Users\chenlei\.cpolar\cpolar.yml` - 隧道配置
- `C:\Users\chenlei\.cpolar\logs\cpolar_service.log` - 日志

### Ergo
- `D:\.openclaw\workspace\my-dashboard\` - Ergo源码目录

---

## 待验证方案

### 方案A: 直接暴露Gateway（放弃路径方案）
- Cpolar两个独立隧道:
  - `terryzin.cpolar.cn` → Ergo (8081)
  - `openclaw.terryzin.cpolar.cn` → Gateway (18789)

**优点:** 简单稳定，无需代理
**缺点:** 需要两个子域名

### 方案B: 使用Nginx或Caddy做专业反向代理
- 替代当前Node.js代理
- 更稳定的WebSocket支持
- 更好的性能

### 方案C: 直接在Ergo页面嵌入OpenClaw iframe
- Ergo页面添加OpenClaw链接或iframe
- 跳转到独立域名

---

## 建议的下一步

1. **先验证当前代理是否工作:**
   - 访问 `terryzin.cpolar.cn/` 看Ergo是否正常
   - 访问 `terryzin.cpolar.cn/openclaw` 看OpenClaw是否正常

2. **如果WebSocket仍失败:**
   - 考虑方案A（双域名）
   - 或使用nginx替代当前代理

3. **记录每次修改:**
   - 避免重复踩坑
   - 便于回滚

---

## 快速命令参考

```bash
# 重启代理
node D:\.openclaw\workspace\proxy-server.js

# 重启cpolar
sc stop cpolar
sc start cpolar

# 测试本地
curl http://localhost:8081/
curl http://localhost:8081/openclaw/
```
