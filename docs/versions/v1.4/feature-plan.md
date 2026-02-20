# Ergo v1.4 项目管理系统 - 功能规划

**规划日期**：2026-02-20
**预计工期**：7-10 小时（1-2 个工作日）
**状态**：✅ 规划完成，等待实施

---

## 📋 概述

### 核心目标
将 Ergo 从静态项目列表展示器升级为**完整的项目管理控制台**，支持项目的增删改查和实时状态监控。

### 用户需求
1. **项目 CRUD**：在 UI 界面中直接管理项目
2. **关联文件夹**：每个项目指向工作空间中的实际路径
3. **项目状态文件**：定义标准的 `project-status.json`，自动解析并展示项目健康状态

### 需求确认
- ✅ 状态文件格式：JSON
- ✅ 状态文件位置：项目根目录，命名为 `project-status.json`
- ✅ 路径配置：相对工作空间路径（相对于 `D:\.openclaw\workspace`）
- ✅ Git 同步：全部提交到 git

---

## 🎯 功能设计

### 1. project-status.json 标准格式

每个项目根目录下放置统一的状态文件：

```json
{
  "version": "1.0",
  "basic": {
    "name": "Ergo",
    "version": "1.3.0",
    "status": "active",
    "lastUpdate": "2026-02-20T10:30:00Z"
  },
  "health": {
    "overall": "healthy",
    "services": [
      {
        "name": "API Bridge",
        "type": "http",
        "status": "running",
        "port": 8082,
        "uptime": 86400
      },
      {
        "name": "Frontend",
        "type": "http",
        "status": "running",
        "port": 8081
      }
    ],
    "tests": {
      "total": 34,
      "passed": 34,
      "failed": 0,
      "coverage": 85.6,
      "lastRun": "2026-02-20T09:00:00Z"
    },
    "build": {
      "status": "success",
      "lastBuild": "2026-02-20T08:45:00Z",
      "duration": 12.5
    }
  },
  "metrics": {
    "performance": {
      "responseTime": 120,
      "throughput": 250,
      "errorRate": 0.02
    }
  },
  "metadata": {
    "repository": "https://github.com/terryzin/Ergo",
    "language": "JavaScript",
    "framework": "Vanilla JS",
    "tags": ["openclaw", "dashboard"]
  },
  "custom": {}
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `version` | string | ✅ | Schema 版本（当前 1.0）|
| `basic.status` | enum | ✅ | `active`, `developing`, `maintenance`, `archived` |
| `health.overall` | enum | ❌ | `healthy`, `degraded`, `unhealthy`（自动计算）|
| `health.services` | array | ❌ | 服务列表（名称、状态、端口）|
| `health.tests` | object | ❌ | 测试结果统计 |
| `health.build` | object | ❌ | 构建状态 |
| `metrics` | object | ❌ | 性能指标（可选）|
| `custom` | object | ❌ | 自定义扩展字段 |

**健康度计算规则**：
```javascript
function calculateOverallHealth(health) {
  const servicesOk = health.services?.every(s => s.status === 'running') ?? true;
  const testsOk = health.tests ? (health.tests.failed === 0) : true;
  const buildOk = health.build?.status === 'success' ?? true;

  if (servicesOk && testsOk && buildOk) return 'healthy';
  if (!servicesOk || !buildOk) return 'unhealthy';
  return 'degraded';
}
```

---

### 2. data/projects.json 扩展

在现有结构上添加 `path` 字段：

```json
{
  "projects": [
    {
      "id": "ergo",
      "name": "Ergo",
      "description": "基于OpenClaw的个人AI管家控制台",
      "path": "./my-dashboard",
      "status": "active",
      "version": "1.3.0",
      "github": "terryzin/Ergo",
      "lastUpdate": "2026-02-20",
      "tags": ["OpenClaw", "Dashboard", "AI"]
    }
  ]
}
```

**新增字段**：
- `path` (string): 相对工作空间路径，格式 `./目录名`

**路径解析**：
- 基准目录：`D:\.openclaw\workspace`
- 示例：`./my-dashboard` → `D:\.openclaw\workspace\my-dashboard`

---

### 3. 后端 API 设计

#### 新增 6 个 RESTful 端点

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| GET | `/api/projects` | 获取项目列表（含健康状态）| ✅ |
| POST | `/api/projects` | 创建项目 | ✅ |
| GET | `/api/projects/:id` | 获取项目详情 | ✅ |
| PUT | `/api/projects/:id` | 更新项目 | ✅ |
| DELETE | `/api/projects/:id` | 删除项目 | ✅ |
| GET | `/api/projects/:id/status` | 读取 project-status.json | ✅ |

#### API 详细规范

**GET /api/projects**
```javascript
// 响应示例
{
  "projects": [
    {
      "id": "ergo",
      "name": "Ergo",
      "path": "./my-dashboard",
      "status": "active",
      "version": "1.3.0",
      "health": {
        "overall": "healthy",
        "servicesRunning": 2,
        "servicesTotal": 2
      }
    }
  ],
  "total": 4,
  "updatedAt": "2026-02-20T10:30:00Z"
}
```

**POST /api/projects**
```javascript
// 请求体
{
  "id": "new-project",
  "name": "新项目",
  "description": "项目描述",
  "path": "./new-project",
  "status": "developing",
  "version": "0.1.0",
  "tags": ["tag1", "tag2"]
}

