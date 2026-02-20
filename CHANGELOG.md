# Ergo 更新日志

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
