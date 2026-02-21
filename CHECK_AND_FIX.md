# 🎯 现在就做这 3 步（2 分钟解决）

## 第 1 步：查看当前隧道配置

打开浏览器访问：**http://localhost:4040**

你应该能看到类似这样的界面（cpolar Web UI）。

---

## 第 2 步：检查配置是否正确

在 Web UI 页面上查找 **"隧道"** 或 **"Tunnels"** 部分，看到类似这样的信息：

```
状态: 在线 / online
公网地址: https://xxx.cpolar.top
本地地址: http://localhost:????
```

### 🔍 关键检查点

**问题 1**: 本地地址是多少？

- ✅ **正确**: `http://localhost:8081`
- ❌ **错误**: `http://localhost:18789` 或其他端口
- ❌ **错误**: 没有隧道显示

**问题 2**: 公网地址是什么？

- ✅ **正确**: `https://terryzin.cpolar.top`
- ⚠️ **可能问题**: 其他随机域名（说明子域名未生效）

---

## 第 3 步：根据检查结果操作

### 情况 A: 本地地址不是 8081 ❌

**这就是 404 的原因！**

#### 解决方法（选一个）

**方法 1: 在 Web UI 中修改**（如果有配置界面）

1. 在 Web UI 中找到隧道配置/编辑功能
2. 修改本地地址为：`8081`
3. 保存并重启隧道

**方法 2: 命令行重新启动**（推荐，最快）

1. 打开**普通命令提示符**（不需要管理员）
2. 复制粘贴运行：

```cmd
cpolar http 8081 -subdomain=terryzin -region=cn
```

3. 看到输出：
```
Forwarding    https://terryzin.cpolar.top -> http://localhost:8081
```

4. **保持窗口打开**，访问：https://terryzin.cpolar.top

**成功！** ✅

---

### 情况 B: 没有看到任何隧道 ❌

说明 cpolar 在运行但没有启动隧道。

#### 解决方法

打开**普通命令提示符**，运行：

```cmd
cpolar http 8081 -subdomain=terryzin -region=cn
```

保持窗口打开，访问：https://terryzin.cpolar.top

---

### 情况 C: 配置已经是 8081 ✅

如果配置正确但仍然 404：

1. **检查本地服务**：

```cmd
curl http://localhost:8081
```

- 如果返回错误，运行：`npm run start:all`
- 等待 10 秒后重试

2. **等待隧道初始化**：

新隧道需要 1-2 分钟初始化，请耐心等待。

3. **刷新浏览器**：

按 `Ctrl+F5` 强制刷新 https://terryzin.cpolar.top

---

## 📸 如果还是不行，截图给我看

请截图并告诉我：

1. **cpolar Web UI 截图**（http://localhost:4040）
   - 显示隧道配置的部分

2. **本地测试结果**：
   ```cmd
   curl http://localhost:8081
   ```

3. **错误信息**：
   - 浏览器访问 https://terryzin.cpolar.top 的完整错误页面

---

## 💡 最可能的原因

根据经验，99% 是因为：

**cpolar 隧道指向了 18789（Gateway）而不是 8081（Frontend）**

这是因为：
1. 之前是双域名架构，有一个隧道指向 18789
2. 迁移后配置文件没有生效
3. cpolar 服务还在使用旧配置

**解决办法**：用命令行手动启动隧道，指向 8081

---

## 🚀 我推荐的最快步骤

**不要纠结配置文件和服务，直接手动启动：**

```cmd
# 1. 启动本地服务（如果还没启动）
cd D:\.openclaw\workspace\my-dashboard
npm run start:all

# 2. 等待 10 秒

# 3. 手动启动隧道（普通命令提示符）
cpolar http 8081 -subdomain=terryzin -region=cn
```

**保持窗口打开，访问：https://terryzin.cpolar.top**

---

**现在就打开 http://localhost:4040 查看配置！** 🔍
