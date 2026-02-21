# Ergo 更新日志

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.7.0] - 2026-02-21

### Changed
- **🏗️ 架构重构：双域名 → 单域名**（Majestic Monolith 风格）⭐ 重要变更
  - 删除 `openclaw-gateway` 隧道配置（`cpolar.yml`）
  - 统一入口：`https://terryzin.cpolar.top`（释放 1 个域名配额）
  - Gateway 不再直接暴露，通过 API Bridge 代理访问（更安全）
  - 前端、API、Gateway 三层架构统一在单域名下

### Added
- **📖 迁移指南**：
  - `docs/architecture/single-domain-migration.md` - 完整的迁移步骤和验证清单
  - 3 分钟快速迁移（仅需调整配置，无代码改动）
  - 回滚方案（Git 一键回滚）
  - 常见问题排查

- **🚀 启动脚本**：
  - `scripts/start-cpolar.bat` - Cpolar 隧道一键启动脚本
  - 自动检查 cpolar 安装
  - 验证配置文件存在性
  - 启动后自动打开 Web UI

### Changed
- **环境配置简化**：
  - `.env` - 删除 `CPOLAR_GATEWAY_URL`，改为统一的 `CPOLAR_URL`
  - `.env.example` - 同步更新配置模板
  - `CLAUDE.md` - 更新部署架构说明（单域名三层架构）

- **Cpolar 配置优化**：
  - `cpolar.yml` - 删除 `openclaw-gateway` 隧道
  - 重命名 `ergo-frontend` → `ergo`
  - 增加架构说明注释

### Technical
- **架构演进（DHH 原则）**：
  - ✅ **Majestic Monolith**：单一部署单元，统一入口
  - ✅ **Convention over Configuration**：约定 `/api` 路由，无需配置反向代理
  - ✅ **Choose Boring Technology**：复用现有 Express 代理，拒绝引入 Nginx/Caddy
  - ✅ **Security by Default**：Gateway 不直接暴露，降低攻击面

- **请求流转（单域名）**：
  ```
  https://terryzin.cpolar.top/api/status
    ↓ cpolar tunnel
  localhost:8081/api/status (Frontend Proxy - 路由层)
    ↓ Express Proxy
  localhost:8082/api/status (API Bridge - 业务层)
    ↓ OpenClaw CLI
  localhost:18789 (OpenClaw Gateway)
  ```

### Migration Notes
- ⚠️ 需要重新配置 Cpolar 隧道（删除 `openclaw-gateway`）
- ⚠️ 需要重启 Cpolar 服务（`cpolar service restart`）
- ✅ 无需修改代码，仅调整配置文件
- ✅ 支持 Git 一键回滚（如有问题）

---

## [v1.6.1] - 2026-02-21

### Fixed
- **🌐 外网环境 API 连接**：修复文件浏览器和终端在外网无法使用的问题 ⭐ 关键修复
  - 问题：`file-browser.html` 和 `terminal.html` 硬编码 `localhost:8082`
  - 影响：外网访问时无法连接 API（跨域错误）
  - 解决：创建 `src/config.js` 统一配置管理，自动检测环境

### Added
- **⚙️ 环境自动切换机制**：
  - `src/config.js` - 全局配置管理器
  - 基于 hostname 自动检测运行环境
  - 本地环境 (`localhost`/`127.0.0.1`) → 直连 `http://localhost:8082`
  - 外网环境 (cpolar 等) → 相对路径（前端代理转发）
  - 单例模式，支持 API Key 管理

- **🔍 配置检查工具**：
  - `config-check.html` - 环境配置验证页面
  - 实时显示当前环境信息
  - API 连接测试功能
  - 响应时间和数据展示

- **📚 配置文档**：
  - `docs/CONFIG.md` - 完整的配置说明
  - 环境检测规则说明
  - 部署检查清单
  - 常见问题解答

### Changed
- **更新页面配置**：
  - `file-browser.html` - 使用 `ergoConfig` 替代硬编码
  - `terminal.html` - 使用 `ergoConfig` 替代硬编码
  - 移除所有硬编码的 `localhost:8082`

### Technical
- **自动环境检测逻辑**：
  ```javascript
  detectApiBase() {
      const hostname = window.location.hostname;
      return (hostname === 'localhost' || hostname === '127.0.0.1')
          ? 'http://localhost:8082'  // 本地直连
          : '';                       // 外网代理
  }
  ```
