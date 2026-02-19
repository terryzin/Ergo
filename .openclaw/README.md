# OpenClaw ↔ Claude Code 协作机制

本目录用于 OpenClaw Gateway 与 Claude Code 之间的任务协作。

## 目录结构

```
.openclaw/
├── tasks/
│   ├── pending/          # OpenClaw 写入新任务（待处理）
│   ├── in_progress/      # Claude Code 正在处理的任务
│   ├── completed/        # 已完成任务 + 结果文件
│   ├── failed/           # 失败任务 + 错误日志
│   └── example-task.json # 任务文件示例
│
├── config/
│   └── claude-integration.json  # 协作配置
│
├── logs/
│   └── task-execution.log       # 任务执行日志
│
└── README.md             # 本文件
```

## 快速开始

### 1. 启动任务监听器

```bash
# 在项目根目录运行
node scripts/task-watcher.js
```

监听器会每 5 秒检查一次 `pending/` 目录中的新任务。

### 2. 创建任务（OpenClaw 端）

将任务文件写入 `tasks/pending/` 目录：

```bash
# 示例：创建一个测试任务
cp .openclaw/tasks/example-task.json .openclaw/tasks/pending/task-$(date +%s).json
```

### 3. 查看结果

任务完成后，在 `tasks/completed/` 目录查看：
- `task-xxx.result.json` - 执行结果
- `task-xxx.json` - 原始任务文件

## 任务文件格式

参考 `example-task.json`：

```json
{
  "task_id": "task-唯一ID",
  "type": "feature|bugfix|refactor|docs",
  "title": "任务标题",
  "description": "详细描述...",
  "requirements": ["需求1", "需求2"],
  "context": {
    "files_to_modify": ["index.html"],
    "related_docs": ["CLAUDE.md"]
  }
}
```

## 配置说明

编辑 `config/claude-integration.json`：

```json
{
  "enabled": true,                    // 是否启用任务监听
  "task_check_interval_seconds": 5,   // 检查间隔
  "auto_commit": true,                // 自动提交代码
  "auto_push": true,                  // 自动推送到远程
  "max_concurrent_tasks": 1           // 最大并发任务数
}
```

## OpenClaw Gateway 集成示例

在 OpenClaw Gateway 中添加任务委托 API：

```javascript
// 示例：OpenClaw Gateway API
app.post('/api/tasks/delegate', async (req, res) => {
  const { title, description, type, requirements } = req.body;

  const task = {
    task_id: `task-${Date.now()}-${uuid()}`,
    created_at: new Date().toISOString(),
    priority: 'normal',
    type: type || 'feature',
    title,
    description,
    requirements: requirements || [],
    metadata: {
      requester: 'openclaw-gateway',
      user: req.user?.name
    }
  };

  // 写入任务文件
  const taskPath = path.join(
    __dirname,
    '../my-dashboard/.openclaw/tasks/pending',
    `${task.task_id}.json`
  );

  await fs.promises.writeFile(taskPath, JSON.stringify(task, null, 2));

  res.json({ success: true, task_id: task.task_id });
});
```

## 当前限制（MVP 阶段）

⚠️ **当前为手动模式**：
- 任务监听器会生成提示文件（`.prompt.txt`）
- 需要人工复制提示到 Claude Code
- 完成后手动 commit

**未来计划**：
- 支持 Claude Code CLI 非交互模式
- 自动执行任务并提交代码
- 实时进度反馈

## 问题排查

### 任务监听器未启动

检查配置文件是否存在：
```bash
cat .openclaw/config/claude-integration.json
```

### 任务未被处理

1. 确认任务文件在 `pending/` 目录
2. 检查日志：`cat .openclaw/logs/task-execution.log`
3. 验证任务文件 JSON 格式正确

### 通知 OpenClaw 失败

检查 webhook URL 配置：
```json
{
  "notification": {
    "webhook_url": "http://localhost:18789/api/webhooks/claude-task-complete"
  }
}
```

确认 OpenClaw Gateway 在运行并可访问。

## 详细文档

参考：`docs/architecture/openclaw-claude-integration.md`
