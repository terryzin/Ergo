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
# 使用 serve 启动本地服务器
npm run start

# 或使用 dev 模式（自动打开浏览器）
npm run dev
```

### 访问页面

打开浏览器访问 http://localhost:3000

## 项目结构

```
Ergo/
├── index.html              # 主页面
├── package.json            # 项目配置
├── README.md               # 本文档
├── CLAUDE.md               # 项目上下文
│
├── src/                    # 源代码
│   ├── api.js              # Gateway API 封装
│   └── app.js              # 主应用逻辑
│
├── tests/                  # 测试文件
│   ├── api.test.js         # API 模块测试
│   └── app.test.js         # 应用逻辑测试
│
├── assets/                 # 静态资源
│   └── logo.png            # Logo
│
└── docs/                   # 文档
    ├── PRD.md              # 产品需求文档
    ├── prototype.html      # 产品原型
    └── project/
        └── kanban.html     # 项目看板
```

## 项目看板

- **[ROADMAP.md](ROADMAP.md)** - Markdown 格式任务路线图
- **[docs/project/kanban.html](docs/project/kanban.html)** - 交互式看板页面

访问看板可实时查看任务进度，支持点击完成任务标记（数据保存在本地存储）。

## 配置说明

### API 配置

在 `src/api.js` 中配置:

```javascript
const MOCK_MODE = true;  // 开发模式使用模拟数据
const API_BASE = 'http://localhost:18789';  // Gateway API 地址
```

### cpolar 域名

| 服务 | 域名 |
|------|------|
| Dashboard | terryzin.cpolar.top |
| Gateway | ergo-gateway.cpolar.top |

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
