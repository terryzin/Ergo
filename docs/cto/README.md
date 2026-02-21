# CTO 技术文档索引

**作者**: Werner Vogels 思维 CTO Agent
**日期**: 2026-02-21

---

## 文档概览

本目录包含 Ergo 项目的架构设计、运维标准和技术决策文档。

### 核心文档

1. **[架构审查报告](./architecture-review.md)** ⭐ 必读
   - 当前架构的问题诊断
   - 单点故障分析
   - 架构改进方案（三层降级 + 自愈设计）
   - 改进路线图（4 个阶段）

2. **[Cpolar 配置标准](./cpolar-config-standard.md)**
   - Cpolar 隧道配置规范
   - 配置模板和生成脚本
   - 隧道管理最佳实践
   - 故障处理流程

3. **[运维手册](./operations-playbook.md)**
   - 日常运维任务（启动/停止/健康检查）
   - 故障定位决策树
   - 常见故障场景及解决方案
   - 维护任务和监控配置

---

## 快速开始

### 如果你是新加入的开发者

1. **阅读顺序**：
   - 先看 [架构审查报告](./architecture-review.md) 了解系统全貌
   - 再看 [运维手册](./operations-playbook.md) 学习日常操作
   - 最后看 [Cpolar 配置标准](./cpolar-config-standard.md) 掌握隧道管理

2. **准备环境**：
   ```bash
   # 1. 生成 cpolar 配置
   ./scripts/generate-cpolar-config.sh

   # 2. 启动服务
   ./start-ergo.bat

   # 3. 验证健康
   ./scripts/health-check.sh
   ```

