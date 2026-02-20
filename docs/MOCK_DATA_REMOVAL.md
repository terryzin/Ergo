# Mock 数据移除说明

## 概述

v1.3.0 之后的版本已完全移除 Mock 数据，生产环境仅使用真实 API 数据。

## 修改内容

### 1. fetchAllData() 错误处理

**之前（使用 Mock 数据）：**
```javascript
} catch (error) {
    console.warn('Gateway API 不可达，使用 Mock 数据:', error.message);

    return {
        gateway: { status: 'mock', version: '2026.2.9', uptime: 1296000 },
        agents: [
            { name: 'main', status: 'online', model: 'MiniMax-M2.5' },
            { name: 'researcher', status: 'online', model: 'GPT-4' },
            { name: 'coder', status: 'online', model: 'Claude-3' }
        ],
        cronJobs: [
            { id: 'bp-collect', name: '最佳实践收集', ... },
            { id: 'health-check', name: 'Gateway健康检查', ... }
        ]
    };
}
```

**现在（明确错误状态）：**
```javascript
} catch (error) {
    console.error('Gateway API 不可达:', error.message);

    return {
        gateway: {
            status: 'offline',
            version: '--',
            uptime: 0,
            _source: 'error',
            _error: error.message
        },
        agents: [],
        cronJobs: [],
        services: [],
        _meta: { error: true, message: error.message }
    };
}
```

### 2. 网络状态显示

**之前：**
- "实时" / "缓存" / "Mock" / "Mock 数据"

**现在：**
- "实时" / "缓存" / "连接失败"

### 3. Gateway 在线判断

**之前：**
```javascript
const isOnline = gateway && (
    gateway.status === 'online' ||
    gateway._source === 'mock' ||
    gateway.status === 'mock'
);
```

**现在：**
```javascript
const isOnline = gateway &&
    gateway.status === 'online' &&
    gateway._source === 'api';
```

### 4. Gateway 重启功能

**之前：**
```javascript
function restartGateway() {
    showToast('Mock 模式：Gateway 重启指令已发送');
    // 模拟 2 秒延迟...
}
```

**现在：**
```javascript
async function restartGateway() {
    showToast('正在重启 Gateway...');

    const response = await fetch('/api/gateway/restart', {
        method: 'POST',
        headers: { 'X-Ergo-Key': getApiKey() }
    });

    if (response.ok) {
        showToast('Gateway 重启成功');
        setTimeout(() => loadData(true), 5000);
    }
}
```

## 用户体验变化

### API 正常连接时

| 指标 | 显示内容 |
|------|----------|
| Gateway 状态 | 运行中（绿色） |
| 网络状态 | 实时 / 缓存（绿色） |
| Agents | 显示真实 Agent 列表 |
| Cron 任务 | 显示真实任务列表 |

### API 连接失败时

| 指标 | 显示内容 |
|------|----------|
| Gateway 状态 | 离线（红色） |
| 网络状态 | 连接失败（红色） |
| Agents | 无法加载 / -- |
| Cron 任务 | 无法加载 / -- |

**不再显示：**
- ❌ Mock 数据标签
- ❌ 假的 Agent 列表（main, researcher, coder）
- ❌ 假的 Cron 任务（最佳实践收集等）

## 原则

### 为什么移除 Mock 数据？

1. **避免误导用户**
   - Mock 数据让用户以为服务正常，实际 API 已失败
   - 用户无法区分真实数据和假数据

2. **生产环境最佳实践**
   - Mock 数据仅用于开发和测试阶段
   - 生产环境应明确告知用户真实状态

3. **错误诊断**
   - 明确的错误状态有助于快速定位问题
   - "连接失败"比"Mock 数据"更清晰

### Mock 数据的正确使用场景

✅ **适合使用 Mock：**
- 开发阶段（API 尚未实现）
- 单元测试
- UI 组件测试
- 演示和原型

❌ **不适合使用 Mock：**
- 生产环境
- 集成测试
- 用户实际使用
- 状态监控

## 开发建议

如果需要在开发时使用 Mock 数据，建议：

1. **使用环境变量控制**
```javascript
const USE_MOCK = process.env.NODE_ENV === 'development';

if (!response.ok && USE_MOCK) {
    return mockData;
}
```

2. **创建独立的 Mock 文件**
```javascript
// mock/gateway-data.js
export const mockGatewayData = { ... };
```

3. **使用开发工具（MSW, json-server）**
```bash
# 启动 Mock API 服务器
json-server --watch mock/data.json --port 8082
```

## 测试

### 正常场景测试
```bash
# 访问前端，应显示真实数据
curl https://terryzin.cpolar.top
```

### 失败场景测试
```bash
# 停止 API Bridge
taskkill /F /IM node.exe

# 访问前端，应显示"连接失败"
curl https://terryzin.cpolar.top
```

## 兼容性

- ✅ 前端代码完全兼容
- ✅ 不影响现有功能
- ✅ 错误处理更完善
- ⚠️  需要确保 API Bridge 正常运行

## 回滚方案

如果需要临时恢复 Mock 数据（仅开发用途），可以：

1. 查看 Git 历史：
```bash
git log --oneline --grep="Mock"
```

2. 查看具体修改：
```bash
git show 9128fde
```

3. Cherry-pick 特定修改：
```bash
git revert 9128fde
```

---

**日期**: 2026-02-20
**版本**: v1.3.0+
**作者**: Claude (Ergo Team)
