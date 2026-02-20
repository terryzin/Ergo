# Ergo v1.6 - 操作工作台

> **版本主题**: 从"监控中心"到"操作工作台"
> **核心价值**: 从被动查看到主动干预
> **预计发布**: 2026-02-23
> **完成度**: 0%

---

## 版本概述

v1.6 将 Ergo 从"只能看"升级为"能直接干"，让用户在同一个界面完成"发现问题 → 诊断问题 → 解决问题"的完整闭环。

### 为什么需要 v1.6？

**当前痛点**（基于 v1.5）：
1. **操作断层**：看到项目异常 → 切换 SSH → 手动执行命令
2. **缺失诊断工具**：无法查看日志文件、配置文件
3. **工作流割裂**：在 Ergo、VS Code、SSH 之间频繁切换

**v1.6 解决方案**：
```
v1.5: 监控 → 发现问题 ❌ 切换工具
v1.6: 监控 → 发现问题 → 查看日志 → 执行命令 → 问题解决 ✅
```

---

## 目标用户场景

### 场景 1：快速诊断项目异常 ⭐ 最高频

**触发**：收到通知"Ergo 项目服务停止"

**期望流程**（v1.6）：
1. 打开 Ergo（手机）
2. 点击项目卡片 → 查看日志
3. 发现端口冲突错误
4. 点击"终端" → 执行 `npm run restart`
5. ✅ 30 秒内问题解决

**当前流程**（v1.5）：
1. 打开 Ergo（看到异常）
2. 掏出笔记本 → SSH 连接
3. 查看日志 → 执行命令
4. ⏱️ 5 分钟

**时间节省**：5 分钟 → 30 秒（**90% 效率提升**）

---

### 场景 2：快速修改配置文件

**需求**：临时调整环境变量

**期望流程**：
1. 项目列表 → 点击"文件"
2. 找到 `.env` → 编辑
3. 修改 `PORT=8081` → 保存
4. 点击"重启服务"

**收益**：不需要 VS Code Remote 或 SSH

---

### 场景 3：检查磁盘空间

**需求**：确认服务器磁盘使用情况

**期望流程**：
1. 点击"终端"快捷入口
2. 输入 `df -h` → 查看结果
3. 发现 `/tmp` 占用 80%
4. 执行 `rm -rf /tmp/old-logs` 清理

---

## 功能规划

### P0 - 必须有（核心操作闭环）

#### 1. 快速文件查看器 ⭐

**功能**：
- 📂 目录树浏览（工作空间根目录）
- 📄 文本文件查看（前 500 行）
- 🔍 文件搜索（按名称）
- 🚫 敏感文件保护（`.env`, `credentials.json`）

**设计原则**：
- **可供性**：文件图标清晰区分（📁文件夹 / 📄文件 / 🔒不可访问）
- **约束**：敏感文件显示"🔒 受保护"，点击提示权限不足
- **反馈**：文件加载显示骨架屏

**API 设计**：
```javascript
GET /api/files/browse?path=./my-project
Response: {
  "path": "./my-project",
  "files": [
    { "name": "package.json", "type": "file", "size": 1024, "protected": false },
    { "name": ".env", "type": "file", "size": 256, "protected": true },
    { "name": "src", "type": "directory" }
  ]
}
```

---

#### 2. 快速日志查看 ⭐

**功能**：
- 📋 项目详情页新增"日志" tab
- 📜 实时日志流（最新 100 行，自动滚动）
- 🔄 刷新按钮 + 下载日志按钮
- 🎯 日志路径配置（`project-status.json` 中定义）

**设计原则**：
- **映射**：日志实时滚动，符合"终端输出"心智模型
- **反馈**：新日志高亮 0.5 秒

**API 设计**：
```javascript
GET /api/logs/tail?project=ergo&lines=100
Response: {
  "project": "ergo",
  "logPath": "./logs/app.log",
  "lines": [
    "2026-02-21 10:30:15 [INFO] Server started on port 8081",
    "2026-02-21 10:30:20 [ERROR] Port 8081 already in use"
  ]
}
```