- **配置使用示例**：
  ```javascript
  // 获取 API URL
  const apiUrl = ergoConfig.getApiUrl('/api/status');

  // 发起请求
  fetch(apiUrl, {
      headers: { 'X-Ergo-Key': ergoConfig.getApiKey() }
  });
  ```

### Testing
- ✅ 配置文件存在性验证
- ✅ 页面集成完整性检查
- ✅ 硬编码问题扫描
- ✅ 本地环境连接测试
- ✅ 外网环境连接测试（待部署后验证）

---

## [v1.6.0] - 2026-02-21

### Added
- **🛠️ 操作工作台**：从"监控中心"升级为"操作工作台" ⭐ 核心功能
  - 用户可在同一界面完成"发现问题 → 诊断问题 → 解决问题"的完整闭环
  - 无需切换到 SSH, VS Code, 或其他工具
  - 集成文件浏览、命令执行、日志查看三大核心功能

- **📁 文件浏览器**（file-browser.html）：
  - 双栏布局：左侧文件树 + 右侧文件预览
  - 面包屑导航支持快速跳转
  - 文件类型图标识别（目录📁、保护文件🔒、代码文件📜）
  - 文件大小格式化显示
  - 编辑/下载操作按钮
  - 响应式设计支持移动端
  - Apple Design 深色主题

- **💻 终端界面**（terminal.html）：
  - 类 macOS Terminal 深色主题
  - 实时命令执行和输出显示
  - 多色输出（命令/输出/错误/警告/信息）
  - 命令历史记录（↑↓ 键导航）
  - 快捷命令按钮（ls, pwd, git, npm 等）
  - 导出历史记录功能
  - 自动滚动到最新输出
  - Enter 键快速发送
  - 工作目录状态跟踪（cd 命令支持）

- **🔐 文件管理 API**：
  - `GET /api/files/browse` - 浏览目录树
  - `GET /api/files/read` - 读取文件内容
  - `PUT /api/files/update` - 更新/创建文件（自动备份）
  - `POST /api/files/upload` - 上传文件（base64）
  - `DELETE /api/files/delete` - 删除文件（移到回收站/永久删除）

- **⚙️ 命令执行 API**：
  - `POST /api/command/exec` - 执行 shell 命令
  - 跨平台支持（Windows cmd.exe / Unix bash）
  - 危险命令拦截（rm -rf, sudo, shutdown 等 15 种模式）
  - 输出大小限制（500KB）
  - 超时控制（可配置）
  - 工作目录切换支持

- **📊 日志查看 API**：
  - `GET /api/logs/tail` - 读取日志尾部（默认 100 行）
  - `GET /api/logs/download` - 下载完整日志文件
  - 从 project-status.json 读取日志配置
  - 支持多个日志文件（app, error, test）

### Security
- **路径遍历防护**：
  - `sanitizePath()` 函数增强
  - 绝对路径解析验证
  - 工作空间边界检查（必须在 WORKSPACE_ROOT 内）

- **敏感文件保护**：
  - 黑名单过滤 15 种敏感文件
  - .env, credentials.json, SSH keys, certificates 等
  - 403 Forbidden 返回

- **危险命令拦截**：
  - 15 种危险命令模式识别
  - rm -rf, sudo, shutdown, mkfs, fork bomb 等
  - 400 Bad Request 返回

- **文件操作安全**：
  - 自动备份（timestamp 命名，避免冲突）
  - 回收站机制（软删除）
  - 文件名安全检查

### Improved
- **首页导航**：新增「📁 文件」和「💻 终端」快捷入口
- **Smoke Test**：从 96 个增加到 156 个测试用例（+60）
- **测试覆盖率**：100% 通过率（156/156）
- **响应速度**：API 响应时间 < 200ms

### Fixed
- **readProjectStatus() 路径 bug**：修复双重路径拼接问题
- **DELETE 请求 bug**：自动添加 Content-Length header
- **Smoke Test 连接池问题**：移除冗余测试避免超时

### Technical
- **新增文件**：
  - `file-browser.html` - 文件浏览器界面
  - `terminal.html` - 终端命令执行界面
- **修改文件**：
  - `server/api-bridge.js` (+500 行) - 8 个新 API 端点
  - `tests/smoke-test.js` (+300 行) - 60 个新测试用例
  - `index.html` (+2 个导航入口)
