# OpenClaw ↔ Claude Code 协作机制设计

> 设计日期: 2026-02-19
> 架构师: DHH Philosophy
> 状态: Draft

---

## 设计目标

让 OpenClaw 能够**委托** Claude Code 来完成 Ergo 项目的开发迭代，而不是 OpenClaw 自己直接修改代码。

**核心原则（DHH 思维）：**
- 使用文件系统作为消息队列（简单、可靠、可追溯）
- 基于 Git 的结果同步（版本控制天然集成）
- 零额外依赖（不引入消息队列、API 服务器等复杂组件）

---

## 架构概览

```
┌─────────────────┐                    ┌─────────────────┐
│   OpenClaw      │                    │  Claude Code    │
│   Gateway       │                    │      CLI        │
│                 │                    │                 │
│  1. 创建任务    │                    │  3. 读取任务    │
│     ↓           │                    │     ↓           │
│  写入任务文件   │───── 文件系统 ────→│  解析并执行     │
│                 │                    │     ↓           │
│  5. 读取结果    │←──── Git Sync ─────│  4. 提交代码    │
│     ↓           │                    │     ↓           │
│  通知用户完成   │                    │  写入结果文件   │
└─────────────────┘                    └─────────────────┘
```

---

## 协作流程

### Phase 1: 任务提交（OpenClaw 发起）

1. OpenClaw 生成任务描述（JSON 格式）
2. 写入任务文件到约定目录：`.openclaw/tasks/pending/`
3. 任务文件命名：`task-{timestamp}-{uuid}.json`

### Phase 2: 任务执行（Claude Code 处理）

1. Claude Code 监听任务目录（或定时扫描）
2. 读取待处理任务
3. 执行开发任务（代码修改、测试、文档更新）
4. 自动 commit + push 到 Git
5. 生成结果文件并移动任务到 `completed/`

### Phase 3: 结果同步（OpenClaw 获取）

1. OpenClaw 监听 `completed/` 目录
2. 读取结果文件，获取 commit hash
3. 可选：Pull 最新代码查看变更
4. 通知用户任务完成

---

## 文件规范

### 任务文件格式

**路径：** `.openclaw/tasks/pending/task-{timestamp}-{uuid}.json`

```json
{
  "task_id": "task-20260219-abc123",
  "created_at": "2026-02-19T15:30:00Z",
  "priority": "normal",
  "type": "feature|bugfix|refactor|docs",
  "title": "添加用户认证功能",
  "description": "需要在 Ergo Dashboard 中添加用户登录/登出功能...",
  "requirements": [
    "使用 OpenClaw Gateway Token 进行认证",
    "添加登录状态指示器",
    "保持 Apple 风格设计"
  ],
  "context": {
    "files_to_modify": ["index.html"],
    "related_docs": ["docs/product/PRD.md"]
  },
  "metadata": {
    "requester": "openclaw-agent",
    "session_id": "session-xyz"
  }
}
```

### 结果文件格式

**路径：** `.openclaw/tasks/completed/task-{timestamp}-{uuid}.result.json`

```json
{
  "task_id": "task-20260219-abc123",
  "status": "completed|failed|partial",
  "completed_at": "2026-02-19T15:45:00Z",
  "execution_time_seconds": 900,
  "git_commits": [
    {
      "hash": "8a66a35",
      "message": "feat: 添加用户认证功能",
      "files_changed": ["index.html", "CLAUDE.md"]
    }
  ],
  "summary": "已完成用户认证功能开发，包括登录/登出按钮、Token 验证逻辑...",
  "changes": {
    "files_modified": 2,
    "lines_added": 150,
    "lines_removed": 20
  },
  "tests_run": true,
  "tests_passed": true,
  "errors": []
}
```

---

## 目录结构

```
.openclaw/
├── tasks/
│   ├── pending/          # OpenClaw 写入新任务
│   ├── in_progress/      # Claude Code 正在处理
│   ├── completed/        # 已完成任务（带结果文件）
│   └── failed/           # 失败任务（带错误日志）
│
├── config/
│   └── claude-integration.json  # 协作配置
│
└── logs/
    └── task-execution.log       # 任务执行日志
```

---

## 实现方案

### 方案 A: 基于文件监听（推荐）⭐

**OpenClaw 端：**
```javascript
// 在 OpenClaw Gateway 中添加
async function delegateToClaudeCode(taskDescription) {
  const task = {
    task_id: `task-${Date.now()}-${uuid()}`,
    created_at: new Date().toISOString(),
    type: 'feature',
    title: taskDescription.title,
    description: taskDescription.detail,
    // ... 其他字段
  };

  // 写入任务文件
  const taskPath = `.openclaw/tasks/pending/${task.task_id}.json`;
  await fs.writeFile(taskPath, JSON.stringify(task, null, 2));

  console.log(`Task delegated: ${task.task_id}`);
  return task.task_id;
}
```

