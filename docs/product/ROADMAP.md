# Ergo 项目路线图

> **最后更新**: 2026-02-20
> **当前版本**: v1.2 (部分完成 - 架构调整完毕，API 集成待完善)
> **下一版本**: v1.3 - 移动端体验优化

---

## 📋 任务状态说明

- ✅ 已完成
- 🔄 进行中
- 📋 待开始
- ⏸️  已搁置

---

## 版本历史

### v1.0 - 基础功能 ✅

> 发布日期: 2026-02-15
> 完成度: 100%

**已完成：**
- ✅ 项目初始化 (index.html 单文件架构)
- ✅ Apple 风格深色主题 UI
- ✅ 顶部导航栏 + 毛玻璃效果
- ✅ 卡片列表布局
- ✅ 响应式设计
- ✅ Gateway 状态监控卡片
- ✅ Agents 在线状态显示
- ✅ Cron 任务列表
- ✅ 开发服务入口
- ✅ 主题切换 (浅色/深色/自动)
- ✅ Toast 通知系统
- ✅ Action Sheet 操作确认
- ✅ Mock 数据层

---

### v1.1 - 测试与文档 ✅

> 发布日期: 2026-02-15
> 完成度: 100%

**已完成：**
- ✅ Jest 集成
- ✅ jsdom 测试环境
- ✅ API 模块测试 (10 tests)
- ✅ 纯函数测试 (6 tests)
- ✅ 测试覆盖率配置
- ✅ README.md 完善
- ✅ package.json 脚本配置
- ✅ src/api.js 模块化
- ✅ src/app.js 模块化

---

### v1.2 - Gateway API 集成 ✅

> 发布日期: 2026-02-20
> 完成度: 85% (架构调整 + HTTP API 集成完成)

**已完成：**
- ✅ cpolar 双子域名架构
  - Ergo: https://terryzin.cpolar.cn
  - Gateway: https://terrysopenclaw.cpolar.cn
- ✅ 删除自定义代理服务器（proxy-server.js）
- ✅ OpenClaw ↔ Claude Code 协作机制设计
- ✅ 项目目录重组
- ✅ OpenClaw Dashboard 链接 + Token 自动登录
- ✅ 直接连接 OpenClaw Gateway API（v1.2.2）
- ✅ HTTP 轮询机制（每 10 秒刷新，v1.2.2）
- ✅ Token 认证集成（Bearer Token，v1.2.2）
- ✅ Mock 数据自动回退（v1.2.2）

**降级实现（务实路径）：**
- 🔄 使用 HTTP 轮询代替 WebSocket（简单、够用）
- 🔄 暂不实现自动重连（轮询本身就是持续重试）

**未来优化（v1.4+）：**
- ⏳ WebSocket 实时推送（降低延迟、减少请求）
- ⏳ 智能重连策略（指数退避算法）

**版本历史：**
- v1.2.2 (2026-02-20) - 实现 API Bridge Server（OpenClaw CLI → HTTP API）
- v1.2.1 (2026-02-16) - OpenClaw 链接修复 + Token 自动登录
- v1.2.0 (2026-02-15) - 架构调整（双子域名 + 删除代理）

**v1.2.2 更新详情：**

*API Bridge Server (8082):*
- ✅ 创建 Node.js + Express 服务器
- ✅ 执行 `openclaw status --json` 并解析输出
- ✅ 数据格式转换（OpenClaw → Ergo）
- ✅ CORS 支持 + 超时处理（15秒）
- ✅ API 端点：`/api/status`, `/health`, `/api/cron`, `/api/gateway/restart`

*前端集成 (8081):*
- ✅ HTTP 轮询机制（每 10 秒自动刷新）
- ✅ 请求超时处理（20秒）
- ✅ Mock 数据自动回退
- ✅ 数据来源标识（真实 vs Mock）
- ✅ 启动脚本：`start-ergo.bat`

*Bug 修复:*
- 🐛 修复 fetch 超时问题（5秒 → 20秒）
- 🐛 修复 `getNetworkState is not defined` 错误

**架构说明：**
```
Ergo 前端 → API Bridge → OpenClaw CLI → Gateway
  8081         8082         命令行          18789
```

OpenClaw Gateway 使用 WebSocket RPC（非 REST），
API Bridge 通过 CLI 转换为简单的 HTTP API。

**测试验证：**
- ✅ `test-api-flow.bat` - API 流程测试
- ✅ 真实数据显示：Gateway online, Agent: main (MiniMax-M2.5)