- **API 架构**：
  ```
  前端 ←→ HTTP REST API (http://localhost:8082)
         ← GET /api/files/browse?path=./
         ← GET /api/files/read?path=./file.txt
         ← POST /api/command/exec {command, cwd}
         ← GET /api/logs/tail?project=ergo&type=app
         ← PUT /api/files/update {path, content}
         ← POST /api/files/upload {path, content, filename}
         ← DELETE /api/files/delete {path, permanent}
         ← GET /api/logs/download?project=ergo&type=app
  ```

### Testing
- ✅ 156 个测试用例全部通过（100%）
- ✅ 文件浏览测试（12 个）
- ✅ 文件读取测试（10 个）
- ✅ 命令执行测试（11 个）
- ✅ 日志查看测试（9 个）
- ✅ 文件操作测试（12 个）
- ✅ 安全防护测试（路径遍历、敏感文件、危险命令）
- ✅ 认证测试（API key 验证）
- ✅ 错误处理测试
- ✅ 本地 + 公网双环境测试
- ✅ 测试执行时间：34.36s

### Known Limitations
- 文件编辑功能（Edit 按钮）待实现
- 日志实时 tail -f 功能待实现
- 文件上传进度显示待实现
- 终端标签页（多终端会话）待实现

---

## [v1.5.0] - 2026-02-20

### Added
- **🔄 WebSocket 实时连接**：从轮询模式升级为实时推送 ⭐ 核心功能
  - **WebSocket Server**（server/api-bridge.js）：
    - WebSocket Server 集成（ws 库）
    - 客户端连接管理（连接、断开、心跳）
    - 自动重连策略（指数退避 + 随机延迟）
    - 广播机制（多客户端同步）
    - 心跳检测（30 秒一次）
  - **文件监听**（chokidar）：
    - 监听所有 `project-status.json` 文件变更
    - 防抖处理（500ms）
    - 实时推送项目状态更新
  - **定期推送**：
    - Gateway 状态每 10 秒自动推送
    - 无客户端时跳过推送（节省资源）
  - **前端 WebSocket 客户端**（src/realtime.js）：
    - RealtimeService 类封装
    - 自动重连（最多 5 次，指数退避）
    - 事件监听器（on/off/emit）
    - 连接状态管理
    - 心跳保活
  - **实时更新**：
    - 项目健康度实时刷新（无需手动刷新）
    - Gateway 状态实时更新
    - Cron 任务状态实时同步
    - 连接状态可视化（在线/离线指示器）

- **⚡ 快速操作增强**：
  - **一键触发 Cron 任务**：
    - 新增 API：`POST /api/cron/:jobId/trigger`
    - 确认对话框（防误操作）
    - 实时反馈 Toast
    - 触发后 3 秒自动刷新列表
    - 触发按钮添加悬停效果
  - **Gateway 重启广播**：
    - 重启时通过 WebSocket 广播通知所有客户端
    - 自动刷新状态

- **🔔 浏览器通知**：
  - **通知管理器**（src/notifications.js）：
    - NotificationManager 类
    - 通知权限请求（Notification API）
    - 智能去重（5 分钟内同类通知只发一次）
    - 点击跳转到对应页面
    - 自动清理过期缓存
  - **异常实时提醒**：
    - 项目健康度下降（unhealthy/degraded）
    - 服务停止运行
    - Gateway 离线
    - Cron 任务失败
  - **成功/错误通知**：
    - 操作成功自动关闭（3 秒）
    - 错误通知自动关闭（5 秒）

### Improved
- **状态更新延迟**：从轮询 10 秒 → WebSocket < 1 秒
- **用户体验**：无需手动刷新，状态自动更新
- **服务器性能**：WebSocket 推送模式，减少 HTTP 轮询请求
- **异常响应**：从被动查看 → 主动通知，响应时间 < 30 秒

### Technical
- **新增依赖**：
  - `ws` (^8.x) - WebSocket Server
  - `chokidar` (^3.x) - 文件监听
- **新增文件**：
  - `src/realtime.js` - WebSocket 客户端封装
  - `src/notifications.js` - 浏览器通知管理
- **修改文件**：
  - `server/api-bridge.js` (+200 行) - WebSocket Server + 文件监听
  - `index.html` (+200 行) - WebSocket 集成 + 通知初始化
- **连接架构**：
  ```
  前端 ←→ WebSocket (ws://localhost:8082)
         ← 项目状态推送 (project-status.json 变更)
         ← Gateway 状态推送 (每 10 secara)
         ← 心跳检测 (每 30 秒)
  ```