---

#### 3. 基础命令执行 ⭐

**功能**：
- ⌨️ 单命令输入框（非完整终端）
- 📋 预设常用命令（下拉选择）
  - `npm run dev`
  - `git status`
  - `df -h`（磁盘空间）
  - `ps aux | grep node`（进程检查）
- 📄 命令输出展示（最多 500 行）
- ⚠️ 危险命令拦截（`rm -rf /`, `sudo`, fork bomb）

**设计原则**：
- **约束**：危险命令直接拦截，显示⚠️警告
- **容错**：执行失败时显示错误原因
- **渐进披露**：默认显示常用命令，点击"自定义"展开

**API 设计**：
```javascript
POST /api/command/exec
Request: {
  "command": "npm run dev",
  "cwd": "./my-project",
  "timeout": 30000
}
Response: {
  "success": true,
  "output": "Server started on port 8081\n",
  "exitCode": 0,
  "duration": 1230
}
```

**安全控制**：
```javascript
// 危险命令黑名单
const DANGEROUS_COMMANDS = [
  /rm\s+-rf\s+\/$/,
  /sudo/,
  /:\(\)\{:\|:&\};:/,  // fork bomb
  /shutdown/,
  /reboot/,
  /mkfs/
];
```

---

#### 4. 文件快速操作

**功能**：
- ✏️ 简单文本编辑（配置文件，< 1000 行）
- ⬆️ 文件上传（拖拽 + 选择，< 10MB）
- ⬇️ 文件下载（单文件下载）
- 🗑️ 文件删除（二次确认）

**设计原则**：
- **可供性**：可编辑文件显示✏️，不可编辑显示🔒
- **反馈**：上传/下载显示进度条
- **容错**：删除前要求输入文件名确认

**API 设计**：
```javascript
PUT /api/files/update
Request: {
  "path": "./my-project/.env",
  "content": "PORT=8081\nDB_HOST=localhost"
}

POST /api/files/upload
FormData: { file: File, path: "./my-project/uploads/" }

DELETE /api/files/delete
Request: { "path": "./my-project/temp.log" }
```

---

### P1 - 应该有（效率提升）

#### 1. 文件编辑增强
- 🎨 语法高亮（JSON/YAML/JS/Python）
- 💾 自动保存（草稿）
- ↩️ 撤销/重做
- 🔍 文件内搜索（Ctrl+F）

#### 2. 命令历史管理
- 📋 本地存储最近 50 条命令
- ⬆️⬇️ 方向键切换历史
- ⭐ 收藏常用命令
- 📌 固定到快捷入口

#### 3. 批量文件操作
- ☑️ 多选文件
- 📦 批量下载（ZIP）
- 🗑️ 批量删除
- 📁  批量移动

#### 4. 智能命令提示
- 💡 根据当前项目推荐命令
  - 识别 `package.json` → 推荐 `npm` 命令
  - 识别 `.git` → 推荐 `git` 命令
  - 识别 `Dockerfile` → 推荐 `docker` 命令

---

### P2 - 可以有（锦上添花）

#### 1. 完整终端模拟器
- 🖥️ xterm.js 集成（完整 TTY）
- 📂 工作目录切换（`cd`）
- 🎨 终端主题

#### 2. 文件编辑器增强
- 🎯 Monaco Editor 集成
- 🔧 代码格式化
- 🐛 Lint 提示

#### 3. Git 可视化操作
- 🌿 分支切换
- 📝 Commit + Push
- 🔄 Pull 最新代码

---

## 成功指标

### 定量指标
- ✅ **问题诊断时间减少 80%**（5 分钟 → 1 分钟）
- ✅ **文件操作完成时间 < 10 秒**
- ✅ **命令执行响应 < 3 秒**
- ✅ **文件浏览加载 < 2 秒**
- ✅ **日志查看延迟 < 1 秒**

