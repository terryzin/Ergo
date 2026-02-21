# Ergo 运维检查清单

> 标准化运维流程，确保系统稳定运行 ✅

## 📋 每日检查清单（Daily Checklist）

### 上班第一件事

```bash
# 1. 启动服务
scripts\start.bat

# 2. 健康检查
npm run health

# 3. 查看日志
# 查看启动窗口输出，确认无错误
```

**期望结果：**
- ✅ 所有服务启动成功
- ✅ 健康检查全部通过
- ✅ 无 ERROR 级别日志

---

## 📊 每周检查清单（Weekly Checklist）

### 性能检查

```bash
# 1. 检查服务响应时间
curl -w "@curl-format.txt" http://localhost:8081/api/status

# 2. 检查内存使用
# Windows
tasklist | findstr "node.exe"

# Unix/Linux/macOS
ps aux | grep node
```

**性能基准：**
- 响应时间 < 500ms
- 内存占用 < 500MB
- CPU 使用率 < 50%

### 日志检查

```bash
# 查看 Cpolar 日志
cat ~/.cpolar/logs/cpolar.log

# 检查异常请求
grep ERROR logs/*.log

# 查看流量统计
# 访问 http://localhost:4040
```

### 备份检查

```bash
# 运行备份脚本
bash scripts/backup.sh

# 验证备份文件
ls -lh backups/$(date +%Y%m%d)/
```

---

## 🔧 每月检查清单（Monthly Checklist）

### 依赖更新

```bash
# 1. 检查过期依赖
npm outdated

# 2. 更新非破坏性版本
npm update

# 3. 运行测试
npm test

# 4. 如果测试通过，提交更新
git add package.json package-lock.json
git commit -m "chore: 更新依赖"
```

### 配置审计

```bash
# 1. 检查 .env 配置
cat .env

# 2. 验证 Token 有效性
curl -H "Authorization: Bearer $OPENCLAW_TOKEN" \
     http://localhost:18789/api/status

# 3. 检查 Cpolar 域名
curl https://terryzin.cpolar.cn
```

### 安全检查

```bash
# 1. 检查依赖漏洞
npm audit

# 2. 修复可自动修复的漏洞
npm audit fix

# 3. 查看敏感文件权限
# 确保 .env 文件权限正确
ls -l .env
```

---

## 🚨 部署前检查清单（Pre-Deployment Checklist）

### 代码质量

```bash
□ 运行所有测试
  npm test

□ 检查代码规范
  npm run lint  # 如果配置了 ESLint

□ 审查代码变更
  git diff main

□ 更新 CHANGELOG.md
  # 记录本次部署的变更

□ 更新版本号
  npm version patch  # 或 minor/major
```

### 配置验证

```bash
□ 验证 .env 配置
  cat .env | grep -v "^#"

□ 验证 cpolar.yml
  cpolar config check

□ 验证端口可用
  netstat -ano | findstr "8081 8082"
```

### 备份数据

```bash
□ 备份当前配置
  cp .env .env.backup.$(date +%Y%m%d)

□ 备份数据文件
  cp data/projects.json data/projects.json.backup

□ 备份 OpenClaw 工作空间
  tar -czf openclaw-backup-$(date +%Y%m%d).tar.gz ~/.openclaw
```

---

## 🔄 部署后检查清单（Post-Deployment Checklist）

### 服务验证

```bash
□ 健康检查
  npm run health

□ 完整测试
  npm test

□ 手动烟雾测试
  # 访问 http://localhost:8081
  # 检查所有核心功能

□ 外网访问测试
  # 访问 https://terryzin.cpolar.cn
  # 验证 Cpolar 隧道正常
```

### 监控确认

```bash
□ 查看服务日志
  # 确认无错误日志

□ 查看 Cpolar 隧道状态
  # 访问 http://localhost:4040
  # 确认隧道 online

□ 查看性能指标
  # 响应时间、内存、CPU
```

---

## 🆘 故障应急清单（Incident Response Checklist）

### 立即执行

