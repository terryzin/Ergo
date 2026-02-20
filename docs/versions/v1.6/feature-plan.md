# Ergo v1.6 操作工作台 - 功能规划

**规划日期**：2026-02-21
**预计工期**：12-17 小时（1.5-2 个工作日）
**状态**：📋 规划中

---

## 📋 概述

### 核心目标

将 Ergo 从"监控中心"升级为**操作工作台**，让用户能在同一界面完成"发现问题 → 诊断问题 → 解决问题"的完整闭环。

### 用户需求（基于 Persona）

**陈磊的核心痛点**（基于 v1.5 使用反馈）：
1. **操作断层**：看到项目异常后，需要切换到 SSH 或 VS Code 才能诊断和修复
2. **无法快速诊断**：想查看日志文件、配置文件时必须切换工具
3. **工作流割裂**：在 Ergo、VS Code、SSH 之间频繁切换，效率低
4. **移动端受限**：在外面用手机看到异常，但无法快速处理（需要电脑）

**v1.6 解决方案**：
1. ✅ 文件浏览和查看（查看日志、配置文件）
2. ✅ 命令快速执行（重启服务、查看进程）
3. ✅ 文件编辑和上传（修改配置、更新文件）
4. ✅ 操作闭环（发现 → 诊断 → 修复，全在 Ergo 完成）

### 设计洞察（Don Norman 原则）

**问题 1：操作不连续（Operational Gap）**
- **现状**：监控 → 切换工具 → 操作
- **心智模型**：用户期望在同一界面完成所有操作
- **解决**：集成文件管理和命令执行

**问题 2：缺失的反馈通道（Missing Feedback Loop）**
- **现状**：只能看到"服务停止"状态
- **心智模型**：用户想知道"为什么停止"
- **解决**：提供日志查看、错误诊断工具

**问题 3：工作流割裂（Fragmented Workflow）**
- **现状**：Ergo → VS Code → SSH → Ergo
- **心智模型**：一站式完成所有任务
- **解决**：文件编辑 + 命令执行 + 服务重启全集成

---

## 🎯 功能设计

### 优先级划分

**P0（必须有）- 核心操作闭环**
- 快速文件查看器（浏览文件树、查看内容）
- 快速日志查看（实时日志流、自动滚动）
- 基础命令执行（预设命令、危险拦截）
- 文件快速操作（编辑、上传、下载、删除）

**P1（应该有）- 效率提升**
- 文件编辑增强（语法高亮、自动保存）
- 命令历史管理（历史记录、收藏）
- 批量文件操作（多选、ZIP 下载）
- 智能命令提示（项目类型识别）

**P2（可以有）- 锦上添花**
- 完整终端模拟器（xterm.js）
- Monaco Editor 集成（VS Code 同款）
- Git 可视化操作（分支切换、Commit）

---

## 🔧 详细功能设计

### 1. 快速文件查看器（P0）⭐

#### 用户场景
```
陈磊收到通知："Ergo 项目服务停止"
他想要：
1. 查看项目日志（./logs/app.log）
2. 查看配置文件（./package.json, .env）
3. 查看错误日志找到原因
```

#### 功能设计

**文件树浏览**：
- 显示工作空间根目录下的所有项目
- 支持展开/折叠目录
- 文件图标区分（📁 文件夹 / 📄 文件 / 🔒 受保护）
- 文件大小、修改时间显示

**文件内容查看**：
- 点击文件打开查看器（右侧面板）
- 显示前 500 行（大文件分页加载）
- 代码行号显示
- 搜索功能（Ctrl+F）

**敏感文件保护**：
```javascript
const PROTECTED_FILES = [
  '.env',
  'credentials.json',
  'api-keys.txt',
  'id_rsa',
  'id_ed25519',
  '.ssh/config',
  'token.txt'
];
```
- 敏感文件显示 🔒 图标
- 点击提示："此文件受保护，无法查看"
- 保护级别可配置（白名单模式）

