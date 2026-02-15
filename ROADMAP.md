# Ergo 项目路线图

> 最后更新: 2026-02-15

## 项目概述

Ergo（二狗）是基于 OpenClaw 平台的个人 AI 管家控制台。

---

## 任务状态说明

- [x] 已完成
- [ ] 待完成
- [ ] 进行中
- [ ] 已阻塞

---

## v1.0 基础功能

### 基础架构
- [x] 项目初始化 (index.html 单文件架构)
- [x] Apple 风格深色主题 UI
- [x] 顶部导航栏 + 毛玻璃效果
- [x] 卡片列表布局
- [x] 响应式设计

### 核心功能
- [x] Gateway 状态监控卡片
- [x] Agents 在线状态显示
- [x] Cron 任务列表
- [x] 开发服务入口
- [x] 主题切换 (浅色/深色/自动)
- [x] Toast 通知系统
- [x] Action Sheet 操作确认

### Mock 数据层
- [x] Mock Gateway 数据
- [x] Mock Agents 数据
- [x] Mock Cron Jobs 数据
- [x] Mock Dev Services 数据

**v1.0 完成度**: 100%

---

## v1.1 测试与文档

### 测试框架
- [x] Jest 集成
- [x] jsdom 测试环境
- [x] API 模块测试 (10 tests)
- [x] 纯函数测试 (6 tests)
- [x] 测试覆盖率配置

### 项目文档
- [x] README.md
- [x] package.json 脚本配置
- [x] src/api.js 模块化
- [x] src/app.js 模块化

**v1.1 完成度**: 100%

---

## v1.2 Gateway API 集成

### API 封装
- [ ] fetchGatewayStatus() 真实 API 集成
- [ ] fetchAgents() 真实 API 集成
- [ ] fetchCronJobs() 真实 API 集成
- [ ] fetchDevServices() 真实 API 集成
- [ ] restartGateway() 重启功能

### 错误处理
- [ ] Gateway 离线状态检测
- [ ] 网络错误提示
- [ ] 重连机制

### Mock 模式切换
- [ ] 配置文件开关
- [ ] 生产环境自动禁用

**v1.2 完成度**: 0%

---

## v1.3 增强功能

### 文件管理
- [ ] 工作空间文件浏览
- [ ] 文件上传/下载
- [ ] 文件夹创建/删除

### 命令执行
- [ ] 终端命令输入
- [ ] 命令历史记录
- [ ] 执行结果展示

### 实时状态
- [ ] WebSocket 实时更新
- [ ] 状态变化自动刷新
- [ ] 异常告警通知

**v1.3 完成度**: 0%

---

## v1.4 体验优化

### 性能优化
- [ ] 懒加载非关键资源
- [ ] 缓存策略
- [ ] 增量数据更新

### 可用性
- [ ] 键盘快捷键
- [ ] 深色模式过渡动画
- [ ] 加载状态骨架屏
- [ ] 错误边界处理

### 无障碍
- [ ] ARIA 标签
- [ ] 键盘导航
- [ ] 屏幕阅读器兼容

**v1.4 完成度**: 0%

---

## 里程碑

| 版本 | 状态 | 日期 |
|------|------|------|
| v1.0 | ✅ 已发布 | - |
| v1.1 | ✅ 完成 | 2026-02-15 |
| v1.2 | ⏳ 进行中 | - |
| v1.3 | 📋 计划中 | - |
| v1.4 | 📋 计划中 | - |

---

## 快速开始

```bash
# 运行测试
npm test

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

---

## 外部链接

- [OpenClaw 工作空间](D:\.openclaw\workspace)
- [Gateway API](http://localhost:18789)
- [Dashboard](http://localhost:3000)
- [cpolar Dashboard](https://terryzin.cpolar.top)