**下一步方向：**
- v1.3 移动端体验优化（响应式布局、FAB、PWA）
- v1.4 WebSocket 实时推送（降低延迟）
- v1.4 异常推送通知

---

## 当前版本规划

### v1.3 - 移动端体验优化 🔄

> **目标**: 让陈磊在手机上更快、更爽地管理 AI 管家
> **预计完成**: 2026-03-05 (15 个工作日)
> **完成度**: 0%
> **版本文档**: [docs/versions/v1.3/](docs/versions/v1.3/)
> **详细规划**: [feature-plan.md](docs/versions/v1.3/feature-plan.md)
> **用户画像**: [persona.md](docs/product/persona.md)

#### P0 - 必须有（核心功能）

**🔐 自动配对系统** ⭐ 新增优先级
- [ ] API Bridge 密钥验证中间件
- [ ] 前端自动发送 `X-Ergo-Key` Header
- [ ] 首次访问引导页面
- [ ] 密钥配置界面（settings.html）
- [ ] 错误处理（401 提示重新配对）
- [ ] 环境变量支持（`ERGO_SECRET`）
- [ ] 启动脚本自动注入密钥
- 📄 **设计文档**: [AUTO_PAIRING_DESIGN.md](../AUTO_PAIRING_DESIGN.md)

**响应式布局优化**
- [ ] 移动端单列布局 (< 768px)
- [ ] 大触控区域 (最小 44x44px)
- [ ] iPhone 安全区域适配
- [ ] 字体响应式（移动端 16px 起步）

**快速操作面板**
- [ ] 悬浮操作按钮 (FAB)
- [ ] 一键重启 Gateway
- [ ] 一键执行任务
- [ ] 一键查看日志

**状态指示优化**
- [ ] 颜色 + 图标编码（✅ ⚠️ ❌）
- [ ] 状态呼吸动画
- [ ] 加载中动画
- [ ] 错误抖动效果

#### P1 - 应该有（智能化初步）

**推送通知**
- [ ] Web Push API 集成
- [ ] 异常实时通知
- [ ] 浏览器权限请求
- [ ] 通知点击跳转

**操作历史记录**
- [ ] 本地存储操作日志
- [ ] 最近 20 条记录展示
- [ ] 操作结果标记（成功/失败）
- [ ] 操作历史卡片

**离线缓存 (PWA 初步)**
- [ ] Service Worker 实现
- [ ] 静态资源缓存
- [ ] manifest.json 配置
- [ ] 添加到主屏幕提示

#### P2 - 可以有（锦上添花）

**手势操作**
- [ ] 左滑快速重启
- [ ] 右滑查看详情
- [ ] 下拉刷新

**性能优化**
- [ ] 懒加载组件
- [ ] 防抖/节流
- [ ] 骨架屏加载
- [ ] 首屏关键 CSS 内联

**视觉动效**
- [ ] 卡片点击微交互
- [ ] 状态切换过渡
- [ ] Toast 滑入动画
- [ ] 触感反馈（vibrate）

---

## 未来版本规划

### v1.4 - 项目管理系统 ✅

> **发布日期**: 2026-02-20
> **完成度**: 100%
> **目标**: 将 Ergo 从静态项目列表展示器升级为完整的项目管理控制台

**已完成：**
- ✅ **后端 API（6 个端点）**
  - GET /api/projects - 获取项目列表（含健康状态）
  - POST /api/projects - 创建项目
  - GET /api/projects/:id - 获取项目详情
  - PUT /api/projects/:id - 更新项目
  - DELETE /api/projects/:id - 删除项目
  - GET /api/projects/:id/status - 读取 project-status.json

- ✅ **前端页面**
  - projects-manage.html - 完整的 CRUD 管理界面
  - index.html - 项目列表增强（健康状态图标 + 管理按钮）
  - project.html - 详情页增强（健康度卡片）

- ✅ **数据迁移**
  - data/projects.json 添加 path 字段（4 个项目）
  - project-status.json 标准格式定义
  - Ergo 项目状态文件示例

- ✅ **测试与验证**
  - 7 个新增 smoke test 用例
  - 项目管理全流程测试
  - 路径验证、404 错误处理

**技术亮点：**
- 路径安全检查（防止路径遍历攻击）
- 优雅降级（状态文件不存在时返回默认值）
- 健康度自动计算（服务、测试、构建）
- Apple 风格深色主题 UI

---

### v1.5 - 实时监控与自动化 ✅