**API 设计**：
```javascript
// 获取文件树
GET /api/files/browse?path=./my-project
Response: {
  "path": "./my-project",
  "files": [
    {
      "name": "package.json",
      "type": "file",
      "size": 1024,
      "modifiedAt": "2026-02-21T10:30:00Z",
      "protected": false
    },
    {
      "name": ".env",
      "type": "file",
      "size": 256,
      "modifiedAt": "2026-02-21T09:15:00Z",
      "protected": true
    },
    {
      "name": "src",
      "type": "directory",
      "children": 15
    }
  ]
}

// 读取文件内容
GET /api/files/read?path=./my-project/package.json
Response: {
  "path": "./my-project/package.json",
  "content": "{\n  \"name\": \"ergo\",\n  \"version\": \"1.5.0\"\n}",
  "size": 1024,
  "lines": 25,
  "encoding": "utf-8"
}
```

**后端实现**：
```javascript
// server/api-bridge.js

const fs = require('fs').promises;
const path = require('path');

// 路径安全检查
function sanitizePath(userPath) {
  // 禁止路径遍历
  if (userPath.includes('../') || userPath.includes('..\\')) {
    throw new Error('Path traversal detected');
  }

  // 解析为绝对路径
  const resolvedPath = path.resolve(WORKSPACE_ROOT, userPath);

  // 必须在工作空间内
  if (!resolvedPath.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Access denied: outside workspace');
  }

  return resolvedPath;
}

// 检查是否为受保护文件
function isProtectedFile(filename) {
  const basename = path.basename(filename);
  return PROTECTED_FILES.some(pattern => {
    if (pattern.includes('*')) {
      return new RegExp(pattern.replace('*', '.*')).test(basename);
    }
    return basename === pattern;
  });
}

// 浏览文件树
app.get('/api/files/browse', async (req, res) => {
  try {
    const userPath = req.query.path || './';
    const resolvedPath = sanitizePath(userPath);

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

    const files = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(resolvedPath, entry.name);
      const stats = await fs.stat(fullPath);

      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        protected: isProtectedFile(entry.name)
      };
    }));

    res.json({ path: userPath, files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 读取文件内容
app.get('/api/files/read', async (req, res) => {
  try {
    const userPath = req.query.path;
    const resolvedPath = sanitizePath(userPath);

    // 检查是否受保护
    if (isProtectedFile(resolvedPath)) {
      return res.status(403).json({ error: 'File is protected' });
    }

    // 检查文件大小（限制 5MB）
    const stats = await fs.stat(resolvedPath);
    if (stats.size > 5 * 1024 * 1024) {
      return res.status(413).json({
        error: 'File too large',
        message: 'Please download the file instead',
        size: stats.size
      });
    }

    const content = await fs.readFile(resolvedPath, 'utf-8');
    const lines = content.split('\n').length;

    res.json({
      path: userPath,
      content,
      size: stats.size,
      lines,
      encoding: 'utf-8'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**前端实现**：
```javascript
// file-browser.html

class FileBrowser {
  constructor() {
    this.currentPath = './';
    this.selectedFile = null;
  }

  async loadDirectory(path) {
    const res = await fetch(`/api/files/browse?path=${path}`, {
      headers: { 'X-Ergo-Key': getApiKey() }
    });
    const data = await res.json();

    this.renderFileTree(data.files);
  }

  renderFileTree(files) {
    const html = files.map(file => {
      const icon = file.type === 'directory' ? '📁' :
                   file.protected ? '🔒' : '📄';

      return `
        <div class="file-item" onclick="fileBrowser.selectFile('${file.name}')">
          <span class="file-icon">${icon}</span>
          <span class="file-name">${file.name}</span>
          <span class="file-size">${formatBytes(file.size)}</span>
        </div>
      `;
    }).join('');

    document.getElementById('fileTree').innerHTML = html;
  }

  async selectFile(filename) {
    if (filename.endsWith('/')) {
      // 是目录，展开
      this.loadDirectory(this.currentPath + filename);
    } else {
      // 是文件，读取内容
      const res = await fetch(`/api/files/read?path=${this.currentPath}${filename}`, {
        headers: { 'X-Ergo-Key': getApiKey() }
      });

      if (res.status === 403) {
        showToast('⚠️ 此文件受保护，无法查看');
        return;
      }

      const data = await res.json();
      this.showFileContent(data);
    }
  }