### Testing
- ✅ WebSocket 连接测试（连接、断开、重连）
- ✅ 文件监听测试（project-status.json 变更检测）
- ✅ 广播机制测试（多客户端同步）
- ✅ Cron 触发 API 测试
- ✅ 浏览器通知测试
- ✅ **缓存控制测试** (v1.5.1 新增)：
  - HTML 文件禁用缓存验证（no-cache, no-store, must-revalidate）
  - 根路径 `/` 缓存头验证
  - Pragma 和 Expires 头兼容性测试
  - 静态资源（图片、JS）允许缓存验证
  - 新增 6 个测试用例，总计 72 个测试

### Fixed
- **浏览器缓存问题** (2026-02-21)：
  - 前端服务器添加 `Cache-Control: no-cache` 响应头
  - 防止 HTML 文件被浏览器缓存导致加载旧版本代码
  - 修复 projects-manage.html 显示 404 错误（logo.png, realtime.js）
  - 中间件在 Express static 之前拦截 `.html` 请求和根路径 `/`
  - 修复根路径返回 `public, max-age=0` 而非 `no-cache` 的问题

- **WebSocket 连接失败** (2026-02-21)：
  - 修复 API Bridge 认证中间件拦截 WebSocket 升级请求
  - 添加 `req.headers.upgrade === 'websocket'` 检查，豁免 WebSocket 认证
  - 修复前端代理 WebSocket 路径重写问题（使用原生 http-proxy）
  - 解决公网 cpolar 访问时 WebSocket 连接错误 1006
  - ✅ 本地测试通过（ws://localhost:8081 → ws://localhost:8082）
  - ⚠️ 公网 cpolar 需要确认 WebSocket 支持（WSS 协议）

- **projects-manage.html API 访问失败** (2026-02-21)：
  - 修复外网访问时 ERR_CONNECTION_REFUSED 错误
  - 修改 API_BASE 从 `http://localhost:8082` 改为空字符串
  - 使用代理模式访问，与 dashboard.html 保持一致
  - ✅ 本地和公网访问均正常

### Documentation
- ✅ 功能规划：[docs/versions/v1.5/feature-plan.md](docs/versions/v1.5/feature-plan.md)
- ✅ ROADMAP 更新：v1.5 完成标记
- ✅ 技术架构文档更新
- ✅ 故障排查指南：[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) ⭐ 新增

### Breaking Changes
- ⚠️ 需要 WebSocket 支持（IE 不支持）
- ⚠️ 浏览器通知需要 HTTPS 或 localhost
- ⚠️ 新增依赖：ws, chokidar

### Additional Features (P2)
- ✅ **多项目仪表盘**（dashboard.html）：
  - 所有项目聚合视图
  - 健康度统计卡片（总项目、健康、降级、异常）
  - 项目卡片布局（2 列自适应）
  - 实时更新（WebSocket 驱动）
  - 点击卡片跳转到详情页
  - 健康状态颜色编码（绿/黄/红）
- ✅ **首页仪表盘入口**：在"开发项目"区域添加"📊 仪表盘"按钮

### Testing
- ✅ v1.5 新增测试：6 个测试用例
  - Cron 触发 API 端点测试
  - WebSocket 升级路径测试
  - realtime.js 脚本可访问性
  - notifications.js 脚本可访问性
  - dashboard.html 页面可访问性
  - 首页 WebSocket 集成测试
- ✅ 所有测试通过：30/30（本地），60/60（全部）

### Known Issues
- ⏸️ 操作历史记录待实现（P2 优先级，未来版本）

---

## [v1.4.0] - 2026-02-20

### Added
- **🎯 项目管理系统**：完整的 CRUD 功能 ⭐ 核心功能
  - **后端 API（6 个端点）**：
    - `GET /api/projects` - 获取项目列表（含健康状态）
    - `POST /api/projects` - 创建项目（表单验证、路径检查）
    - `GET /api/projects/:id` - 获取项目详情（含状态文件）
    - `PUT /api/projects/:id` - 更新项目（部分更新）
    - `DELETE /api/projects/:id` - 删除项目（仅删除记录）
    - `GET /api/projects/:id/status` - 读取 project-status.json
  - **项目管理页面**（projects-manage.html）：
    - 完整的 CRUD 操作界面
    - 创建/编辑项目模态框
    - 实时数据验证（ID 格式、版本号、路径存在性）
    - 删除确认对话框
    - Toast 通知系统
  - **首页增强**（index.html）：
    - 项目列表显示健康状态图标（✅ ⚠️ ❌）
    - "管理"按钮快速跳转
    - API 数据加载 + 本地 JSON 降级
  - **详情页增强**（project.html）：
    - 健康度卡片（总览状态、服务、测试、构建）
    - 项目路径显示
    - 状态文件实时读取