3. **出问题时**：
   - 运行 `./scripts/quick-diagnose.sh` 快速诊断
   - 查看 [运维手册 § 四、故障定位流程](./operations-playbook.md#四故障定位流程)
   - 实在不行运行 `./scripts/emergency-restart.sh` 应急重启

### 如果你是产品/QA

**核心问题与解决方案**：

| 问题 | 原因 | 改进方案 | 文档章节 |
|------|------|---------|---------|
| 配置变来变去 | 配置分散在 5+ 个文件 | 服务端配置 API | [架构审查 § 2.3](./architecture-review.md#23-配置管理改进) |
| 经常修复同样的问题 | 缺乏自愈机制 | Systemd 自动重启 + 监控 | [架构审查 § 2.2](./architecture-review.md#22-改进架构设计) |
| API 挂了整站白屏 | 无降级策略 | 三层降级（实时/缓存/静态） | [架构审查 § 2.2](./architecture-review.md#22-改进架构设计) |
| cpolar 域名变化需改代码 | 硬编码域名 | 配置文件 + 动态获取 | [Cpolar 配置 § 三](./cpolar-config-standard.md#三配置模板系统) |

**改进时间表**：
- **Phase 1（1-2 天）**：止血修复 - 配置统一化、启动健康检查、前端降级
- **Phase 2（1 周）**：架构重构 - API Gateway、Backup API、健康检查服务
- **Phase 3（1 周）**：运维自动化 - 自动重启、隧道监控、告警
- **Phase 4（2 周）**：可观测性 - 日志聚合、分布式追踪、性能监控

---

## 关键指标

### 当前状态（v1.6）

| 指标 | 数值 |
|------|------|
| **可用性** | ~85% (手动运维) |
| **MTTR** | 10 分钟（手动定位 + 重启） |
| **配置变更时间** | 20 分钟（改代码 + 部署） |
| **故障影响半径** | 100%（单点故障） |
| **单点故障数量** | 5 个（3 个需手动恢复） |

### 目标（v2.0）

| 指标 | 目标值 | 改进幅度 |
|------|--------|---------|
| **可用性** | > 99.5% (自动化) | +14.5% |
| **MTTR** | 30 秒（自动恢复） | -95% |
| **配置变更时间** | 2 分钟（改配置 + 重启） | -90% |
| **故障影响半径** | < 30%（降级可用） | -70% |
| **单点故障数量** | 0 个（全部自愈） | -100% |

---

## 架构演进

### v1.6（当前）- 手动运维

```
前端 (8081) ─┐
             ├─→ API Bridge (8082) ─→ OpenClaw CLI
             └─→ OpenClaw GW (18789)

问题：
- 5 个单点故障
- 配置分散在 5+ 个文件
- API 挂了前端白屏
- 无自动恢复
```

### v2.0（目标）- 自动自愈

```
前端 (8081)
  ↓
API Gateway (Nginx)
  ├─→ [L1] OpenClaw GW (18789)  实时数据
  ├─→ [L2] API Bridge (8082)    缓存数据 (5min)
  └─→ [L3] Backup API (8083)    静态备份

优势：
- 三层降级，故障影响 < 30%
- 配置统一管理（服务端 API）
- 自动健康检查 + 故障切换
- Systemd 自动重启
```

---

## 技术决策记录（ADR）

### ADR-001: 配置管理方案选择
- **决策**: 服务端配置 API + 运行时配置文件
- **理由**: 解决前端环境检测不可靠，支持 cpolar 域名变更无需重新构建
- **详情**: [架构审查 § 五](./architecture-review.md#五技术决策记录adr)

### ADR-002: 架构演进 - 引入 API Gateway
- **决策**: 使用 Nginx 作为 API Gateway 统一入口
- **理由**: 简化前端配置，自动健康检查 + 故障切换
- **详情**: [架构审查 § 五](./architecture-review.md#五技术决策记录adr)

### ADR-003: 降级策略 - 三层数据源
- **决策**: 实时 → 缓存 → 静态备份
- **理由**: API 短暂不可用时展示缓存，长时间故障时显示历史数据
- **详情**: [架构审查 § 五](./architecture-review.md#五技术决策记录adr)

---

## 脚本工具索引

### 配置管理
- `scripts/generate-cpolar-config.sh` - 生成 cpolar 配置文件
- `scripts/validate-cpolar-config.sh` - 验证配置完整性

### 健康检查
- `scripts/health-check.sh` - 完整健康检查
- `scripts/quick-diagnose.sh` - 快速诊断
- `scripts/cpolar-health-check.sh` - cpolar 隧道检查

### 运维操作
- `scripts/start-with-health-check.sh` - 启动服务并验证
- `scripts/emergency-restart.sh` - 应急重启
- `scripts/backup.sh` - 数据备份
- `scripts/deploy.sh` - 更新部署

### 监控告警
- `scripts/collect-metrics.sh` - 指标采集
- `scripts/log-monitor.sh` - 日志监控
- `scripts/cpolar-auto-reconnect.sh` - 隧道自动重连

---

## 常见问题（FAQ）

### Q1: 为什么要写这么多文档？

**A**: 因为 Ergo 已经有 30+ 次修复提交，60% 是配置和环境问题。这说明系统设计有根本性缺陷，而不是简单的 bug。文档的作用是：
1. **诊断根因** - 避免重复修复同样的问题
2. **设计解决方案** - 系统性改进，而不是打补丁
3. **知识传承** - 新成员快速上手，避免踩坑

### Q2: 改进方案太复杂了，能不能简化？

**A**: 可以分阶段执行：
- **立即执行 Phase 1**（1-2 天）- 配置统一化、启动健康检查
- **Phase 2-4 可以根据实际需求选择性实施**

但必须记住：**简单不等于容易维护**。当前架构看起来简单（Python http.server + cpolar），但实际运维成本很高（频繁出问题、手动修复）。

### Q3: 我只是想快速修好当前的问题，需要看哪些文档？

**A**: 只看这两个：
1. [运维手册 § 四、故障定位流程](./operations-playbook.md#四故障定位流程)
2. [运维手册 § 4.3 常见故障场景](./operations-playbook.md#43-常见故障场景)

遇到问题运行：
```bash
./scripts/quick-diagnose.sh  # 快速诊断
./scripts/health-check.sh     # 健康检查
```

### Q4: cpolar 免费版只能 2 个隧道，怎么办？

**A**: 两种方案：
1. **推荐**：升级到 cpolar Pro（¥9/月），支持 3+ 隧道 + 保留域名
2. **临时方案**：合并前端和 API Bridge 到一个服务器（8081 端口），只需 2 个隧道

详见 [Cpolar 配置 § 6.2](./cpolar-config-standard.md#62-故障处理)

### Q5: 为什么要引入 API Gateway？现在不是跑得挺好的吗？

**A**: 当前架构的问题：
- 前端需要配置 2 个不同的 API 地址（API Bridge + OpenClaw Gateway）
- 配置逻辑散落在多个文件
- API Bridge 挂了，整站不可用

引入 API Gateway 后：
- 前端只连接 1 个地址
- Gateway 自动健康检查 + 故障切换
- API Bridge 挂了，自动切换到 OpenClaw Gateway

这是 **去中心化 + 降级策略** 的最佳实践，来自 Amazon 的经验。

---

## 下一步行动

### 立即执行（本周）

- [ ] 阅读 [架构审查报告](./architecture-review.md)
- [ ] 运行 `./scripts/health-check.sh` 验证当前状态
- [ ] 执行 [Phase 1: 止血修复](./architecture-review.md#phase-1-止血修复1-2-天-最高优先级)
  - [ ] 创建 `/api/config` 端点
  - [ ] 重写 `start-ergo.bat` 增加健康检查
  - [ ] 前端降级策略

### 本月计划

- [ ] 执行 [Phase 2: 架构重构](./architecture-review.md#phase-2-架构重构1-周)
- [ ] 执行 [Phase 3: 运维自动化](./architecture-review.md#phase-3-运维自动化1-周)

### 持续改进

- [ ] 每周运行健康检查
- [ ] 每月审查监控数据
- [ ] 每季度更新架构文档

---

## 联系方式

- **技术讨论**: 在项目 GitHub Issues 中提问
- **文档更新**: 发现问题请直接更新对应文档
- **紧急问题**: 运行 `./scripts/emergency-restart.sh`

---

**文档维护**：
- 初始版本：2026-02-21
- 最后更新：2026-02-21
- 贡献者：CTO Agent (Werner Vogels 思维)