  showFileContent(data) {
    const viewer = document.getElementById('fileViewer');
    viewer.innerHTML = `
      <div class="file-header">
        <span class="file-path">${data.path}</span>
        <span class="file-info">${data.lines} 行 · ${formatBytes(data.size)}</span>
      </div>
      <pre class="file-content"><code>${escapeHtml(data.content)}</code></pre>
    `;
  }
}

const fileBrowser = new FileBrowser();
```

---

### 2. 快速日志查看（P0）⭐

#### 用户场景
```
陈磊看到 Ergo 项目健康度下降⚠️
他想要：
1. 立即查看最新日志
2. 看到错误堆栈
3. 下载完整日志供后续分析
```

#### 功能设计

**日志路径配置**：
```json
// project-status.json
{
  "version": "1.0",
  "basic": { ... },
  "health": { ... },
  "logs": {
    "app": "./logs/app.log",
    "error": "./logs/error.log",
    "access": "./logs/access.log"
  }
}
```

**实时日志流**：
- 显示最新 100 行（tail -n 100）
- 自动滚动到底部
- 新日志高亮 0.5 秒（黄色背景渐隐）
- 错误行高亮（红色背景）

**日志级别着色**：
```javascript
const LOG_LEVEL_COLORS = {
  'ERROR': 'var(--err)',
  'WARN': 'var(--warn)',
  'INFO': 'var(--brand)',
  'DEBUG': 'var(--text-3)'
};
```

**API 设计**：
```javascript
// 获取日志尾部
GET /api/logs/tail?project=ergo&logType=app&lines=100
Response: {
  "project": "ergo",
  "logType": "app",
  "logPath": "./my-dashboard/logs/app.log",
  "lines": [
    "2026-02-21 10:30:15 [INFO] Server started on port 8081",
    "2026-02-21 10:30:20 [ERROR] Port 8081 already in use",
    "2026-02-21 10:30:25 [INFO] Retrying on port 8082"
  ],
  "totalLines": 1250,
  "fileSize": 256000,
  "lastModified": "2026-02-21T10:30:25Z"
}