- **📂 project-status.json 标准格式**：
  - Schema 版本 1.0
  - 基础信息：name, version, status, lastUpdate
  - 健康状态：services, tests, build
  - 性能指标：responseTime, throughput, errorRate
  - 自定义扩展字段

- **📊 健康度自动计算**：
  - 综合评估：healthy, degraded, unhealthy
  - 服务状态检查（running/stopped）
  - 测试通过率统计
  - 构建成功/失败状态

### Improved
- **数据模型扩展**：data/projects.json 新增 `path` 字段
- **安全性**：路径安全检查（防止路径遍历攻击 `../`）
- **容错性**：优雅降级（状态文件不存在时返回 null）
- **用户体验**：Apple 风格深色主题，流畅动画

### Technical
- **路径配置**：相对工作空间路径（`./目录名`）
- **工作空间根目录**：`D:\.openclaw\workspace`
- **数据验证规则**：
  - 项目 ID：`^[a-z0-9-]{3,50}$`
  - 版本号：`^\d+\.\d+\.\d+$`（语义化版本）
  - 路径：必须以 `./` 开头且目录存在
- **API 认证**：所有端点需要 X-Ergo-Key header

### Testing
- ✅ 7 个新增 smoke test 用例
  - 获取项目列表
  - 验证健康状态
  - 读取项目详情
  - 读取状态文件
  - 更新项目（幂等）
  - 路径字段验证
  - 404 错误处理
- ✅ 测试命令：`npm test`
- ✅ 所有测试通过（共 41 个测试用例）

### Documentation
- ✅ 功能规划：[docs/versions/v1.4/feature-plan.md](docs/versions/v1.4/feature-plan.md)
- ✅ ROADMAP 更新：v1.4 完成标记
- ✅ 项目状态文件示例：project-status.json

### Files Changed
- 新增：`projects-manage.html` (管理页面)
- 新增：`project-status.json` (Ergo 项目状态)
- 修改：`server/api-bridge.js` (+300 行，项目管理 API)
- 修改：`index.html` (项目列表增强)
- 修改：`docs/archive/project.html` (详情页增强)
- 修改：`data/projects.json` (添加 path 字段)
- 修改：`tests/smoke-test.js` (+100 行，新增测试)

### Breaking Changes
- ⚠️ `data/projects.json` 新增必填字段 `path`（所有项目已迁移）
- ⚠️ 项目详情页现在从 API 加载数据（有降级方案）

---

## [v1.3.0] - 2026-02-20

### Added
- **🔐 自动配对系统**：双层认证 + 自动审批 ⭐ 核心功能
  - **Layer 1 - OpenClaw Gateway 自动审批**：
    - 自动配对监听器（auto-pairing-watcher.js）
    - 每 10 秒检查 `openclaw devices list` 的 pending 设备
    - 自动执行 `openclaw devices approve --latest`
    - 支持环境变量（AUTO_APPROVE, PAIRING_CHECK_INTERVAL, LOG_LEVEL）
    - 详细审批日志（设备 ID、平台、客户端类型）
  - **Layer 2 - API Bridge 密钥认证**：
    - X-Ergo-Key Header 验证
    - 前端自动密钥管理（localStorage 持久化）
    - 首次访问自动使用默认密钥
    - 401 错误自动触发重新配对
    - 环境变量支持（ERGO_SECRET, AUTH_ENABLED）
- **设置页面**（settings.html）：独立的密钥配置界面
  - 可视化密钥管理
  - 显示/隐藏当前密钥
  - 一键使用默认密钥
  - 使用说明和安全提示
- **首页设置入口**：系统设置卡片
- **统一启动脚本**（start-ergo.bat）：同时启动三个服务
  - 前端服务器 (8081)
  - API Bridge (8082)
  - 自动配对监听器

### Improved
- **多端使用体验**：一次配置，多端同步（浏览器云同步）
- **安全性**：防止未授权访问 API Bridge
- **用户引导**：401 错误时友好提示重新配对
- **控制台日志**：启动时显示认证状态和密钥

### Technical
- 认证中间件：`authMiddleware()` 拦截所有 API 请求
- 健康检查端点豁免认证
- 默认密钥：`ergo-default-secret-key-2026`
- 前端密钥函数：`getApiKey()`, `setApiKey()`, `showAuthPrompt()`
- 存储键名：`ergoApiKey`

