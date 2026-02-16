# Ergo - 项目上下文

## 项目概述

Ergo（二狗）是基于 OpenClaw 平台的个人 AI 管家控制台，作为外部访问 OpenClaw 服务的统一入口。

## 技术栈

- 前端: 纯静态 HTML/CSS/JS，无框架依赖
- 后端: OpenClaw Gateway API (localhost:18789)
- 部署: cpolar 内网穿透

## 关键配置

- OpenClaw Gateway 端口: 18789
- cpolar 域名: terryzin.cpolar.top (Dashboard), ergo-gateway.cpolar.top (Gateway)
- OpenClaw 工作空间: D:\.openclaw\workspace

## 文件结构

```
Ergo/
├── index.html              # 主页面（当前阶段：单文件包含 HTML/CSS/JS）
├── package.json            # 项目元信息
├── CLAUDE.md               # 本文件 - 项目上下文
│
├── docs/                   # 产品与设计文档
│   ├── PRD.md              # 产品需求文档
│   ├── prototype.html      # 产品原型（静态交互演示）
│   ├── design/             # 设计资源
│   │   └── logo-design.png # Logo 原始文件
│   └── product/            # 产品设计 Agent 产出（用研、可用性报告等）
│
├── src/                    # 源代码（v1.1 拆分后启用）
│   ├── styles.css          # 样式
│   ├── app.js              # 主逻辑
│   └── api.js              # Gateway API 封装
│
├── assets/                 # 静态资源
│   └── logo.png            # Logo（供 index.html 引用）
│
└── .claude/
    ├── settings.local.json # Claude Code 本地配置
    └── agents/             # AI Agent 角色定义
        ├── product-norman.md   # 产品设计总监（Don Norman 思维）
        ├── cto-vogels.md       # CTO（Werner Vogels 思维）
        ├── fullstack-dhh.md    # 全栈工程师（DHH 思维）
        └── qa-bach.md          # QA（James Bach 思维）
```

### 结构演进规则

- **当前（v1.0）**: `index.html` 单文件，代码量 < 500 行，保持简洁
- **v1.1 拆分触发**: 当 `index.html` 超过 800 行时，拆分为 `index.html` + `src/styles.css` + `src/app.js`
- **v1.2 按需扩展**: API 调用逻辑增多时，抽取 `src/api.js` 封装 Gateway 接口
- 目录不提前创建，按需在对应迭代中创建

## Agent 角色

项目使用 4 个 AI Agent 角色协作，定义在 `.claude/agents/` 目录：

| 角色 | 文件 | 思维模型 | 职责 |
|------|------|----------|------|
| 产品设计总监 | `product-norman.md` | Don Norman | 产品定义、用户体验策略、可用性评估 |
| CTO | `cto-vogels.md` | Werner Vogels | 技术架构、系统设计、运维策略 |
| 全栈工程师 | `fullstack-dhh.md` | DHH | 代码实现、技术方案、务实工程 |
| QA 工程师 | `qa-bach.md` | James Bach | 探索性测试、质量把控、Bug 发现 |

**协作流程**: 产品设计 → 技术方案 → 代码实现 → 质量验收

## 功能模块

页面包含 6 个卡片入口:
1. **OpenClaw Dashboard** - 跳转 Gateway 管理页
2. **Gateway 状态** - 检测 API 运行状态
3. **Cpolar 穿透** - 公网地址展示
4. **项目文件** - 文件管理（开发中）
5. **定时任务** - Cron 任务管理（开发中）
6. **终端命令** - 远程命令执行（开发中）

## 设计规范

- Apple 风格深色主题
- 主色: #2997ff (蓝), 背景: #000000 / #1d1d1f
- 圆角卡片 (20px), 毛玻璃头部
- 中文界面 (zh-CN)