// 下载完整日志
GET /api/logs/download?project=ergo&logType=app
Response: [File Download]
```

**后端实现**：
```javascript
// server/api-bridge.js

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 读取日志尾部
app.get('/api/logs/tail', async (req, res) => {
  try {
    const { project, logType = 'app', lines = 100 } = req.query;

    // 读取项目配置
    const projectData = await getProjectData(project);
    const logPath = projectData.logs?.[logType];

    if (!logPath) {
      return res.status(404).json({ error: 'Log file not configured' });
    }

    const resolvedPath = sanitizePath(logPath);

    // 使用 tail 命令读取最后 N 行
    const { stdout } = await execAsync(`tail -n ${lines} "${resolvedPath}"`);

    // 获取文件统计
    const stats = await fs.stat(resolvedPath);

    res.json({
      project,
      logType,
      logPath,
      lines: stdout.split('\n').filter(line => line.trim()),
      totalLines: parseInt((await execAsync(`wc -l < "${resolvedPath}"`)).stdout.trim()),
      fileSize: stats.size,
      lastModified: stats.mtime.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 下载日志文件
app.get('/api/logs/download', async (req, res) => {
  try {
    const { project, logType = 'app' } = req.query;

    const projectData = await getProjectData(project);
    const logPath = projectData.logs?.[logType];

    if (!logPath) {
      return res.status(404).json({ error: 'Log file not configured' });
    }

    const resolvedPath = sanitizePath(logPath);
    const filename = path.basename(resolvedPath);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/plain');

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**前端实现**：
```javascript
// 项目详情页新增 "日志" tab

class LogViewer {
  constructor(project, logType = 'app') {
    this.project = project;
    this.logType = logType;
    this.autoScroll = true;
  }

  async loadLogs() {
    const res = await fetch(
      `/api/logs/tail?project=${this.project}&logType=${this.logType}&lines=100`,
      { headers: { 'X-Ergo-Key': getApiKey() } }
    );

    const data = await res.json();
    this.renderLogs(data.lines);
  }

  renderLogs(lines) {
    const html = lines.map((line, index) => {
      const level = this.detectLogLevel(line);
      const color = LOG_LEVEL_COLORS[level] || 'inherit';

      return `
        <div class="log-line" style="color: ${color}">
          <span class="log-number">${index + 1}</span>
          <span class="log-content">${escapeHtml(line)}</span>
        </div>
      `;
    }).join('');

    const viewer = document.getElementById('logViewer');
    viewer.innerHTML = html;

    // 自动滚动到底部
    if (this.autoScroll) {
      viewer.scrollTop = viewer.scrollHeight;
    }
  }

  detectLogLevel(line) {
    if (line.includes('[ERROR]') || line.includes('Error:')) return 'ERROR';
    if (line.includes('[WARN]') || line.includes('Warning:')) return 'WARN';
    if (line.includes('[INFO]')) return 'INFO';
    if (line.includes('[DEBUG]')) return 'DEBUG';
    return null;
  }

  downloadLogs() {
    const url = `/api/logs/download?project=${this.project}&logType=${this.logType}`;
    window.open(url, '_blank');
  }
}
```

---

### 3. 基础命令执行（P0）⭐

#### 用户场景
```
陈磊查看日志后发现是端口冲突
他想要：
1. 执行 `ps aux | grep node` 查看进程
2. 杀死占用端口的进程
3. 执行 `npm run dev` 重启服务
```

#### 功能设计

**预设常用命令**（下拉选择）：
```javascript
const PRESET_COMMANDS = {
  'Node.js 项目': [
    { label: '启动开发服务', cmd: 'npm run dev' },
    { label: '安装依赖', cmd: 'npm install' },
    { label: '运行测试', cmd: 'npm test' },
    { label: '查看 Node 进程', cmd: 'ps aux | grep node' }
  ],
  'Git 操作': [
    { label: 'Git 状态', cmd: 'git status' },
    { label: 'Git 日志', cmd: 'git log --oneline -10' },
    { label: '拉取最新代码', cmd: 'git pull' }
  ],
  '系统监控': [
    { label: '磁盘空间', cmd: 'df -h' },
    { label: '内存使用', cmd: 'free -h' },
    { label: '进程列表', cmd: 'ps aux --sort=-%mem | head -20' }
  ]
};
```

**危险命令拦截**：
```javascript
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/$/,           // rm -rf /
  /sudo/,                      // sudo 命令
  /:\(\)\{:\|:&\};:/,         // fork bomb
  /shutdown/,                  // 关机
  /reboot/,                    // 重启
  /mkfs/,                      // 格式化磁盘
  /dd\s+.*of=\/dev\//,        // dd 写入设备
  /chmod\s+777\s+\//          // 递归修改根目录权限
];

function isDangerousCommand(cmd) {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(cmd));
}
```

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
  "stderr": "",
  "exitCode": 0,
  "duration": 1230,
  "command": "npm run dev"
}
```

**后端实现**：
```javascript
// server/api-bridge.js

const { spawn } = require('child_process');

// 执行命令
app.post('/api/command/exec', async (req, res) => {
  try {
    const { command, cwd = './', timeout = 30000 } = req.body;

    // 危险命令检查
    if (isDangerousCommand(command)) {
      return res.status(403).json({
        error: 'Dangerous command blocked',
        message: '此命令可能造成系统损坏，已被拦截',
        command
      });
    }

    const resolvedCwd = sanitizePath(cwd);
    const startTime = Date.now();

    const result = await execCommand(command, resolvedCwd, timeout);

    res.json({
      success: result.exitCode === 0,
      output: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration: Date.now() - startTime,
      command
    });

    // 记录审计日志
    await logAudit('command_exec', {
      command,
      cwd: resolvedCwd,
      exitCode: result.exitCode,
      user: req.headers['x-ergo-key']
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 命令执行辅助函数
function execCommand(cmd, cwd, timeout) {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', ['-c', cmd], {
      cwd,
      timeout,
      env: { ...process.env, PATH: process.env.PATH }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      // 限制输出大小（最多 500KB）
      if (stdout.length > 500 * 1024) {
        proc.kill();
        reject(new Error('Output too large'));
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on('error', (err) => {
      reject(err);
    });

    // 超时处理
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
        reject(new Error('Command timeout'));
      }
    }, timeout);
  });
}
```

**前端实现**：
```javascript
// terminal.html

class Terminal {
  constructor() {
    this.history = JSON.parse(localStorage.getItem('cmdHistory') || '[]');
    this.historyIndex = -1;
  }

  async executeCommand(cmd) {
    if (!cmd.trim()) return;

    // 显示执行中状态
    this.showLoading();

    try {
      const res = await fetch('/api/command/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ergo-Key': getApiKey()
        },
        body: JSON.stringify({
          command: cmd,
          cwd: this.currentProject,
          timeout: 30000
        })
      });

      const result = await res.json();

      if (res.status === 403) {
        this.showOutput(`⚠️ 危险命令已拦截\n${result.message}`, 'error');
        return;
      }

      this.showOutput(result.output, result.success ? 'success' : 'error');

      // 保存到历史
      this.addToHistory(cmd);

    } catch (error) {
      this.showOutput(`❌ 执行失败：${error.message}`, 'error');
    }
  }

  showOutput(text, type = 'normal') {
    const output = document.getElementById('terminalOutput');
    const color = type === 'error' ? 'var(--err)' :
                  type === 'success' ? 'var(--ok)' :
                  'var(--text-1)';

    output.innerHTML += `
      <div class="output-line" style="color: ${color}">
        ${escapeHtml(text)}
      </div>
    `;

    output.scrollTop = output.scrollHeight;
  }

  addToHistory(cmd) {
    this.history.unshift(cmd);
    if (this.history.length > 50) this.history.pop();
    localStorage.setItem('cmdHistory', JSON.stringify(this.history));
  }

  // 方向键切换历史
  navigateHistory(direction) {
    if (direction === 'up') {
      this.historyIndex = Math.min(this.historyIndex + 1, this.history.length - 1);
    } else {
      this.historyIndex = Math.max(this.historyIndex - 1, -1);
    }

    const input = document.getElementById('commandInput');
    input.value = this.historyIndex >= 0 ? this.history[this.historyIndex] : '';
  }
}

// 键盘事件监听
document.getElementById('commandInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    terminal.executeCommand(e.target.value);
    e.target.value = '';
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    terminal.navigateHistory('up');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    terminal.navigateHistory('down');
  }
});
```

---

### 4. 文件快速操作（P0）

#### 功能列表

**文本编辑**：
- 简单文本编辑器（< 1000 行）
- 保存前确认（防止误操作）
- 自动备份（保存前备份到 `.bak`）

**文件上传**：
- 拖拽上传
- 文件选择器
- 大小限制（< 10MB）
- 进度条显示

**文件下载**：
- 单文件下载
- 右键菜单集成

**文件删除**：
- 二次确认（输入文件名）
- 回收站模式（移动到 `.trash/`）

**API 设计**：
```javascript
// 更新文件
PUT /api/files/update
Request: {
  "path": "./my-project/.env",
  "content": "PORT=8081\nDB_HOST=localhost",
  "createBackup": true
}
Response: {
  "success": true,
  "path": "./my-project/.env",
  "backupPath": "./my-project/.env.bak",
  "size": 256
}

// 上传文件
POST /api/files/upload
FormData: {
  file: File,
  path: "./my-project/uploads/"
}
Response: {
  "success": true,
  "path": "./my-project/uploads/image.png",
  "size": 102400
}

// 删除文件
DELETE /api/files/delete
Request: {
  "path": "./my-project/temp.log",
  "moveToTrash": true
}
Response: {
  "success": true,
  "trashPath": "./.trash/temp.log.20260221103015"
}
```

---

## 📊 测试计划

### 单元测试（Jest）

**文件操作测试**：
```javascript
describe('File Operations API', () => {
  test('Should list files in directory', async () => {
    const res = await fetch('/api/files/browse?path=./test-project');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.files)).toBe(true);
  });

  test('Should block path traversal', async () => {
    const res = await fetch('/api/files/read?path=../../etc/passwd');
    expect(res.status).toBe(500);
  });

  test('Should protect sensitive files', async () => {
    const res = await fetch('/api/files/read?path=./.env');
    expect(res.status).toBe(403);
  });
});
```

**命令执行测试**：
```javascript
describe('Command Execution API', () => {
  test('Should execute safe command', async () => {
    const res = await fetch('/api/command/exec', {
      method: 'POST',
      body: JSON.stringify({ command: 'echo "test"' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.output).toContain('test');
  });

  test('Should block dangerous command', async () => {
    const res = await fetch('/api/command/exec', {
      method: 'POST',
      body: JSON.stringify({ command: 'rm -rf /' })
    });
    expect(res.status).toBe(403);
  });
});
```

### 集成测试（Smoke Test）

新增 10 个测试用例：
1. 文件浏览 API 可访问
2. 文件读取 API 正常工作
3. 敏感文件保护生效
4. 路径遍历攻击被拦截
5. 命令执行 API 可访问
6. 危险命令被拦截
7. 日志查看 API 正常工作
8. 文件上传功能正常
9. 文件下载功能正常
10. 文件删除需要确认

---

## 🔒 安全审计

### 安全威胁评估

**威胁 1：任意文件读取**
- **风险等级**：高
- **缓解措施**：
  - 路径验证（禁止 `../`）
  - 限制访问范围（仅工作空间内）
  - 敏感文件黑名单

**威胁 2：命令注入**
- **风险等级**：高
- **缓解措施**：
  - 危险命令黑名单
  - 命令白名单模式（可选）
  - 操作审计日志

**威胁 3：任意文件写入**
- **风险等级**：中
- **缓解措施**：
  - 路径验证
  - 文件大小限制
  - 自动备份机制

**威胁 4：拒绝服务（DoS）**
- **风险等级**：中
- **缓解措施**：
  - 命令执行超时（30 秒）
  - 输出大小限制（500KB）
  - 并发请求限制

### 操作审计日志

```javascript
// logs/audit.log
{
  "timestamp": "2026-02-21T10:30:15Z",
  "action": "file_read",
  "user": "ergo-default-secret-key-2026",
  "path": "./my-project/package.json",
  "success": true
}

{
  "timestamp": "2026-02-21T10:31:20Z",
  "action": "command_exec",
  "user": "ergo-default-secret-key-2026",
  "command": "npm run dev",
  "cwd": "./my-project",
  "exitCode": 0,
  "duration": 1230
}

{
  "timestamp": "2026-02-21T10:32:05Z",
  "action": "file_update",
  "user": "ergo-default-secret-key-2026",
  "path": "./my-project/.env",
  "size": 256,
  "backupCreated": true
}
```

---

## 📅 里程碑时间线

### Day 1（6-8 小时）

**上午**：
- [ ] API 设计文档评审
- [ ] 文件浏览 API 实现（2 小时）
- [ ] 文件读取 API + 安全控制（1.5 小时）

**下午**：
- [ ] 日志查看 API 实现（1.5 小时）
- [ ] 命令执行 API + 危险拦截（2 小时）
- [ ] 基础测试（1 小时）

### Day 2（6-9 小时）

**上午**：
- [ ] 前端文件浏览器 UI（2 小时）
- [ ] 前端日志查看器（1.5 小时）
- [ ] 前端命令执行界面（1.5 小时）

**下午**：
- [ ] 文件编辑/上传/删除功能（2 小时）
- [ ] P1 功能（语法高亮、命令历史）（2 小时）
- [ ] 完整测试 + Smoke Test（2 小时）
- [ ] 文档更新（1 小时）

---

## 📝 后续优化方向（v1.7）

基于 v1.6 的使用反馈，v1.7 可以考虑：

1. **AI 辅助诊断**：
   - 自动分析日志错误
   - 推荐修复命令
   - 智能问答（"为什么服务停止？"）

2. **批量操作**：
   - 多项目同时重启
   - 批量日志下载
   - 批量配置更新

3. **可视化编辑器**：
   - Monaco Editor 集成
   - 代码补全
   - Lint 提示

---

**最后更新**：2026-02-21
**负责人**：Product Norman Agent + Claude Code
