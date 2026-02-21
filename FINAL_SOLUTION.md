# 🆘 最终解决方案 - 手把手指导

## 问题现状
- 本地服务 (8081, 8082, 18789): ✅ 全部正常
- cpolar 隧道配置: ❌ 可能指向错误端口或未启动
- 公网访问: ❌ https://terryzin.cpolar.top 返回 404

---

## 🎯 解决方案（5 分钟）

### 方案 A: 命令行手动启动（最快最可靠）⭐

#### 步骤 1: 打开命令提示符

1. 按 `Win + R`
2. 输入 `cmd`
3. 按回车

**或者**: 点击开始菜单，搜索"cmd"或"命令提示符"

#### 步骤 2: 复制粘贴运行

在命令提示符中，**复制粘贴**以下命令：

```cmd
cd D:\.openclaw\workspace\my-dashboard
cpolar http 8081 -subdomain=terryzin -region=cn
```

按回车执行。

#### 步骤 3: 看到成功输出

如果成功，你会看到类似这样的输出：

```
cpolar                                                 (Ctrl+C to quit)

Session Status                online
Account                       terryzin (Plan: Pro)
Region                        China (cn)
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://terryzin.cpolar.top -> http://localhost:8081

Connections                   ttl     opn     rt1
                              0       0       0.00
```

**关键行**: `Forwarding   https://terryzin.cpolar.top -> http://localhost:8081`

如果看到这行，说明**隧道启动成功**！✅

#### 步骤 4: 测试访问

1. **保持命令提示符窗口打开**（关闭会断开隧道）
2. 打开浏览器访问：https://terryzin.cpolar.top
3. 应该能看到 Ergo Dashboard 页面

#### 步骤 5: 长期运行

**重要**:
- ⚠️ 不要关闭命令提示符窗口
- ⚠️ 关闭窗口会断开隧道
- ✅ 最小化窗口没问题

---

### 方案 B: 双击运行启动脚本

找到并双击运行：

```
D:\.openclaw\workspace\my-dashboard\START_TUNNEL_NOW.bat
```

效果同方案 A，但更简单。

**注意**: 保持脚本窗口打开！

---

## 🔧 如果出现错误

### 错误 1: "cpolar 不是内部或外部命令"

**原因**: cpolar 未安装或未添加到 PATH

**解决**:

1. 找到 cpolar 安装路径
   - 通常在: `C:\Program Files\cpolar\cpolar.exe`
   - 或: `C:\Users\你的用户名\AppData\Local\Programs\cpolar\cpolar.exe`

2. 使用完整路径运行：
   ```cmd
   cd D:\.openclaw\workspace\my-dashboard
   "C:\Program Files\cpolar\cpolar.exe" http 8081 -subdomain=terryzin -region=cn
   ```

### 错误 2: "subdomain already in use"

**原因**: terryzin 子域名已被其他隧道占用

**解决**:

1. 打开 http://localhost:4040
2. 找到并停止其他使用 terryzin 的隧道
3. 重新运行启动命令

### 错误 3: "failed to connect to localhost:8081"

**原因**: 本地服务未启动

**解决**:

1. 打开另一个命令提示符窗口
2. 运行：
   ```cmd
   cd D:\.openclaw\workspace\my-dashboard
   npm run start:all
   ```
3. 等待 10 秒
4. 重新启动 cpolar 隧道

---

## 📊 验证清单

运行隧道后，检查以下项目：

### ✅ 命令行输出检查

```
Forwarding    https://terryzin.cpolar.top -> http://localhost:8081
```

- [ ] 域名是 terryzin.cpolar.top
- [ ] 本地端口是 8081（不是 18789）
- [ ] Status 是 online

### ✅ Web UI 检查

打开 http://localhost:4040

- [ ] 看到一个隧道
- [ ] 指向 localhost:8081
- [ ] Status: online

### ✅ 本地服务检查

```cmd
curl http://localhost:8081
```

- [ ] 返回 HTML 内容（不是错误）

### ✅ 公网访问检查

浏览器访问 https://terryzin.cpolar.top

- [ ] 能看到 Ergo Dashboard 页面
- [ ] 无 404 错误
- [ ] 无连接错误

---

## 🎓 为什么会这样？

### 问题根源

迁移前的双域名架构：
- terryzin.cpolar.top → 8081 (Frontend)
- terrysopenclaw.cpolar.top → 18789 (Gateway)

迁移后应该只有一个域名：
- terryzin.cpolar.top → 8081 (Frontend)

**但是**: cpolar 服务可能还在使用旧配置，指向了 18789 或根本没有启动隧道。

### 为什么要手动启动？

自动配置涉及：
- Windows 服务管理（需要管理员权限）
- 配置文件加载（可能路径问题）
- 服务重启延迟（不确定性）

手动启动：
- ✅ 立即生效
- ✅ 无需管理员权限
- ✅ 输出可见，方便调试
- ✅ 100% 可控

---

## 🚀 下一步（可选）

如果手动启动成功，想要开机自动启动：

### Windows 任务计划程序

1. 打开"任务计划程序"
2. 创建基本任务
3. 名称: Ergo Cpolar Tunnel
4. 触发器: 用户登录时
5. 操作: 启动程序
   - 程序: `cpolar.exe`（或完整路径）
   - 参数: `http 8081 -subdomain=terryzin -region=cn`
   - 起始于: `D:\.openclaw\workspace\my-dashboard`
6. 保存

---

## 📞 仍然不行？

### 获取详细信息

请提供以下信息截图：

1. **命令行启动 cpolar 的完整输出**
   - 包括错误信息（如果有）

2. **cpolar Web UI 截图** (http://localhost:4040)
   - 显示隧道列表的页面

3. **本地测试结果**:
   ```cmd
   curl http://localhost:8081
   netstat -ano | findstr "8081"
   ```

4. **浏览器错误详情**:
   - 访问 https://terryzin.cpolar.top 的完整错误页面
   - F12 开发者工具的 Console 和 Network 标签

---

## 💡 小技巧

### 快速测试流程

```cmd
REM 1. 测试本地服务
curl http://localhost:8081

REM 2. 启动隧道
cpolar http 8081 -subdomain=terryzin -region=cn

REM 3. 测试公网（在另一个窗口）
curl https://terryzin.cpolar.top
```

### 查看实时连接

启动隧道后，访问 http://localhost:4040 可以看到：
- 实时请求日志
- 连接统计
- 隧道状态

---

**现在就打开命令提示符，运行那两行命令！** 🚀

```cmd
cd D:\.openclaw\workspace\my-dashboard
cpolar http 8081 -subdomain=terryzin -region=cn
```