> **发布日期**: 2026-02-20
> **完成度**: 95% (P0 + P1 + P2 仪表盘完成，仅操作历史待实现)
> **目标**: 从"静态项目管理"升级为"实时监控与智能自动化中心"
> **版本文档**: [docs/versions/v1.5/](docs/versions/v1.5/)

#### P0 - 必须有（核心实时监控）✅

**WebSocket 实时连接**
- ✅ 前端 WebSocket 客户端封装（`src/realtime.js`）
- ✅ 后端 WebSocket Server（集成到 `server/api-bridge.js`）
- ✅ 自动重连策略（指数退避 + 随机延迟）
- ✅ 连接状态可视化（在线/离线指示器）
- ✅ 文件监听：`project-status.json` 变更实时推送
- ✅ 心跳机制（30 秒）

**实时状态更新**
- ✅ 项目健康度实时刷新（无需手动刷新页面）
- ✅ Gateway 状态实时推送（每 10 秒）
- ✅ Cron 任务状态实时更新
- ✅ 广播机制（多客户端同步）

#### P1 - 应该有（快速操作）✅

**一键快速操作**
- ✅ 一键重启 Gateway（`POST /api/gateway/restart`）
- ✅ 一键触发 Cron 任务（`POST /api/cron/:jobId/trigger`）
- ✅ 操作确认对话框
- ✅ 操作反馈 Toast

**浏览器通知**
- ✅ 通知权限请求 UI
- ✅ 异常实时提醒（服务停止、健康度下降）
- ✅ Gateway 离线通知
- ✅ 通知点击跳转到对应项目
- ✅ 智能去重（5 分钟内同类通知只发一次）

#### P2 - 可以有（智能化初步）✅ 部分完成

**多项目仪表盘** ✅ 已完成
- ✅ 创建 `dashboard.html` 页面
- ✅ 所有项目聚合视图（卡片式布局）
- ✅ 健康度、服务状态、测试结果一览
- ✅ 实时更新（WebSocket 驱动）
- ✅ 统计卡片（总项目数、健康/降级/异常项目）
- ⏸️ 筛选和排序功能（待实现）

**智能化基础** ⏸️ 待实现
- [ ] 操作历史记录（本地存储）
- [ ] 最近 20 条操作展示
- [ ] 操作结果标记（成功/失败）

#### 技术栈

**新增依赖**：
- ✅ `ws` (^8.x) - WebSocket Server
- ✅ `chokidar` (^3.x) - 文件监听

**新增文件**：
- ✅ `src/realtime.js` - WebSocket 客户端
- ✅ `src/notifications.js` - 浏览器通知管理
- ✅ `dashboard.html` - 多项目仪表盘

**修改文件**：
- ✅ `server/api-bridge.js` (+200 行)
- ✅ `index.html` (+200 行)
- ✅ `tests/smoke-test.js` (+100 行，v1.5 测试用例)

#### 成功指标

**定量指标**：
- ✅ 状态更新延迟 < 1 秒（WebSocket 实时推送）
- ✅ 操作完成时间 < 5 秒（一键快速操作）
- ✅ 异常响应时间 < 30 秒（浏览器通知）
- ✅ 多项目查看时间减少 80%（仪表盘已完成）
- ✅ 测试覆盖率：60 个测试用例（100% 通过）

**定性指标**：
- ✅ 用户："再也不用频繁刷新了"（实时推送）
- ✅ 用户："发现问题后立即能处理"（快速操作）
- ✅ 用户："出现异常立即就知道了"（浏览器通知）

---

### v1.6 - 操作工作台 📋

> **发布日期**: 2026-02-23（预计）
> **完成度**: 0%
> **核心主题**: 从"监控中心"到"操作工作台" — 从被动查看到主动干预
> **版本文档**: [docs/versions/v1.6/](docs/versions/v1.6/)

#### P0 - 必须有（核心操作闭环）

**快速文件查看器** ⭐
- [ ] 目录树浏览（工作空间根目录）
- [ ] 文本文件查看（前 500 行，syntax highlighting）
- [ ] 文件搜索（按名称）
- [ ] 敏感文件保护（`.env`, `credentials.json`）

**快速日志查看** ⭐
- [ ] 项目详情页新增"日志" tab
- [ ] 实时日志流（最新 100 行，自动滚动）
- [ ] 刷新 + 下载日志按钮
- [ ] 日志路径配置（`project-status.json`）