// 验证规则
{
  "id": "/^[a-z0-9-]{3,50}$/",  // 小写字母、数字、连字符
  "path": "./目录名",              // 必须以 ./ 开头
  "version": "/^\d+\.\d+\.\d+$/"  // 语义化版本
}

// 响应 (201 Created)
{
  "success": true,
  "project": { /* 创建的项目 */ }
}
```

**PUT /api/projects/:id**
```javascript
// 请求体（部分更新）
{
  "version": "1.4.0",
  "status": "active"
}
```

**DELETE /api/projects/:id**
```javascript
// 响应 (200 OK)
{
  "success": true,
  "message": "Project deleted successfully"
}
```

**注意**：删除操作仅删除 projects.json 中的记录，不删除文件系统中的项目文件。

#### 核心实现（server/api-bridge.js）

```javascript
const fs = require('fs').promises;
const path = require('path');

const WORKSPACE_ROOT = 'D:\\.openclaw\\workspace';
const PROJECTS_FILE = path.join(__dirname, '../data/projects.json');

// 读取项目列表
async function readProjects() {
  const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
  return JSON.parse(data);
}

// 写入项目列表
async function writeProjects(projects) {
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

// 读取项目状态文件
async function readProjectStatus(projectPath) {
  const statusPath = path.join(WORKSPACE_ROOT, projectPath, 'project-status.json');

  try {
    const stat = await fs.stat(statusPath);
    const data = await fs.readFile(statusPath, 'utf-8');

    return {
      exists: true,
      path: statusPath,
      data: JSON.parse(data),
      lastModified: stat.mtime.toISOString()
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { exists: false };
    }
    throw error;
  }
}

// 验证项目路径
async function validateProjectPath(projectPath) {
  const fullPath = path.join(WORKSPACE_ROOT, projectPath);
  try {
    const stat = await fs.stat(fullPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// GET /api/projects
app.get('/api/projects', async (req, res) => {
  try {
    const projectsData = await readProjects();

    // 并行读取所有项目的状态文件
    const projectsWithStatus = await Promise.all(
      projectsData.projects.map(async (project) => {
        const statusFile = await readProjectStatus(project.path);

        const health = statusFile.exists
          ? {
              overall: statusFile.data.health?.overall || 'unknown',
              servicesRunning: statusFile.data.health?.services?.filter(s => s.status === 'running').length || 0,
              servicesTotal: statusFile.data.health?.services?.length || 0
            }
          : null;

        return { ...project, health };
      })
    );

    res.json({
      projects: projectsWithStatus,
      total: projectsWithStatus.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects
app.post('/api/projects', async (req, res) => {
  try {
    const { id, name, path: projectPath, version } = req.body;

    // 验证必填字段
    if (!id || !name || !projectPath || !version) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['id', 'name', 'path', 'version']
      });
    }

    // 验证 ID 格式
    if (!/^[a-z0-9-]{3,50}$/.test(id)) {
      return res.status(400).json({
        error: 'Invalid project ID',
        message: 'ID must be 3-50 characters, lowercase letters, numbers, and hyphens only'
      });
    }

    // 验证版本格式
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      return res.status(400).json({
        error: 'Invalid version',
        message: 'Version must be in semantic versioning format (e.g., 1.0.0)'
      });
    }

    // 验证路径存在性
    const pathExists = await validateProjectPath(projectPath);
    if (!pathExists) {
      return res.status(400).json({
        error: 'Directory not found',
        message: `Path ${projectPath} does not exist in workspace`
      });
    }

    const projectsData = await readProjects();

    // 检查 ID 重复
    if (projectsData.projects.some(p => p.id === id)) {
      return res.status(400).json({
        error: 'Project ID already exists',
        message: `A project with ID "${id}" already exists`
      });
    }

    const newProject = {
      ...req.body,
      lastUpdate: new Date().toISOString().split('T')[0]
    };

    projectsData.projects.push(newProject);
    await writeProjects(projectsData);

    res.status(201).json({ success: true, project: newProject });
  } catch (error) {
    console.error('[API] Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id
app.get('/api/projects/:id', async (req, res) => {
  try {
    const projectsData = await readProjects();
    const project = projectsData.projects.find(p => p.id === req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const statusFile = await readProjectStatus(project.path);

    res.json({
      project: {
        ...project,
        statusFile
      }
    });
  } catch (error) {
    console.error('[API] Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/projects/:id
app.put('/api/projects/:id', async (req, res) => {
  try {
    const projectsData = await readProjects();
    const index = projectsData.projects.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 部分更新
    projectsData.projects[index] = {
      ...projectsData.projects[index],
      ...req.body,
      lastUpdate: new Date().toISOString().split('T')[0]
    };

    await writeProjects(projectsData);

    res.json({
      success: true,
      project: projectsData.projects[index]
    });
  } catch (error) {
    console.error('[API] Error updating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/projects/:id
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const projectsData = await readProjects();
    const index = projectsData.projects.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    projectsData.projects.splice(index, 1);
    await writeProjects(projectsData);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('[API] Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### 4. 前端页面设计

#### 4.1 index.html 增强

在项目列表中显示健康状态图标：

```javascript
function renderDevProjects() {
  fetch('/api/projects', {
    headers: { 'X-Ergo-Key': getApiKey() }
  })
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('devProjectsList');

    container.innerHTML = data.projects.map(project => {
      // 健康状态图标
      const healthIcons = {
        'healthy': '<span style="color:var(--ok)">✅</span>',
        'degraded': '<span style="color:var(--warn)">⚠️</span>',
        'unhealthy': '<span style="color:var(--err)">❌</span>'
      };
      const healthIcon = project.health
        ? healthIcons[project.health.overall] || ''
        : '';

      // 状态颜色
      const statusColor = project.status === 'active' ? 'green' : 'orange';

      return `
        <div class="list-row" onclick="window.location.href='project.html?id=${project.id}'">
          <div class="list-icon ${statusColor}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="list-content">
            <div class="list-title">
              ${project.name}
              <span style="color:var(--text-3);font-size:12px;">v${project.version}</span>
              ${healthIcon}
            </div>
            <div class="list-desc">
              ${project.status === 'active' ? '已上线' : '开发中'} · ${project.lastUpdate}
            </div>
          </div>
          <span class="list-arrow">›</span>
        </div>
      `;
    }).join('');
  })
  .catch(error => {
    console.error('Failed to load projects:', error);
  });
}
```

**右上角添加管理按钮**：
```html
<section class="section">
  <div class="section-header">
    <span class="section-title">开发项目</span>
    <button onclick="window.location.href='projects-manage.html'"
            style="padding:4px 12px;border-radius:6px;background:var(--brand);color:#fff;border:none;cursor:pointer;">
      ⚙️ 管理
    </button>
  </div>
  <div class="card-list" id="devProjectsList">
    <!-- 动态生成 -->
  </div>
</section>
```

#### 4.2 projects-manage.html（新建）

完整的项目 CRUD 管理界面。

**布局结构**：
```
┌──────────────────────────────────────┐
│ ← 返回   项目管理          + 新建项目 │
├──────────────────────────────────────┤
│ ┌────────────────────────────┐       │
│ │ Ergo              v1.3.0  │ ✏️  🗑️  │
│ │ ./my-dashboard             │       │
│ │ ✅ 已上线 · 2026-02-20    │       │
│ └────────────────────────────┘       │
│ ┌────────────────────────────┐       │
│ │ Cargo             v0.2.0  │ ✏️  🗑️  │
│ │ ./cargo                    │       │
│ │ 🔄 开发中 · 2026-02-19    │       │
│ └────────────────────────────┘       │
└──────────────────────────────────────┘

[模态框：新建/编辑项目表单]
```

**完整代码**：（见附录 A）

#### 4.3 project.html 增强

添加健康度卡片，展示项目状态：

```html
<!-- 健康度总览卡片 -->
<div class="health-card" style="background:var(--bg-card);border-radius:16px;padding:24px;margin-bottom:20px;">
  <div class="health-header" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    <span class="health-icon" style="font-size:32px;">
      ${health.overall === 'healthy' ? '✅' : health.overall === 'degraded' ? '⚠️' : '❌'}
    </span>
    <div>
      <div class="health-status" style="font-size:20px;font-weight:600;">
        ${health.overall === 'healthy' ? '健康' : health.overall === 'degraded' ? '降级' : '异常'}
      </div>
      <div style="font-size:14px;color:var(--text-3);">
        最后更新：${formatTime(statusFile.lastModified)}
      </div>
    </div>
  </div>

  <div class="health-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
    <div class="health-item">
      <div class="health-label" style="font-size:12px;color:var(--text-3);margin-bottom:4px;">服务</div>
      <div class="health-value" style="font-size:18px;font-weight:600;">
        ${health.servicesRunning}/${health.servicesTotal} 运行中
      </div>
    </div>

    <div class="health-item">
      <div class="health-label" style="font-size:12px;color:var(--text-3);margin-bottom:4px;">测试</div>
      <div class="health-value" style="font-size:18px;font-weight:600;">
        ${tests.passed}/${tests.total} 通过
      </div>
    </div>

    <div class="health-item">
      <div class="health-label" style="font-size:12px;color:var(--text-3);margin-bottom:4px;">覆盖率</div>
      <div class="health-value" style="font-size:18px;font-weight:600;">
        ${tests.coverage}%
      </div>
    </div>
  </div>
</div>
```

---

## 🔧 实施步骤

### Phase 1: 后端 API（2-3 小时）

**任务清单**：
1. [ ] 扩展 `server/api-bridge.js`
2. [ ] 实现文件操作函数（readProjects, writeProjects, readProjectStatus）
3. [ ] 实现 6 个 API 端点（GET/POST/PUT/DELETE）
4. [ ] 添加数据验证（ID 格式、路径存在性、版本格式）
5. [ ] 添加错误处理
6. [ ] 编写 API 单元测试

**关键文件**：
- `server/api-bridge.js`

### Phase 2: 前端页面（3-4 小时）

**任务清单**：
1. [ ] 增强 `index.html` renderDevProjects() 函数
2. [ ] 添加健康状态图标显示
3. [ ] 添加"管理"按钮
4. [ ] 创建 `projects-manage.html`
5. [ ] 实现 CRUD 表单和逻辑
6. [ ] 增强 `project.html` 详情页
7. [ ] 添加健康度卡片展示

**关键文件**：
- `index.html`
- `projects-manage.html`（新建）
- `docs/archive/project.html`

### Phase 3: 数据迁移（1 小时）

**任务清单**：
1. [ ] 为现有 4 个项目添加 `path` 字段
2. [ ] 创建 Ergo 的 `project-status.json` 示例
3. [ ] 验证数据完整性
4. [ ] 测试文件读取

**关键文件**：
- `data/projects.json`
- `project-status.json`（在 Ergo 根目录）

### Phase 4: 测试与文档（1-2 小时）

**任务清单**：
1. [ ] 扩展 `tests/smoke-test.js`
2. [ ] 新增项目管理测试用例（至少 5 个）
3. [ ] 运行 `npm test` 确保全部通过
4. [ ] 更新 `ROADMAP.md`
5. [ ] 更新 `CHANGELOG.md`
6. [ ] Git 提交（必须先通过 smoke test）

**新增测试用例**：
- 创建项目
- 读取项目列表
- 读取项目详情
- 更新项目
- 删除项目
- 读取项目状态文件

---

## ✅ 验证方案

### 端到端测试流程

1. **创建项目**
   - 访问 `projects-manage.html`
   - 点击"+ 新建项目"
   - 填写表单并提交
   - 验证 `data/projects.json` 已更新

2. **查看项目列表**
   - 返回 `index.html`
   - 验证新项目出现在列表中
   - 验证健康状态图标显示正确

3. **查看项目详情**
   - 点击项目卡片
   - 进入 `project.html?id=xxx`
   - 验证健康度卡片展示正常
   - 验证状态文件数据正确解析

4. **编辑项目**
   - 在管理页面点击编辑按钮
   - 修改版本号或状态
   - 提交并验证更新成功

5. **删除项目**
   - 在管理页面点击删除按钮
   - 确认删除
   - 验证项目从列表中移除

6. **运行 Smoke Test**
   ```bash
   npm test
   # 预期：所有测试通过（包括新增的项目管理测试）
   ```

### Smoke Test 新增用例

```javascript
// tests/smoke-test.js 扩展

async function testProjectManagement(baseUrl) {
  const label = baseUrl.includes('cpolar') ? '公网' : '本地';

  console.log(`\n${colors.blue}▸ ${label}项目管理测试${colors.reset}`);

  const headers = { 'X-Ergo-Key': CONFIG.apiKey, 'Content-Type': 'application/json' };

  // 1. 获取项目列表
  await test(`${label} GET /api/projects`, async () => {
    const res = await fetch(`${baseUrl}/api/projects`, { headers });
    assertStatus(res, 200);
    assertJSON(res.data);
    assert(Array.isArray(res.data.projects), 'projects should be array');
    assert(res.data.total >= 0, 'total should be number');
  });

  // 2. 创建项目
  await test(`${label} POST /api/projects`, async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: 'test-project',
        name: 'Test Project',
        path: './my-dashboard',
        version: '1.0.0',
        status: 'developing'
      })
    });
    // 可能是 201 (创建成功) 或 400 (已存在)
    assert([201, 400].includes(res.status), `Status should be 201 or 400, got ${res.status}`);
  });

  // 3. 读取项目详情
  await test(`${label} GET /api/projects/:id`, async () => {
    const res = await fetch(`${baseUrl}/api/projects/ergo`, { headers });
    assertStatus(res, 200);
    assertJSON(res.data);
    assert(res.data.project, 'Should have project data');
    assert(res.data.project.id === 'ergo', 'Project ID should match');
  });

  // 4. 更新项目
  await test(`${label} PUT /api/projects/:id`, async () => {
    const res = await fetch(`${baseUrl}/api/projects/ergo`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ version: '1.3.0' })
    });
    assertStatus(res, 200);
    assert(res.data.success, 'Update should succeed');
  });

  // 5. 读取项目状态文件
  await test(`${label} GET /api/projects/:id/status`, async () => {
    const res = await fetch(`${baseUrl}/api/projects/ergo/status`, { headers });
    // 如果状态文件存在返回 200，否则 404
    assert([200, 404].includes(res.status), `Status should be 200 or 404, got ${res.status}`);
  });
}
```

---

## 📂 文件清单

### 需要创建的文件
- `projects-manage.html` - 项目管理页面
- `project-status.json` - Ergo 项目状态文件（示例）
- `docs/versions/v1.4/feature-plan.md` - 本规划文档

### 需要修改的文件
- `server/api-bridge.js` - 添加项目管理 API（+200 行）
- `index.html` - 增强项目列表显示（~30 行修改）
- `docs/archive/project.html` - 增强详情页（+50 行）
- `data/projects.json` - 添加 path 字段（4 个项目）
- `tests/smoke-test.js` - 新增项目管理测试（+80 行）
- `docs/product/ROADMAP.md` - 更新路线图
- `CHANGELOG.md` - 记录 v1.4 变更

---

## 🚨 风险与注意事项

### 风险点

1. **路径安全**
   - 用户输入的路径可能包含 `../` 等危险字符
   - 需要严格验证路径在工作空间内

2. **文件系统错误**
   - 项目目录被删除但记录仍存在
   - project-status.json 格式错误

3. **并发写入**
   - 多个用户同时修改 projects.json
   - 需要考虑文件锁或数据库

### 缓解措施

1. **路径验证**
   ```javascript
   function sanitizePath(inputPath) {
     const normalized = path.normalize(inputPath);
     if (normalized.includes('..')) {
       throw new Error('Path traversal detected');
     }
     return normalized;
   }
   ```

2. **优雅降级**
   - 状态文件不存在时返回默认值
   - JSON 解析失败时捕获错误

3. **后续优化**
   - v1.5 考虑迁移到 SQLite

---

## 📅 里程碑

| 阶段 | 预计时间 | 交付物 |
|------|---------|-------|
| Phase 1 | 2-3h | 后端 API + 测试 |
| Phase 2 | 3-4h | 前端页面 + UI |
| Phase 3 | 1h | 数据迁移 |
| Phase 4 | 1-2h | 集成测试 + 文档 |
| **总计** | **7-10h** | **v1.4 完整功能** |

---

## 📚 参考资料

- [Ergo v1.3 功能规划](../v1.3/feature-plan.md)
- [项目架构文档](../../architecture/architecture.md)
- [API 设计规范](../../architecture/api-design.md)
- [Smoke Test 指南](../../testing/smoke-test-guide.md)

---

**规划状态**：✅ 完成
**下一步**：开始实施 Phase 1（后端 API）
