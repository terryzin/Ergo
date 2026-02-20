# Ergo v1.4 - 项目管理系统

**发布日期**：2026-02-20
**状态**：✅ 已完成

---

## 📋 概述

v1.4 将 Ergo 从静态项目列表展示器升级为**完整的项目管理控制台**，支持项目的增删改查和实时状态监控。

## ✨ 核心功能

### 1. 项目 CRUD 操作

- ✅ 创建项目（表单验证、路径检查）
- ✅ 读取项目列表（含健康状态）
- ✅ 读取项目详情（含状态文件）
- ✅ 更新项目（部分更新）
- ✅ 删除项目（仅删除记录，不删除文件）

### 2. 项目健康度监控

- ✅ 自动解析 `project-status.json`
- ✅ 计算综合健康状态（healthy / degraded / unhealthy）
- ✅ 服务运行状态统计
- ✅ 测试通过率展示
- ✅ 构建成功/失败标记

### 3. 前端界面

- ✅ 项目管理页面（CRUD 操作）
- ✅ 首页项目列表增强（健康图标）
- ✅ 项目详情页增强（健康度卡片）

---

## 🚀 快速开始

### 启动服务

```bash
# 启动 API Bridge Server（必须，新 API 在这里）
cd D:\.openclaw\workspace\my-dashboard
node server/api-bridge.js

# 启动前端服务器（另一个终端）
python -m http.server 8081
```

**重要**：v1.4 的项目管理 API 在 API Bridge (8082) 中实现，必须先启动此服务！

### 访问地址

- **首页**：http://localhost:8081
- **项目管理**：http://localhost:8081/projects-manage.html
- **项目详情**：http://localhost:8081/project.html?id=ergo

### 测试验证

```bash
# 运行完整测试（需要先启动服务）
npm test

# 如果服务未启动，测试会失败（Expected status 200, got 404）
# 请先启动 API Bridge Server，然后重新运行测试
```

---

## 📂 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `projects-manage.html` | 项目管理页面（CRUD 操作） |
| `project-status.json` | Ergo 项目状态文件（示例） |
| `docs/versions/v1.4/feature-plan.md` | 详细功能规划 |
| `docs/versions/v1.4/README.md` | 本文件 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `server/api-bridge.js` | +300 行，新增 6 个项目管理 API 端点 |
| `index.html` | 项目列表增强（健康图标 + 管理按钮） |
| `docs/archive/project.html` | 详情页增强（健康度卡片） |
| `data/projects.json` | 添加 `path` 字段（4 个项目） |
| `tests/smoke-test.js` | +100 行，新增 7 个测试用例 |
| `CHANGELOG.md` | 记录 v1.4 变更 |
| `docs/product/ROADMAP.md` | 更新路线图 |

---

## 🔧 API 端点

### 1. GET /api/projects

获取项目列表（含健康状态）

**请求**：
```bash
curl -H "X-Ergo-Key: ergo-default-secret-key-2026" \
  http://localhost:8082/api/projects
```

**响应**：
```json
{
  "projects": [
    {
      "id": "ergo",
      "name": "Ergo",
      "path": "./my-dashboard",
      "version": "1.3.0",
      "status": "active",
      "health": {
        "overall": "healthy",
        "servicesRunning": 3,
        "servicesTotal": 3
      }
    }
  ],
  "total": 4,
  "updatedAt": "2026-02-20T10:30:00Z"
}
```

### 2. POST /api/projects

创建项目

**请求**：
```bash
curl -X POST \
  -H "X-Ergo-Key: ergo-default-secret-key-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-project",
    "name": "Test Project",
    "description": "测试项目",
    "path": "./test-project",
    "version": "1.0.0",
    "status": "developing",
    "tags": ["test"]
  }' \
  http://localhost:8082/api/projects
```

**验证规则**：
- `id`：3-50 个字符，仅小写字母、数字和连字符
- `version`：语义化版本（例如：1.0.0）
- `path`：必须以 `./` 开头且目录存在

### 3. GET /api/projects/:id

获取项目详情

**请求**：
```bash
curl -H "X-Ergo-Key: ergo-default-secret-key-2026" \
  http://localhost:8082/api/projects/ergo
```

**响应**：
```json
{
  "project": {
    "id": "ergo",
    "name": "Ergo",
    "path": "./my-dashboard",
    "statusFile": {
      "exists": true,
      "data": { /* project-status.json 内容 */ },
      "lastModified": "2026-02-20T10:30:00Z"
    }
  }
}
```

### 4. PUT /api/projects/:id

更新项目

**请求**：
```bash
curl -X PUT \
  -H "X-Ergo-Key: ergo-default-secret-key-2026" \
  -H "Content-Type: application/json" \
  -d '{"version": "1.4.0"}' \
  http://localhost:8082/api/projects/ergo
```

### 5. DELETE /api/projects/:id

删除项目（仅删除记录）

**请求**：
```bash
curl -X DELETE \
  -H "X-Ergo-Key: ergo-default-secret-key-2026" \
  http://localhost:8082/api/projects/test-project
```

**注意**：仅删除 `projects.json` 中的记录，不删除文件系统中的项目文件。

### 6. GET /api/projects/:id/status

读取项目状态文件

**请求**：
```bash
curl -H "X-Ergo-Key: ergo-default-secret-key-2026" \
  http://localhost:8082/api/projects/ergo/status
```

---

## 📊 project-status.json 格式

每个项目根目录下可放置统一的状态文件：

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
        "port": 8082
      }
    ],
    "tests": {
      "total": 34,
      "passed": 34,
      "failed": 0,
      "coverage": 85.6
    },
    "build": {
      "status": "success",
      "lastBuild": "2026-02-20T08:45:00Z"
    }
  }
}
```

**健康度计算规则**：
- `healthy`：所有服务运行中 + 测试全部通过 + 构建成功
- `degraded`：服务正常但测试有失败
- `unhealthy`：服务停止或构建失败

---

## ✅ 验证清单

### 功能验证

- [ ] API Bridge Server 启动成功 (8082)
- [ ] 访问 http://localhost:8081 看到"管理"按钮
- [ ] 访问项目管理页面，看到 4 个项目
- [ ] 创建新项目成功
- [ ] 编辑项目版本号成功
- [ ] 删除项目成功
- [ ] 查看项目详情，显示健康度卡片
- [ ] Ergo 项目显示 ✅ 健康图标

### 测试验证

- [ ] 启动 API Bridge Server
- [ ] 启动前端服务器
- [ ] 运行 `npm test`
- [ ] 所有 48 个测试通过（包括 7 个新增的项目管理测试）

---

## 🚨 常见问题

### 1. 测试失败：Expected status 200, got 404

**原因**：API Bridge Server 未启动。

**解决方案**：
```bash
cd D:\.openclaw\workspace\my-dashboard
node server/api-bridge.js
```

### 2. 项目健康度不显示

**原因**：项目根目录缺少 `project-status.json` 文件。

**解决方案**：
在项目根目录创建 `project-status.json`，参考 Ergo 的示例文件。

### 3. 路径验证失败：Directory not found

**原因**：创建项目时提供的路径不存在。

**解决方案**：
确保路径相对于工作空间（`D:\.openclaw\workspace`）存在。

---

## 📚 参考文档

- [功能规划](./feature-plan.md) - 详细设计文档
- [CHANGELOG](../../CHANGELOG.md) - 完整更新日志
- [ROADMAP](../../product/ROADMAP.md) - 产品路线图

---

**最后更新**：2026-02-20 by Claude Code