**基础命令执行** ⭐
- [ ] 单命令输入框（非完整终端）
- [ ] 预设常用命令（`npm run dev`, `git status`, `df -h`, `ps aux`）
- [ ] 命令输出展示（最多 500 行）
- [ ] 危险命令拦截（`rm -rf /`, `sudo`, fork bomb）

**文件快速操作**
- [ ] 简单文本编辑（配置文件，< 1000 行）
- [ ] 文件上传（拖拽 + 选择，< 10MB）
- [ ] 文件下载（单文件）
- [ ] 文件删除（二次确认）

#### P1 - 应该有（效率提升）

**文件编辑增强**
- [ ] 语法高亮（JSON/YAML/JS/Python）
- [ ] 自动保存（草稿）
- [ ] 撤销/重做
- [ ] 文件内搜索（Ctrl+F）

**命令历史管理**
- [ ] 本地存储最近 50 条命令
- [ ] 方向键切换历史
- [ ] 收藏常用命令
- [ ] 固定到快捷入口

**批量文件操作**
- [ ] 多选文件
- [ ] 批量下载（ZIP）
- [ ] 批量删除
- [ ] 批量移动

**智能命令提示**
- [ ] 根据项目类型推荐命令（npm/git/docker）
- [ ] 命令自动补全（基础）

#### P2 - 可以有（锦上添花）

**完整终端模拟器**
- [ ] xterm.js 集成（完整 TTY）
- [ ] 工作目录切换（`cd`）
- [ ] 终端主题（Dracula/Nord）

**文件编辑器增强**
- [ ] Monaco Editor 集成（VS Code 同款）
- [ ] 代码格式化（Prettier）
- [ ] Lint 提示
- [ ] 多文件搜索替换

**Git 可视化操作**
- [ ] 分支切换
- [ ] Commit + Push（简化流程）
- [ ] Pull 最新代码
- [ ] Commit 历史查看

#### 目标场景（基于用户画像）

**场景 1：快速诊断项目异常** ⭐ 最高频
- 当前：5 分钟（Ergo 看问题 → SSH 连接 → 查日志 → 执行命令）
- v1.6：30 秒（Ergo 看问题 → 查日志 → 执行命令 → 解决）
- **时间节省 90%**

**场景 2：快速修改配置文件**
- 不需要 VS Code Remote 或 SSH，直接在 Ergo 编辑并重启

**场景 3：检查磁盘空间和清理**
- 一键执行 `df -h` 查看空间，`rm` 清理大文件

#### 成功指标

**定量指标**：
- ✅ 问题诊断时间减少 80%（5 分钟 → 1 分钟）
- ✅ 文件操作完成时间 < 10 秒
- ✅ 命令执行响应 < 3 秒
- ✅ 文件浏览加载 < 2 秒
- ✅ 日志查看延迟 < 1 秒

**定性指标**：
- ✅ 用户："再也不用频繁切换 SSH 了"
- ✅ 用户："在手机上也能快速修复问题"
- ✅ 用户："一周内至少 3 次用 Ergo 直接解决问题"

#### 潜在风险

⚠️ **安全性**：命令执行/文件编辑可能被恶意利用
- 降级：强制认证 + 命令白名单 + 敏感文件黑名单 + 审计日志

⚠️ **性能**：大文件查看/编辑可能卡顿
- 降级：文件大小限制 + 虚拟滚动 + 大文件提示下载

⚠️ **移动端体验**：终端/编辑器在手机上操作困难
- 降级：移动端简化为查看 + 预设命令按钮化

---

### v1.7 - 协作与扩展 📋

**多用户协作**
- [ ] 用户认证系统
- [ ] 权限管理
- [ ] 操作审计日志
- [ ] 团队视图

**插件系统**
- [ ] 插件加载机制
- [ ] API 标准化
- [ ] 官方插件市场
- [ ] 第三方集成（GitHub, Slack, etc.）

---

## 里程碑

| 版本 | 状态 | 发布日期 | 核心目标 |
|------|------|---------|---------|
| v1.0 | ✅ 已发布 | 2026-02-15 | 基础功能和 UI |
| v1.1 | ✅ 已发布 | 2026-02-15 | 测试和文档 |
| v1.2 | ✅ 已发布 | 2026-02-20 | Gateway API 集成 |
| v1.3 | ✅ 已发布 | 2026-02-20 | 自动配对系统 |
| v1.4 | ✅ 已发布 | 2026-02-20 | 项目管理系统 |
| v1.5 | ✅ 已发布 | 2026-02-21 | 实时监控与自动化（100%） |
| **v1.6** | 📋 **规划中** | **2026-02-23** | **操作工作台** |
| v1.7 | 📋 计划中 | 2026-03-05 | 智能化与 AI 集成 |
| v1.8 | 📋 计划中 | 2026-Q2 | 协作与扩展 |

