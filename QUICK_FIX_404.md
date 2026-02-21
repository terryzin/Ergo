# 🚨 404 快速修复指南

**问题**: https://terryzin.cpolar.top 返回 404
**根本原因**: cpolar 隧道没有正确连接到端口 8081

---

## ⚡ 最快解决方案（3 分钟）

### 方法 1: 在 cpolar Web UI 手动配置（推荐）⭐

1. **打开 cpolar Web UI**:
   ```
   http://localhost:4040
   ```

2. **点击页面上的 "Tunnels" 或 "状态" 菜单**

3. **查看当前隧道列表**:
   - 如果看到隧道指向的不是 8081，需要重新创建
   - 如果没有隧道，需要手动创建

4. **手动创建/修改隧道**:

   **如果有 "在线隧道管理" 按钮**:
   - 点击创建新隧道
   - 填写：
     - 隧道名称: `ergo`
     - 协议: `http`
     - 本地地址: `8081`  ⭐ 关键！
     - 子域名前缀: `terryzin`
     - 地区: `cn`

   **如果是命令行界面**:
   - 按 `Ctrl+C` 停止当前隧道
   - 运行新命令（见方法 2）

5. **验证隧道**:
   - 在 Web UI 中应该看到：
     ```
     https://terryzin.cpolar.top → http://localhost:8081
     ```

6. **测试访问**:
   ```
   https://terryzin.cpolar.top
   ```

---

### 方法 2: 命令行手动启动（快速）

**步骤 1**: 打开 **普通** 命令提示符（不需要管理员）

**步骤 2**: 运行以下命令

```bash
cd D:\.openclaw\workspace\my-dashboard
cpolar http 8081 -subdomain=terryzin -region=cn
```

**步骤 3**: 看到类似输出：

```
Session Status                online
Account                       terryzin (Plan: Pro)
Region                        China (cn)
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://terryzin.cpolar.top -> http://localhost:8081
```

**步骤 4**: 保持该窗口打开，测试访问：
```
https://terryzin.cpolar.top
```

**重要**:
- ⚠️ 不要关闭命令提示符窗口！
- ⚠️ 关闭后隧道会断开

---

### 方法 3: 使用启动脚本

**直接双击运行**（不需要管理员权限）:
```
START_TUNNEL_MANUAL.bat
```

脚本会：
1. 检查本地服务（8081）
2. 停止 cpolar 服务
3. 手动启动隧道
4. 打开 Web UI 和公网地址验证

---

## 🔍 验证清单

### ✅ 本地服务检查

```bash
# 检查 8081 是否响应
curl http://localhost:8081
```

**应该看到**: HTML 页面内容

**如果失败**: 运行 `npm run start:all` 启动服务

### ✅ cpolar 隧道检查

访问: http://localhost:4040

**应该看到**:
- Tunnel Status: **online** ✅
- Forwarding: **https://terryzin.cpolar.top** → **http://localhost:8081** ✅

**如果配置错误**:
- Local address 不是 8081 → 需要重新创建隧道
- 没有隧道 → 使用方法 2 手动启动

### ✅ 公网访问检查

```bash
# 等待 10 秒让隧道稳定
# 然后访问
https://terryzin.cpolar.top
```

---

## 🐛 问题诊断

### 症状 1: Web UI (4040) 打不开

**原因**: cpolar 进程没有运行

**解决**:
```bash
# 手动启动
cpolar http 8081 -subdomain=terryzin -region=cn
```

### 症状 2: Web UI 显示 "offline"

**原因**: 网络连接问题或 cpolar 账号问题

**解决**:
1. 检查网络连接
2. 登录 cpolar 官网检查账号状态: https://dashboard.cpolar.com
3. 确认 `terryzin` 子域名绑定到当前设备

### 症状 3: 隧道地址不是 terryzin.cpolar.top

**原因**:
- 子域名已被占用
- 未配置 Pro 版固定子域名

**解决**:
1. 访问 cpolar 官网: https://dashboard.cpolar.com
2. 进入 "预留" → "二级域名"
3. 确认 `terryzin` 绑定到当前设备
4. 如果未绑定，点击 "绑定"

### 症状 4: 本地 8081 没有响应

**原因**: 前端服务未启动

**解决**:
```bash
cd D:\.openclaw\workspace\my-dashboard
npm run start:all
```

等待服务启动（约 10 秒），然后重新启动隧道

---

## 📊 当前服务状态确认

运行以下命令确认所有服务：

```bash
# 检查端口监听
netstat -ano | findstr "8081 8082 18789"

# 应该看到:
#   8081 - Frontend Proxy
#   8082 - API Bridge
#   18789 - OpenClaw Gateway
```

如果端口未监听，运行：
```bash
npm run start:all
```

---

## 🎯 完整操作流程（从头开始）

### 第 1 步: 启动所有本地服务

```bash
cd D:\.openclaw\workspace\my-dashboard
npm run start:all
```

等待 10 秒，确认服务启动。

### 第 2 步: 启动 cpolar 隧道

**选项 A - Web UI 手动配置**（推荐）:
- 访问 http://localhost:4040
- 手动创建隧道: 8081 → terryzin

**选项 B - 命令行启动**（快速）:
```bash
cpolar http 8081 -subdomain=terryzin -region=cn
```

### 第 3 步: 验证隧道

访问 http://localhost:4040 确认：
- Status: online
- Forwarding: terryzin.cpolar.top → 8081

### 第 4 步: 测试访问

等待 10 秒，然后访问：
```
https://terryzin.cpolar.top
```

---

## 💡 为什么会出现 404？

**根本原因**: cpolar 隧道指向了错误的端口或根本没有隧道

**可能的情况**:
1. ❌ 隧道指向了 18789（Gateway）而不是 8081（Frontend）
2. ❌ cpolar 服务启动但没有加载配置文件
3. ❌ 配置文件路径错误，cpolar 使用了默认配置
4. ❌ 隧道根本没有启动

**解决方案**: 手动启动隧道，确保指向 8081

---

## 🔧 持久化解决方案（可选）

如果希望开机自动启动隧道：

### Windows 计划任务方式

1. 打开"任务计划程序"
2. 创建基本任务
3. 触发器: 用户登录时
4. 操作: 启动程序
   - 程序: `cpolar.exe`
   - 参数: `http 8081 -subdomain=terryzin -region=cn`
5. 保存

---

## 📞 仍然无法解决？

### 检查清单

- [ ] 本地 8081 可以访问（curl http://localhost:8081）
- [ ] cpolar Web UI 可以打开（http://localhost:4040）
- [ ] 隧道状态显示 online
- [ ] 隧道地址是 terryzin.cpolar.top
- [ ] 隧道指向 localhost:8081（不是 18789）
- [ ] 等待了至少 1 分钟让隧道初始化

### 获取详细信息

运行诊断脚本：
```bash
scripts\check-cpolar-status.bat
```

拍照或截图发给我：
1. cpolar Web UI 页面（http://localhost:4040）
2. 命令行启动 cpolar 的输出
3. 浏览器访问 terryzin.cpolar.top 的错误信息

---

**最快解决**: 现在就打开 http://localhost:4040，查看隧道配置！
