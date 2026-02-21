# 🔍 Cpolar 404 错误诊断和解决方案

**问题**: 访问 `https://terryzin.cpolar.cn` 返回 404 错误

**时间**: 2026-02-21 14:05

---

## 🎯 问题诊断

### 当前状态

✅ **本地服务运行正常**:
- Frontend Proxy (8081): ✅ 运行中，HTTP 200
- API Bridge (8082): ✅ 运行中，健康检查通过
- OpenClaw Gateway (18789): ✅ 运行中

❌ **cpolar 隧道配置问题**:
- cpolar 服务: ✅ 运行中
- **问题**: 隧道可能没有正确指向 8081 端口

---

## 🔧 解决方案

### 方案 1: 运行修复脚本（推荐）⭐

已创建自动修复脚本 `FIX_CPOLAR_TUNNEL.bat`：

```bash
# 1. 右键点击文件
D:\.openclaw\workspace\my-dashboard\FIX_CPOLAR_TUNNEL.bat

# 2. 选择"以管理员身份运行"

# 3. 等待脚本完成（约 30 秒）

# 4. 验证隧道
# - 访问 http://localhost:4040
# - 确认看到: ergo → 8081 → terryzin.cpolar.cn
```

**脚本会自动执行**:
1. 停止并卸载 cpolar 服务
2. 使用正确的配置文件重新安装
3. 启动服务并等待隧道初始化
4. 打开 Web UI 验证

---

### 方案 2: 手动修复（命令行）

如果自动脚本失败，手动执行以下步骤：

#### 步骤 1: 停止服务（管理员权限）

```bash
# 打开管理员命令提示符
sc stop cpolar
sc delete cpolar
```

#### 步骤 2: 重新安装服务

```bash
cd D:\.openclaw\workspace\my-dashboard

# 使用配置文件安装
cpolar service install -config cpolar.yml

# 启动服务
cpolar service start
```

#### 步骤 3: 验证配置

```bash
# 等待 10 秒
timeout /t 10

# 打开 Web UI
start http://localhost:4040
```

在 Web UI 中确认：
- ✅ 隧道名称: `ergo`
- ✅ 本地地址: `http://localhost:8081`
- ✅ 公网地址: `https://terryzin.cpolar.cn`

---

### 方案 3: 临时隧道（不使用配置文件）

如果配置文件有问题，可以手动启动隧道：

#### 方法 A: 命令行启动

```bash
# 停止服务
sc stop cpolar

# 手动启动隧道
cpolar http 8081 -subdomain=terryzin -region=cn
```

**优势**: 立即生效
**劣势**: 关闭窗口隧道会断开

#### 方法 B: 使用启动脚本

```bash
cd D:\.openclaw\workspace\my-dashboard
scripts\start-cpolar.bat
```

---

## 📋 验证步骤

### 1. 检查 cpolar Web UI

访问: http://localhost:4040

**应该看到**:
```
Tunnels
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ergo
  URL: https://terryzin.cpolar.cn
  Forwards: http://localhost:8081
  Protocol: http
```

**如果看不到或配置错误**:
- 运行 `FIX_CPOLAR_TUNNEL.bat`

### 2. 测试本地访问

```bash
# 测试前端服务
curl http://localhost:8081
# 应该返回 HTML

# 测试 API Bridge
curl http://localhost:8082/api/health
# 应该返回 {"status":"ok",...}
```

### 3. 测试公网访问

```bash
# 等待 1-2 分钟让隧道初始化
timeout /t 60

# 访问 Dashboard
start https://terryzin.cpolar.cn
```

---

## 🐛 常见问题

### Q1: 修复脚本运行后仍然 404

**原因**: 隧道初始化需要时间（cpolar 连接服务器）

**解决**:
1. 等待 1-2 分钟
2. 访问 http://localhost:4040 查看隧道状态
3. 如果状态显示 "online"，刷新 https://terryzin.cpolar.cn

### Q2: Web UI 显示 "offline"

**原因**: 子域名 `terryzin` 可能被其他隧道占用或未配置

**解决**:
1. 登录 cpolar 官网: https://dashboard.cpolar.com
2. 查看"隧道列表"，确认 `terryzin` 是否绑定到当前设备
3. 如果未绑定，在 Web UI 中手动配置：
   - Type: http
   - Local Address: 8081
   - Subdomain: terryzin

### Q3: Mixed Content 警告

**问题**: `http://static.cpolar.com/css/fonts/...` 被阻止

**原因**: cpolar 的 404 错误页面引用了 http 资源

**说明**: 这是 cpolar 的问题，不影响我们的应用
**解决**: 修复隧道配置后，此错误会消失

### Q4: cpolar 命令找不到

**原因**: cpolar 未添加到 PATH

**解决**:
1. 查找 cpolar 安装路径:
   ```bash
   where /R C:\ cpolar.exe
   ```

2. 使用完整路径运行:
   ```bash
   "C:\Program Files\cpolar\cpolar.exe" service install -config cpolar.yml
   ```

---

## 📞 诊断脚本

已创建自动诊断脚本: `scripts\check-cpolar-status.bat`

```bash
# 运行诊断
scripts\check-cpolar-status.bat
```

**脚本会检查**:
- cpolar 服务状态
- 本地服务端口（8081, 8082, 18789）
- cpolar Web UI（4040）
- 本地服务响应
- 配置文件正确性

---

## 🎯 推荐操作流程

### 第一步: 运行修复脚本

```bash
# 以管理员身份运行
FIX_CPOLAR_TUNNEL.bat
```

### 第二步: 验证隧道配置

```bash
# 打开 Web UI
start http://localhost:4040

# 确认隧道配置:
# - Name: ergo
# - Local: 8081
# - Public: terryzin.cpolar.cn
```

### 第三步: 等待初始化

```
等待 1-2 分钟让隧道完全建立连接
```

### 第四步: 测试访问

```bash
# 刷新浏览器
start https://terryzin.cpolar.cn
```

### 第五步: 如果仍然失败

```bash
# 运行诊断脚本
scripts\check-cpolar-status.bat

# 查看详细错误
# 根据错误信息采取对应措施
```

---

## 📚 相关文件

| 文件 | 用途 |
|------|------|
| `FIX_CPOLAR_TUNNEL.bat` | 自动修复 cpolar 配置（推荐） |
| `scripts\check-cpolar-status.bat` | 诊断脚本 |
| `scripts\start-cpolar.bat` | 手动启动 cpolar |
| `cpolar.yml` | cpolar 配置文件 |
| `MIGRATION_REPORT.md` | 迁移报告 |

---

## 🔄 最新状态 (2026-02-21 14:05)

| 项目 | 状态 |
|------|------|
| Frontend (8081) | ✅ 运行中 |
| API Bridge (8082) | ✅ 运行中 |
| Gateway (18789) | ✅ 运行中 |
| Cpolar Service | ✅ 运行中 |
| Cpolar 隧道配置 | ⚠️ 需要修复（运行 FIX_CPOLAR_TUNNEL.bat） |

---

**下一步**: 运行 `FIX_CPOLAR_TUNNEL.bat`，等待 1-2 分钟后访问 https://terryzin.cpolar.cn

**预计修复时间**: 5 分钟