**Claude Code 端：**
```javascript
// 在 Ergo 项目中添加监听脚本
// scripts/task-watcher.js

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PENDING_DIR = '.openclaw/tasks/pending';

// 定时扫描待处理任务
setInterval(async () => {
  const files = fs.readdirSync(PENDING_DIR);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const taskPath = path.join(PENDING_DIR, file);
    const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));

    // 调用 Claude Code CLI 执行任务
    await executeTask(task);
  }
}, 5000); // 每 5 秒检查一次

async function executeTask(task) {
  // 移动到 in_progress
  const inProgressPath = `.openclaw/tasks/in_progress/${task.task_id}.json`;
  fs.renameSync(taskPath, inProgressPath);

  // 构造 Claude Code 命令
  const prompt = `${task.title}\n\n${task.description}`;

  // 执行（需要 Claude Code 支持非交互模式）
  exec(`claude-code "${prompt}"`, (error, stdout, stderr) => {
    // 生成结果文件
    const result = {
      task_id: task.task_id,
      status: error ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      summary: stdout,
      errors: stderr ? [stderr] : []
    };

    // 写入结果
    const resultPath = `.openclaw/tasks/completed/${task.task_id}.result.json`;
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

    // 移动任务文件
    fs.renameSync(inProgressPath, `.openclaw/tasks/completed/${task.task_id}.json`);
  });
}
```

---

### 方案 B: 基于 Git Issue/PR（简化版）

**更简单的方案：**
1. OpenClaw 创建 GitHub Issue（包含任务描述）
2. Issue 标签：`claude-task`
3. Claude Code 定期扫描带此标签的 Issue
4. 完成后创建 PR 并关联 Issue
5. OpenClaw 监听 PR 合并事件

**优点：**
- 利用现有 GitHub 基础设施
- 自动集成 Code Review 流程
- 任务可见性高

**缺点：**
- 需要网络访问
- 响应速度较慢

---

### 方案 C: 基于 MCP Server（未来扩展）

如果 Claude Code 支持 MCP（Model Context Protocol），可以：
1. OpenClaw 作为 MCP Client
2. Claude Code 作为 MCP Server
3. 通过标准协议通信

---

## 配置文件

**`.openclaw/config/claude-integration.json`**

```json
{
  "enabled": true,
  "mode": "file-based",
  "task_check_interval_seconds": 5,
  "auto_commit": true,
  "auto_push": true,
  "notification": {
    "on_complete": true,
    "webhook_url": "http://localhost:18789/api/webhooks/claude-task-complete"
  },
  "filters": {
    "allowed_task_types": ["feature", "bugfix", "refactor", "docs"],
    "max_concurrent_tasks": 1
  }
}
```

---

## 安全考虑

1. **任务验证**
   - 检查任务文件格式
   - 限制任务类型和权限
   - 防止恶意代码注入

2. **代码审查**
   - 所有变更通过 Git 记录
   - 可回滚到任意历史版本
   - 用户可审查每次 commit

3. **资源限制**
   - 单次任务最大执行时间
   - 并发任务数量限制
   - 防止无限循环

---

## 启动命令

**启动任务监听器：**
```bash
# 在 Ergo 项目目录
node scripts/task-watcher.js

# 或作为后台服务（Windows）
start /B node scripts/task-watcher.js
```

**OpenClaw 测试命令：**
```bash
# 创建测试任务
curl -X POST http://localhost:18789/api/tasks/delegate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试任务",
    "description": "在 index.html 添加一个测试注释",
    "type": "test"
  }'
```

---

## 实施路线图

### Phase 1: 最小可行方案（MVP）
- [ ] 创建 `.openclaw/tasks/` 目录结构
- [ ] 实现任务文件规范
- [ ] 实现基础的任务监听脚本
- [ ] OpenClaw 手动创建任务文件测试

### Phase 2: 自动化集成
- [ ] OpenClaw Gateway 添加任务委托 API
- [ ] 实现任务状态通知（Webhook）
- [ ] 添加任务执行日志

### Phase 3: 高级功能
- [ ] 任务优先级队列
- [ ] 多任务并发控制
- [ ] 任务进度实时反馈

---

## 待解决问题

1. **Claude Code 非交互模式**
   - 当前 Claude Code 是交互式 CLI
   - 需要支持：`claude-code --non-interactive --prompt "..."`
   - 或使用 API 模式

2. **任务粒度控制**
   - 如何定义"一个任务"的范围？
   - 大任务如何拆分？

3. **冲突处理**
   - 多个任务修改同一文件
   - 需要任务依赖声明

---

## 推荐实施顺序

1. **立即实施：目录清理**（本次完成）
2. **短期实施：方案 A 的 MVP 版本**（手动触发）
3. **中期实施：OpenClaw Gateway API 集成**
4. **长期考虑：方案 B（GitHub Issue）或方案 C（MCP）**

---

## DHH 金句

> "The best code is no code."
> 能用文件系统解决的，就不要搞消息队列。

> "Convention over Configuration."
> 约定好目录结构和文件格式，不需要复杂配置。

> "Majestic Monolith."
> 都在一个 Git 仓库里，简单就是力量。
