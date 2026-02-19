# Ergo - 项目上下文

## 项目概述

Ergo（二狗）是基于 OpenClaw 平台的个人 AI 管家控制台，作为外部访问 OpenClaw 服务的统一入口。

## 技术栈

- 前端: 纯静态 HTML/CSS/JS，无框架依赖
- 静态服务: Python http.server (端口 8081)
- 后端: OpenClaw Gateway API (localhost:18789)
- 内网穿透: cpolar 双隧道架构（无自定义代理）

## 关键配置

- OpenClaw Gateway 端口: 18789
- OpenClaw Gateway Token: f2009973e92e96b0e31c30b30500e997
- Cpolar 域名（双子域名架构）:
  - Ergo Dashboard: https://terryzin.cpolar.top (端口 8081)
  - OpenClaw Gateway: https://terrysopenclaw.cpolar.top (端口 18789)
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

## 协作与版本管理

### Git 工作流

**⚠️ 重要原则：功能更新后必须立即提交并推送，确保协作顺畅**

1. **开始工作前**
   ```bash
   git pull origin main  # 拉取最新代码，避免冲突
   ```

2. **功能开发完成后**
   ```bash
   git add .
   git commit -m "feat: 简明描述功能变更"
   git push origin main
   ```

3. **提交规范**
   - `feat:` - 新功能
   - `fix:` - Bug 修复
   - `docs:` - 文档更新
   - `style:` - 样式调整
   - `refactor:` - 重构
   - `test:` - 测试相关
   - `chore:` - 构建、配置等

4. **协作要点**
   - ✅ 每次完成独立功能点后立即 push，保持代码同步
   - ✅ 多设备/多会话协作时，每次开始前先 `git pull`
   - ⚠️ 避免长期憋大 commit，容易产生冲突
   - ⚠️ `.claude/settings.local.json` 为本地配置，不应提交（已在 .gitignore）

5. **自动提交规则（AI Agent 执行）**
   - ✅ **代码/配置文件修改后，自动执行 git add + commit + push**
   - ✅ 每个功能点完成即提交，无需等待用户手动执行
   - ✅ 提交信息遵循规范格式，清晰描述变更内容
   - ⚠️ 仅限项目文件修改，系统配置文件（如 cpolar.yml）不自动提交

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

## 部署架构

### 当前架构（v1.2 - 双子域名）

```
外部访问
  │
  ├─ https://terryzin.cpolar.top
  │    └─ cpolar tunnel → localhost:8081 (Python http.server)
  │         └─ Ergo Dashboard (静态 HTML/CSS/JS)
  │
  └─ https://terrysopenclaw.cpolar.top
       └─ cpolar tunnel → localhost:18789
            └─ OpenClaw Gateway WebUI + API
```

**架构特点：**
- ✅ 零自定义代理代码（删除了 proxy-server.js）
- ✅ WebSocket 原生支持（OpenClaw Gateway 实时连接）
- ✅ 两个独立服务互不干扰
- ✅ Cpolar Pro 版多隧道配置

**本地服务启动：**
```bash
# Ergo 静态服务
cd D:\.openclaw\workspace\my-dashboard
python -m http.server 8081

# OpenClaw Gateway（通常已自动运行）
# 端口: 18789
# 无需手动启动
```

**架构设计原则（遵循 DHH 思维）：**
- Convention over Configuration（cpolar 原生配置）
- Choose Boring Technology（Python http.server + cpolar）
- No Over-engineering（拒绝自建反向代理）