```bash
□ 收集错误信息
  # 截图、日志、错误消息

□ 确认影响范围
  # 哪些功能受影响？
  # 影响多少用户？

□ 快速诊断
  npm run health
  # 查看日志输出
```

### 紧急修复

```bash
□ 尝试重启服务
  # Ctrl+C 停止
  scripts\start.bat  # 重新启动

□ 如果重启无效，回滚
  git log --oneline  # 查看历史
  git checkout <上一个稳定版本>
  npm install
  npm run start:all

□ 验证修复
  npm run health
  npm test
```

### 事后总结

```bash
□ 记录故障报告
  # 原因、影响、解决方案
  # 保存到 docs/incidents/

□ 更新运维文档
  # 补充到故障排查清单

□ 改进监控
  # 添加告警规则，防止再次发生
```

---

## 📈 性能优化清单（Performance Optimization Checklist）

### 定期执行

```bash
□ 清理缓存
  # 删除过期缓存文件

□ 压缩日志文件
  gzip ~/.openclaw/logs/*.log

□ 清理 node_modules（如果空间不足）
  rm -rf node_modules
  npm install

□ 重启服务（释放内存）
  # 每周重启一次
```

### 性能调优

```bash
□ 调整缓存时长
  # 根据实际情况调整 CACHE_DURATION

□ 启用 HTTP/2（Cpolar Pro）
  # 修改 cpolar.yml 添加 http2: true

□ 配置 Gzip 压缩级别
  # 在 server/frontend-with-proxy.js 中调整
```

---

## 🔐 安全审计清单（Security Audit Checklist）

### 每月执行

```bash
□ 检查依赖漏洞
  npm audit

□ 修复已知漏洞
  npm audit fix

□ 更新 Token
  # 每 3 个月更换一次 ERGO_API_KEY

□ 审查访问日志
  # 查找异常 IP、异常请求

□ 验证 .gitignore
  # 确保敏感文件未提交
  git status
```

---

## 📦 备份和恢复清单（Backup & Recovery Checklist）

### 备份流程

```bash
□ 自动备份脚本
  # 配置 Cron Job 每天备份
  0 2 * * * /path/to/backup.sh

□ 验证备份完整性
  # 定期恢复测试

□ 异地备份
  # 上传到云存储（Dropbox/OneDrive/S3）
```

### 恢复流程

```bash
□ 停止服务
  # Ctrl+C 或 pkill node

□ 恢复配置
  cp backups/20260221/.env .env
  cp backups/20260221/cpolar.yml cpolar.yml

□ 恢复数据
  cp backups/20260221/projects.json data/projects.json
  tar -xzf backups/20260221/openclaw-workspace.tar.gz -C ~

□ 验证恢复
  npm run health
  npm test
```

---

## 📞 联系人清单（Contact List）

### 技术负责人
- **姓名**: Terry Zin
- **角色**: 项目负责人
- **联系方式**: [GitHub Issues](https://github.com/terryzin/Ergo/issues)

### 外部服务商
- **Cpolar 支持**: https://cpolar.com/support
- **OpenClaw 社区**: [Discord/Forum]

---

## 📝 日志模板

### 日常运维日志

```
日期: 2026-02-21
运维人: Terry Zin

检查项:
☑ 服务启动
☑ 健康检查
☑ 日志审查

异常情况:
无

处理措施:
无

备注:
系统运行正常
```

### 故障日志

```
日期: 2026-02-21
故障时间: 14:30 - 14:45
影响范围: 外网访问不可用

故障现象:
访问 https://terryzin.cpolar.cn 返回 502 错误

故障原因:
Cpolar 隧道断开

处理措施:
1. 重启 Cpolar: cpolar start-all
2. 验证恢复: curl https://terryzin.cpolar.cn

结果:
服务恢复正常

预防措施:
配置 Cpolar 自动重连
```

---

## 🔗 快速链接

- [部署指南](DEPLOYMENT_GUIDE.md)
- [故障排查](TROUBLESHOOTING.md)
- [架构说明](ARCHITECTURE.md)
- [快速开始](../../QUICK_START.md)

---

**Made with ❤️ by Ergo Team**

*Last updated: 2026-02-21*