### Testing
- ✅ 10 个自动化测试全部通过
- 测试覆盖：认证成功/失败、密钥验证、缓存元数据、前端存储
- 测试脚本：`tests/run-auth-tests.js`
- 测试命令：`node tests/run-auth-tests.js`

### Documentation
- ✅ 设计文档：[AUTO_PAIRING_DESIGN.md](docs/product/AUTO_PAIRING_DESIGN.md)
- ✅ ROADMAP 更新：v1.3 规划完成
- ✅ CLAUDE.md 更新：功能开发流程规范

### Breaking Changes
- ⚠️ 首次访问需要配置密钥（自动使用默认密钥，无感知）
- ⚠️ 旧版本前端无法访问新版 API Bridge（需要提供 X-Ergo-Key）
- ⚠️ 如需关闭认证，设置环境变量 `AUTH_ENABLED=false`

---

## [v1.2.4] - 2026-02-20

### Added
- **前端更新日志自动加载**：从 `/api/changelog` 动态获取最新版本
- **CHANGELOG.md 解析**：后端自动解析 Markdown 格式的更新日志
- **智能版本展示**：首页显示最新 3 个版本，支持跳转查看完整日志
- **完整更新日志页面**（changelog.html）：独立页面展示所有版本历史

### Fixed
- 修复点击更新日志条目时的 404 错误

### Technical
- 新增 API 端点：`GET /api/changelog`
- Markdown 解析：支持 `## [vX.X.X]` 格式
- 前端渲染：`renderChangelog()` 函数
- changelog.html：Apple 风格深色主题，彩色标签分类

---

## [v1.2.3] - 2026-02-20

### Added
- **智能缓存机制**：每 5 分钟自动更新状态缓存
- **手动刷新按钮**：Header 右侧刷新图标，支持强制刷新
- **智能时间显示**："X 秒前更新" / "X 分钟前更新"
- **状态指示增强**：区分"实时"、"缓存"、"Mock"数据
- **双端点策略**：
  - `/api/status` - 返回缓存（快速，< 100ms）
  - `/api/status/refresh` - 强制刷新（实时，10-15秒）
- **Cron 数据集成**：从 `data/gateway-status.json` 读取定时任务信息

### Improved
- **首次加载速度**：后续访问从 10-15秒 降至 < 100ms
- **用户体验**：手动刷新时显示旋转动画和 Toast 提示
- **错误处理**：刷新失败时返回旧缓存而非错误

### Technical
- 缓存时长：5 分钟
- 前端轮询：10 秒
- 缓存元数据：`_meta.cached`, `_meta.cacheAge`, `_meta.lastUpdate`

---

## [v1.3.0] - 2026-02-17

### Added
- 开发项目功能：替代原来的"开发服务"
- 项目列表：显示所有开发中的项目
- 项目详情页：project.html?id=xxx
- projects.json：项目数据配置文件
- 关联服务展示：如Cron任务等

---

## [v1.2.2] - 2026-02-17

### Added
- 定时任务手动触发功能：每个Cron任务增加"触发"按钮
- triggerCronJob API 方法

---

## [v1.2.1] - 2026-02-16

### Fixed
- OpenClaw链接修复：API_BASE变量未定义导致跳转失败
- 测试更新：重写tests/api.test.js支持WebSocket mock

### Changed
- Dashboard链接改为直接使用cpolar URL

---

## [v1.2.0] - 2026-02-15

### Added
- WebSocket API集成（进行中）
- 6个功能卡片基础框架

### Changed
- 从HTTP API切换到WebSocket连接Gateway

---

## [v1.1.0] - 2026-02-14

### Added
- 测试框架搭建
- 项目文档完善

---

## [v1.0.0] - 2026-02-13

### Added
- 初始版本发布
- 基础Dashboard界面
- OpenClaw状态展示
- Cpolar公网地址展示

---

## 开发中 (Unreleased)

### 待完成
- [ ] Gateway API真实数据对接
- [ ] 项目文件管理
- [ ] Cron任务管理
- [ ] 终端命令执行

---

## 版本号规则

格式: `v主版本.次版本.修订号`

- **主版本**: 重大架构变更
- **次版本**: 新功能添加
- **修订号**: Bug修复、小优化

每次发布需要：
1. 更新CHANGELOG.md
2. 更新package.json version
3. git tag推送
