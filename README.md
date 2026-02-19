# Ergo - AI 管家控制台

Ergo（二狗）是基于 OpenClaw 平台的个人 AI 管家控制台，作为外部访问 OpenClaw 服务的统一入口。

## 功能特性

- **Gateway 状态监控** - 实时查看 Gateway 运行状态和性能指标
- **Agent 管理** - 管理多个 AI Agent 的在线状态
- **定时任务** - 监控 Cron 任务的执行情况
- **开发服务** - 快速访问本地开发服务
- **主题切换** - 支持浅色/深色/自动模式

## 技术栈

- 前端: 纯静态 HTML/CSS/JS，无框架依赖
- 后端: OpenClaw Gateway API (localhost:18789)
- 测试: Jest + jsdom
- 部署: cpolar 内网穿透

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch

# 生成覆盖率报告
npm run test:ui
```

### 启动开发服务器

```bash
# 方法 1: Python 静态服务器（推荐）
python -m http.server 8081

# 方法 2: 使用 npm scripts
npm run start        # 使用 serve (端口 3000)
npm run dev          # 自动打开浏览器
```

### 访问页面

- 本地开发：http://localhost:8081
- 公网访问：https://terryzin.cpolar.top

## 项目结构

详细结构请查看 **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)**

```
Ergo/
├── index.html              # 主页面
├── package.json            # 项目配置
├── CLAUDE.md               # 项目上下文 - Claude Code 必读
├── PROJECT_STRUCTURE.md    # 详细目录结构说明
│
├── src/                    # 源代码
├── tests/                  # 测试文件
├── scripts/                # 工具脚本
├── docs/                   # 文档
│   ├── architecture/       # 架构设计
│   ├── product/            # 产品文档
│   └── archive/            # 历史归档
│
├── .openclaw/              # OpenClaw 协作
│   ├── tasks/              # 任务队列
│   ├── config/             # 协作配置
│   └── logs/               # 任务日志
│
└── .claude/                # Claude Code 配置
    └── agents/             # AI Agent 角色
```

## OpenClaw 协作机制 🤖

Ergo 支持 **OpenClaw Gateway 委托任务** 给 Claude Code 执行。

### 快速开始

```bash
# 1. 启动任务监听器
node scripts/task-watcher.js

# 2. OpenClaw 创建任务（写入 pending/）
cp .openclaw/tasks/example-task.json .openclaw/tasks/pending/task-test.json

# 3. 查看结果（completed/）
ls .openclaw/tasks/completed/
```

**详细文档：**
- [OpenClaw 协作说明](.openclaw/README.md)
- [架构设计文档](docs/architecture/openclaw-claude-integration.md)

## 配置说明

### API 配置

在 `src/api.js` 中配置:

```javascript
const MOCK_MODE = true;  // 开发模式使用模拟数据
const API_BASE = 'http://localhost:18789';  // Gateway API 地址
```

### Cpolar 公网访问

| 服务 | 域名 | 本地端口 |
|------|------|---------|
| Ergo Dashboard | https://terryzin.cpolar.top | 8081 |
| OpenClaw Gateway | https://terrysopenclaw.cpolar.top | 18789 |

**架构特点：**
- 双子域名独立隧道（无自定义代理）
- WebSocket 原生支持
- 零维护成本（DHH 原则）

## 测试覆盖

当前测试覆盖以下功能:

- `formatUptime` - 运行时间格式化
- `togglePanel` - 面板展开/折叠
- `showToast` - Toast 通知显示
- API 模块 - Gateway/Agents/Cron/Services 数据获取

## 版本历史

- v1.0.0 - 初始版本，包含基础 UI 和 Mock 数据

## 许可证

ISC
