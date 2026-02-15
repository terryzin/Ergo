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
├── index.html      # 主页面（唯一页面，包含所有 HTML/CSS/JS）
├── package.json    # 项目元信息
├── PRD.md          # 产品需求文档
└── CLAUDE.md       # 本文件
```

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