---

## 技术演进

### 架构演进

```
v1.0-v1.2: 单文件架构
└─ index.html (1200 行)

v1.3: 文件拆分
├─ index.html (300 行)
├─ src/styles.css (500 行)
├─ src/app.js (400 行)
├─ src/api.js (200 行)
├─ src/notifications.js (150 行)
├─ src/pwa.js (100 行)
└─ sw.js (100 行)

v1.5+: 模块化 + 构建工具
└─ Vite/Rollup + ESM
```

### 技术栈

**当前：**
- 前端: 纯静态 HTML/CSS/JS，无框架依赖
- 静态服务: Python http.server (端口 8081)
- 后端: OpenClaw Gateway API (localhost:18789)
- 通信: WebSocket (自动重连)
- 内网穿透: cpolar 双隧道架构
- 测试: Jest + jsdom

**未来考虑：**
- v1.3: PWA (Service Worker + manifest.json)
- v1.4: 轻量状态管理（可能引入 Zustand）
- v1.5: 构建工具（Vite）+ 代码编辑器（Monaco）
- v1.6: 用户认证（可能引入后端服务）

---

## 设计原则（基于 Persona）

根据用户画像（陈磊 - 产品/技术管理者），遵循以下原则：

1. **移动优先（Mobile First）**
   - 大触控区域、单手操作、快速加载

2. **一目了然（Glanceable）**
   - 状态清晰、颜色编码、卡片分组

3. **快速操作（Quick Actions）**
   - 常用操作一键完成、即时反馈

4. **美观愉悦（Delightful）**
   - Apple 风格、流畅动画、深色模式

5. **智能化（AI-Powered）**
   - 自动判断、预测通知、减少手动操作

**详细设计原则**: [persona.md](docs/product/persona.md)

---

## 成功指标

### v1.3 目标

**定量指标：**
- ✅ 移动端首屏加载 < 1.5s
- ✅ Lighthouse 移动端分数 > 90
- ✅ 核心操作步骤减少 60%（5 步 → 2 步）
- ✅ 离线缓存命中率 > 80%

**定性指标：**
- ✅ 陈磊：手机上用起来"很爽"
- ✅ 向朋友展示时：朋友主动询问技术栈
- ✅ 陈磊一周内至少 3 次用手机快速处理异常

---

## 快速开始

```bash
# 启动开发服务器
python -m http.server 8081

# 运行测试
npm test

# 启动任务监听器（OpenClaw 协作）
node scripts/task-watcher.js
```

### 访问地址

- **本地开发**: http://localhost:8081
- **公网访问**: https://terryzin.cpolar.cn
- **OpenClaw Gateway**: https://terrysopenclaw.cpolar.cn

---

## 协作机制

Ergo 支持 **OpenClaw Gateway 委托任务** 给 Claude Code 执行。

**详细文档：**
- [OpenClaw 协作说明](.openclaw/README.md)
- [架构设计文档](docs/architecture/openclaw-claude-integration.md)

**快速测试：**
```bash
# 创建测试任务
cp .openclaw/tasks/example-task.json .openclaw/tasks/pending/task-test.json

# 启动监听器
node scripts/task-watcher.js
```

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [README.md](README.md) | 项目介绍和快速开始 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 项目上下文 |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | 目录结构说明 |
| [docs/product/persona.md](docs/product/persona.md) | 用户画像（陈磊） |
| [docs/versions/](docs/versions/) | 各版本详细文档 |
| [docs/versions/v1.3/](docs/versions/v1.3/) | v1.3 详细功能规划 |
| [docs/product/](docs/product/) | 产品文档（全局） |
| [docs/architecture/openclaw-claude-integration.md](docs/architecture/openclaw-claude-integration.md) | OpenClaw 协作机制 |

---

## 贡献指南

**提交规范：**
- `feat:` - 新功能
- `fix:` - Bug 修复
- `docs:` - 文档更新
- `style:` - 样式调整
- `refactor:` - 重构
- `test:` - 测试相关
- `chore:` - 构建、配置等

**协作原则：**
- 每次完成独立功能点后立即 `git push`
- 多设备协作时，每次开始前先 `git pull`
- 避免长期憋大 commit

---

**最后更新**: 2026-02-19 by Claude Code
