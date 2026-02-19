#!/usr/bin/env node
/**
 * OpenClaw ↔ Claude Code 任务监听器
 *
 * 功能：
 * 1. 监听 .openclaw/tasks/pending/ 目录
 * 2. 读取任务文件并生成 Claude Code 提示
 * 3. 记录任务执行结果
 *
 * 使用：node scripts/task-watcher.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const CONFIG_PATH = '.openclaw/config/claude-integration.json';
const PENDING_DIR = '.openclaw/tasks/pending';
const IN_PROGRESS_DIR = '.openclaw/tasks/in_progress';
const COMPLETED_DIR = '.openclaw/tasks/completed';
const FAILED_DIR = '.openclaw/tasks/failed';
const LOG_FILE = '.openclaw/logs/task-execution.log';

// 读取配置
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (error) {
  console.error('❌ 无法读取配置文件:', error.message);
  process.exit(1);
}

if (!config.enabled) {
  console.log('⚠️  任务监听已禁用（config.enabled = false）');
  process.exit(0);
}

// 日志函数
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;

  // 输出到控制台
  console.log(logEntry.trim());

  // 写入日志文件
  fs.appendFileSync(LOG_FILE, logEntry);
}

// 检查待处理任务
async function checkPendingTasks() {
  if (!fs.existsSync(PENDING_DIR)) {
    log('创建任务目录...', 'DEBUG');
    fs.mkdirSync(PENDING_DIR, { recursive: true });
    return;
  }

  const files = fs.readdirSync(PENDING_DIR);
  const taskFiles = files.filter(f => f.endsWith('.json'));

  if (taskFiles.length === 0) {
    return; // 无任务
  }

  log(`发现 ${taskFiles.length} 个待处理任务`, 'INFO');

  for (const file of taskFiles) {
    await processTask(file);
  }
}

// 处理单个任务
async function processTask(filename) {
  const pendingPath = path.join(PENDING_DIR, filename);
  const inProgressPath = path.join(IN_PROGRESS_DIR, filename);

  try {
    // 读取任务
    const task = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    log(`开始处理任务: ${task.task_id}`, 'INFO');

    // 移动到 in_progress
    fs.renameSync(pendingPath, inProgressPath);

    // 执行任务
    const result = await executeTask(task);

    // 生成结果文件
    const resultFilename = filename.replace('.json', '.result.json');
    const resultPath = path.join(COMPLETED_DIR, resultFilename);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

    // 移动任务文件到 completed
    const completedPath = path.join(COMPLETED_DIR, filename);
    fs.renameSync(inProgressPath, completedPath);

    log(`任务完成: ${task.task_id}`, 'INFO');

    // 通知 OpenClaw（如果配置了 webhook）
    if (config.notification.on_complete && config.notification.webhook_url) {
      notifyOpenClaw(result);
    }

  } catch (error) {
    log(`任务失败: ${error.message}`, 'ERROR');

    // 移动到 failed
    const failedPath = path.join(FAILED_DIR, filename);
    if (fs.existsSync(inProgressPath)) {
      fs.renameSync(inProgressPath, failedPath);
    }

    // 写入错误信息
    const errorFile = filename.replace('.json', '.error.txt');
    const errorPath = path.join(FAILED_DIR, errorFile);
    fs.writeFileSync(errorPath, error.stack);
  }
}

// 执行任务（关键函数）
async function executeTask(task) {
  const startTime = Date.now();

  // 构造提示词
  const prompt = buildPrompt(task);

  // 注意：这里需要 Claude Code 支持非交互模式
  // 当前是占位实现，实际需要调用 Claude Code API/CLI

  log(`任务提示: ${prompt.substring(0, 100)}...`, 'DEBUG');

  // TODO: 实际实现
  // 方案 1: 调用 Claude Code CLI（需要非交互模式支持）
  // const output = await execClaudeCode(prompt);

  // 方案 2: 写入临时文件，等待人工处理（MVP 方案）
  const tempPromptFile = `.openclaw/tasks/in_progress/${task.task_id}.prompt.txt`;
  fs.writeFileSync(tempPromptFile, prompt);
  log(`⚠️  当前为 MVP 模式：请手动执行任务并运行 git commit`, 'WARN');
  log(`   提示文件: ${tempPromptFile}`, 'WARN');

  // 等待用户手动完成（MVP）
  // 在生产环境中，这里应该实际调用 Claude Code

  const executionTime = Math.floor((Date.now() - startTime) / 1000);

  return {
    task_id: task.task_id,
    status: 'completed',
    completed_at: new Date().toISOString(),
    execution_time_seconds: executionTime,
    summary: `任务已记录，等待手动处理（MVP 模式）`,
    git_commits: [],
    changes: {
      files_modified: 0,
      lines_added: 0,
      lines_removed: 0
    },
    tests_run: false,
    tests_passed: null,
    errors: []
  };
}

// 构造 Claude Code 提示词
function buildPrompt(task) {
  let prompt = `# OpenClaw 委托任务: ${task.title}\n\n`;
  prompt += `**任务 ID**: ${task.task_id}\n`;
  prompt += `**类型**: ${task.type}\n`;
  prompt += `**优先级**: ${task.priority || 'normal'}\n\n`;
  prompt += `## 任务描述\n\n${task.description}\n\n`;

  if (task.requirements && task.requirements.length > 0) {
    prompt += `## 需求清单\n\n`;
    task.requirements.forEach((req, i) => {
      prompt += `${i + 1}. ${req}\n`;
    });
    prompt += `\n`;
  }

  if (task.context) {
    prompt += `## 上下文信息\n\n`;
    if (task.context.files_to_modify) {
      prompt += `**需要修改的文件**: ${task.context.files_to_modify.join(', ')}\n`;
    }
    if (task.context.related_docs) {
      prompt += `**相关文档**: ${task.context.related_docs.join(', ')}\n`;
    }
    prompt += `\n`;
  }

  prompt += `## 执行要求\n\n`;
  prompt += `- 遵循项目 CLAUDE.md 中的规范\n`;
  prompt += `- 自动 commit 并 push 代码\n`;
  prompt += `- 提交信息格式: \`${config.git.commit_message_prefix} ${task.type}: ${task.title}\`\n`;

  return prompt;
}

// 通知 OpenClaw
async function notifyOpenClaw(result) {
  try {
    const response = await fetch(config.notification.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    });

    if (response.ok) {
      log('✅ 已通知 OpenClaw 任务完成', 'INFO');
    } else {
      log(`⚠️  通知 OpenClaw 失败: ${response.status}`, 'WARN');
    }
  } catch (error) {
    log(`⚠️  无法连接到 OpenClaw: ${error.message}`, 'WARN');
  }
}

// 主循环
console.log('🚀 OpenClaw 任务监听器启动');
console.log(`📁 监听目录: ${PENDING_DIR}`);
console.log(`⏱️  检查间隔: ${config.task_check_interval_seconds} 秒\n`);

log('任务监听器启动', 'INFO');

setInterval(() => {
  checkPendingTasks().catch(err => {
    log(`检查任务时出错: ${err.message}`, 'ERROR');
  });
}, config.task_check_interval_seconds * 1000);

// 立即执行一次
checkPendingTasks();
