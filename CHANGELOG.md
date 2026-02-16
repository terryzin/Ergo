# Ergo 更新日志

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