### 定性指标
- ✅ 用户："再也不用频繁切换 SSH 了"
- ✅ 用户："在手机上也能快速修复问题"
- ✅ 用户："一周内至少 3 次用 Ergo 直接解决问题"

---

## 潜在风险与降级方案

### 风险 1：安全性问题 ⚠️ 高风险

**问题**：命令执行/文件编辑可能被恶意利用

**降级方案**：
- ✅ 强制启用认证（X-Ergo-Key）
- ✅ 命令白名单模式（默认只允许预设命令）
- ✅ 敏感文件黑名单
- ✅ 操作审计日志
- ✅ 危险操作二次确认

### 风险 2：性能问题

**问题**：大文件查看/编辑可能卡顿

**降级方案**：
- ✅ 文件大小限制（查看 < 5MB, 编辑 < 1MB）
- ✅ 虚拟滚动（只渲染可见行）
- ✅ 大文件提示下载而非在线查看
- ✅ 日志尾部模式（tail -n 100）

### 风险 3：移动端体验

**问题**：终端/编辑器在手机上操作困难

**降级方案**：
- ✅ 移动端只显示查看功能
- ✅ 预设命令按钮化（无需打字）
- ✅ 文件操作简化为"快速动作"
- ✅ 日志只读模式

---

## 交付时间估算

### 工作量分解

**P0 功能**：6-8 小时
- 文件浏览器：2 小时
- 日志查看器：1.5 小时
- 命令执行：2 小时
- 文件操作 API：1.5 小时
- 安全控制：1 小时

**P1 功能**：4-6 小时
- 编辑增强：2 小时
- 命令历史：1 小时
- 批量操作：1.5 小时
- 智能提示：1 小时

**测试 + 文档**：2-3 小时
- Smoke Test：1 小时
- 集成测试：1 小时
- 文档更新：1 小时

**总计**：12-17 小时（**1.5-2 个工作日**）

### 发布计划

- **Day 1**：完成 P0 + 基础测试
- **Day 2**：完成 P1 + 完整测试 + 文档
- **预计发布日期**：**2026-02-23**

---

## 技术方案

### 新增文件结构

```
前端（8081）
├─ file-browser.html（新增）
├─ terminal.html（新增）
└─ src/
    ├─ file-manager.js（新增）
    └─ terminal-client.js（新增）

API Bridge（8082）
└─ 新增端点：
    ├─ GET /api/files/browse?path=xxx
    ├─ GET /api/files/read?path=xxx
    ├─ POST /api/files/upload
    ├─ POST /api/files/delete
    ├─ PUT /api/files/update
    ├─ POST /api/command/exec
    └─ GET /api/logs/tail?project=xxx
```

### 安全控制

**路径验证**：
```javascript
function sanitizePath(userPath) {
  // 禁止路径遍历
  if (userPath.includes('../') || userPath.includes('..\\')) {
    throw new Error('Path traversal detected');
  }

  // 必须在工作空间内
  const resolvedPath = path.resolve(WORKSPACE_ROOT, userPath);
  if (!resolvedPath.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Access denied: outside workspace');
  }

  return resolvedPath;
}
```

**敏感文件保护**：
```javascript
const PROTECTED_FILES = [
  '.env',
  'credentials.json',
  'id_rsa',
  'id_ed25519',
  '.ssh/config',
  'api-keys.txt'
];
```

**命令执行沙箱**：
```javascript
const { spawn } = require('child_process');

function execCommand(cmd, cwd, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', ['-c', cmd], { cwd, timeout });
    let output = '';

    proc.stdout.on('data', (data) => output += data);
    proc.stderr.on('data', (data) => output += data);

    proc.on('close', (code) => {
      resolve({ output, exitCode: code });
    });

    setTimeout(() => {
      proc.kill();
      reject(new Error('Command timeout'));
    }, timeout);
  });
}
```

---

## 相关文档

- [详细功能规划](feature-plan.md)
- [API 设计文档](api-design.md)
- [安全审计指南](security-audit.md)
- [测试计划](test-plan.md)

---

**最后更新**：2026-02-21 by Product Norman Agent
