# Ergo v1.5 实时监控与自动化 - 功能规划

**规划日期**：2026-02-20
**预计工期**：10-14 小时（2-3 个工作日）
**状态**：📋 规划中

---

## 📋 概述

### 核心目标

将 Ergo 从"静态项目管理"升级为**实时监控与智能自动化中心**，让用户从"手动操作者"变为"监督者"。

### 用户需求（基于 Persona）

**陈磊的核心痛点**：
1. 需要频繁手动刷新才能看到最新状态
2. 发现问题后需要手动重启服务，浪费时间
3. 没有主动通知，错过重要事件（服务挂掉、任务失败）
4. 多个项目需要逐个点击查看，效率低

**v1.5 解决方案**：
1. ✅ 实时推送更新（WebSocket）
2. ✅ 一键快速操作（重启、执行任务）
3. ✅ 浏览器通知（异常提醒）
4. ✅ 项目聚合视图（多项目仪表盘）

---

## 🎯 功能设计

### 优先级划分

**P0（必须有）- 核心实时监控**
- WebSocket 实时连接
- 状态自动刷新
- 服务健康度实时更新
- 连接状态指示

**P1（应该有）- 快速操作**
- 一键重启服务
- 一键执行 Cron 任务
- 浏览器通知（异常提醒）
- 操作反馈 Toast

**P2（可以有）- 智能化初步**
- 多项目聚合仪表盘
- 项目状态趋势图表
- 自动重连策略
- 操作历史记录

---

## 🔧 详细功能设计

### 1. WebSocket 实时连接（P0）

#### 前端实现

**连接管理**：
```javascript
class RealtimeService {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 1秒
        this.listeners = new Map();
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('[WebSocket] Connected');
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            this.emit('connected');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.emit(data.type, data.payload);
        };

        this.ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
            this.emit('error', error);
        };

        this.ws.onclose = () => {
            console.log('[WebSocket] Disconnected');
            this.emit('disconnected');
            this.reconnect();
        };
    }

    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnect attempts reached');
            this.emit('reconnect-failed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => cb(data));
    }

    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
```

**使用示例**：
```javascript
const realtime = new RealtimeService('ws://localhost:8082');

realtime.on('connected', () => {
    updateConnectionStatus('online');
});

realtime.on('disconnected', () => {
    updateConnectionStatus('offline');
});

realtime.on('project-status-update', (data) => {
    updateProjectCard(data.projectId, data.status);
});

realtime.on('gateway-status-update', (data) => {
    updateGatewayStatus(data);
});

realtime.connect();
```

#### 后端实现

**WebSocket Server（server/api-bridge.js 扩展）**：
```javascript
const WebSocket = require('ws');

// 创建 WebSocket Server
const wss = new WebSocket.Server({ noServer: true });

// 升级 HTTP 连接为 WebSocket
const server = app.listen(PORT, () => {
    console.log('API Bridge Server started');
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// 连接管理
const clients = new Set();

wss.on('connection', (ws, req) => {
    console.log('[WebSocket] New client connected');
    clients.add(ws);

    // 发送欢迎消息
    ws.send(JSON.stringify({
        type: 'connected',
        payload: { message: 'Welcome to Ergo Realtime Service' }
    }));

    // 定期发送心跳
    const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat', payload: { time: Date.now() } }));
        }
    }, 30000); // 30秒

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        handleClientMessage(ws, data);
    });

    ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        clients.delete(ws);
        clearInterval(heartbeat);
    });
});

// 广播消息给所有客户端
function broadcast(type, payload) {
    const message = JSON.stringify({ type, payload });
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// 监听项目状态变化（文件监听）
const chokidar = require('chokidar');
const watcher = chokidar.watch('D:\\.openclaw\\workspace\\*/project-status.json', {
    persistent: true,
    ignoreInitial: true
});

watcher.on('change', async (path) => {
    console.log('[Watcher] Project status changed:', path);

    // 读取更新后的状态
    const statusData = await fs.readFile(path, 'utf-8');
    const status = JSON.parse(statusData);

    // 提取项目 ID
    const projectId = path.split('\\').reverse()[1];

    // 广播更新
    broadcast('project-status-update', {
        projectId,
        status,
        timestamp: Date.now()
    });
});

// 定期推送 Gateway 状态
setInterval(async () => {
    try {
        const gatewayStatus = await fetchOpenClawStatus();
        broadcast('gateway-status-update', gatewayStatus);
    } catch (error) {
        console.error('[Broadcast] Failed to fetch gateway status:', error.message);
    }
}, 10000); // 每 10 秒
```

---

### 2. 快速操作面板（P1）

#### 一键重启 Gateway

**前端按钮**：
```html
<button class="action-btn" onclick="restartGateway()">
    <svg><!-- 重启图标 --></svg>
    重启 Gateway
</button>
```

**API 调用**：
```javascript
async function restartGateway() {
    if (!confirm('确定要重启 Gateway 吗？\n\n重启期间服务将短暂不可用。')) {
        return;
    }

    const btn = event.target.closest('.action-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 重启中...';

    try {
        const res = await fetch(`${API_BASE}/api/gateway/restart`, {
            method: 'POST',
            headers: { 'X-Ergo-Key': getApiKey() }
        });

        if (!res.ok) throw new Error('重启失败');

        showToast('✅ Gateway 正在重启，请稍候...', 'success');

        // 30 秒后自动刷新状态
        setTimeout(() => {
            window.location.reload();
        }, 30000);
    } catch (error) {
        showToast('❌ 重启失败：' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<svg><!-- 重启图标 --></svg> 重启 Gateway';
    }
}
```

#### 一键触发 Cron 任务

**API 端点**：
```javascript
// server/api-bridge.js
app.post('/api/cron/:jobId/trigger', async (req, res) => {
    try {
        const { jobId } = req.params;

        // 执行 OpenClaw 命令
        const { stdout } = await execAsync(`openclaw cron trigger ${jobId}`, {
            timeout: 30000
        });

        res.json({
            success: true,
            message: `Cron job "${jobId}" triggered successfully`,
            output: stdout,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error triggering cron job:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

**前端调用**：
```javascript
async function triggerCronJob(jobId, jobName) {
    if (!confirm(`确定要立即执行任务"${jobName}"吗？`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/cron/${jobId}/trigger`, {
            method: 'POST',
            headers: { 'X-Ergo-Key': getApiKey() }
        });

        if (!res.ok) throw new Error('触发失败');

        showToast(`✅ 任务"${jobName}"已执行`, 'success');

        // 3 秒后刷新任务列表
        setTimeout(() => {
            loadCronJobs();
        }, 3000);
    } catch (error) {
        showToast('❌ 执行失败：' + error.message, 'error');
    }
}
```

---

### 3. 浏览器通知（P1）

#### 通知权限请求

**首次访问提示**：
```javascript
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('Browser does not support notifications');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

// 页面加载时提示
window.addEventListener('load', async () => {
    const hasPermission = await requestNotificationPermission();
    if (hasPermission) {
        console.log('Notification permission granted');
    }
});
```

#### 异常通知

**监听 WebSocket 事件**：
```javascript
realtime.on('project-status-update', (data) => {
    const { projectId, status } = data;

    // 检测健康度下降
    if (status.health?.overall === 'unhealthy') {
        sendNotification('⚠️ 项目异常', {
            body: `项目 "${status.basic.name}" 出现异常，请查看详情。`,
            icon: '/assets/logo.png',
            tag: `project-${projectId}`,
            requireInteraction: true,
            data: { projectId }
        });
    }

    // 检测服务停止
    const stoppedServices = status.health?.services?.filter(s => s.status !== 'running') || [];
    if (stoppedServices.length > 0) {
        sendNotification('🛑 服务停止', {
            body: `${stoppedServices.map(s => s.name).join(', ')} 已停止运行`,
            icon: '/assets/logo.png',
            tag: `services-${projectId}`
        });
    }
});

realtime.on('gateway-status-update', (data) => {
    if (data.gateway.status === 'offline') {
        sendNotification('❌ Gateway 离线', {
            body: 'OpenClaw Gateway 连接失败，请检查服务状态',
            icon: '/assets/logo.png',
            tag: 'gateway-offline',
            requireInteraction: true
        });
    }
});

function sendNotification(title, options) {
    if (Notification.permission === 'granted') {
        const notification = new Notification(title, options);

        notification.onclick = () => {
            window.focus();
            if (options.data?.projectId) {
                window.location.href = `docs/archive/project.html?id=${options.data.projectId}`;
            }
            notification.close();
        };
    }
}
```

---

### 4. 多项目仪表盘（P2）

#### 聚合视图

**新建页面：`dashboard.html`**

**布局设计**：
```
┌─────────────────────────────────────────────┐
│  📊 项目概览                     [刷新] [⚙️]│
├─────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐          │
│  │ Ergo        │  │ Cargo       │          │
│  │ ✅ 健康      │  │ ⚠️ 降级      │          │
│  │ 3/3 服务    │  │ 1/2 服务    │          │
│  │ 34/34 测试  │  │ 12/15 测试  │          │
│  └─────────────┘  └─────────────┘          │
│  ┌─────────────┐  ┌─────────────┐          │
│  │ PingCode    │  │ Best Prac.  │          │
│  │ ❌ 异常      │  │ ✅ 健康      │          │
│  │ 0/1 服务    │  │ 1/1 服务    │          │
│  │ - 测试      │  │ - 测试      │          │
│  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────┘
```

**实现**：
```javascript
async function loadDashboard() {
    const res = await fetch(`${API_BASE}/api/projects`, {
        headers: { 'X-Ergo-Key': getApiKey() }
    });
    const data = await res.json();

    const container = document.getElementById('dashboardGrid');

    container.innerHTML = data.projects.map(project => {
        const health = project.health;
        const healthIcons = {
            'healthy': '✅',
            'degraded': '⚠️',
            'unhealthy': '❌'
        };
        const healthColors = {
            'healthy': 'var(--ok)',
            'degraded': 'var(--warn)',
            'unhealthy': 'var(--err)'
        };

        const healthIcon = health ? healthIcons[health.overall] : '❓';
        const healthColor = health ? healthColors[health.overall] : 'var(--text-3)';

        return `
            <div class="dashboard-card" onclick="window.location.href='docs/archive/project.html?id=${project.id}'">
                <div class="card-header">
                    <h3>${project.name}</h3>
                    <span class="health-badge" style="color:${healthColor}">
                        ${healthIcon} ${health?.overall || 'unknown'}
                    </span>
                </div>
                <div class="card-metrics">
                    <div class="metric">
                        <span class="metric-label">服务</span>
                        <span class="metric-value">${health?.servicesRunning || 0}/${health?.servicesTotal || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">测试</span>
                        <span class="metric-value">${project.tests?.passed || '-'}/${project.tests?.total || '-'}</span>
                    </div>
                </div>
                <div class="card-footer">
                    <span class="version">v${project.version}</span>
                    <span class="status">${project.status === 'active' ? '已上线' : '开发中'}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 实时更新
realtime.on('project-status-update', (data) => {
    updateDashboardCard(data.projectId, data.status);
});
```

---

## 📂 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/realtime.js` | WebSocket 客户端封装 |
| `src/notifications.js` | 浏览器通知管理 |
| `dashboard.html` | 多项目仪表盘 |
| `docs/versions/v1.5/feature-plan.md` | 本文件 |
| `docs/versions/v1.5/README.md` | 使用指南 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `server/api-bridge.js` | +200 行，WebSocket Server + Cron 触发 API |
| `index.html` | 集成实时连接 + 快速操作按钮 |
| `package.json` | 添加依赖：`ws`, `chokidar` |
| `tests/smoke-test.js` | +50 行，WebSocket 和快速操作测试 |

---

## 🔧 实施步骤

### Phase 1: WebSocket 实时连接（3-4 小时）

**任务清单**：
1. [ ] 安装依赖（`npm install ws chokidar`）
2. [ ] 在 `server/api-bridge.js` 中集成 WebSocket Server
3. [ ] 实现客户端 `src/realtime.js`
4. [ ] 在 `index.html` 中集成实时连接
5. [ ] 添加连接状态指示器
6. [ ] 测试断线重连

### Phase 2: 快速操作功能（2-3 小时）

**任务清单**：
1. [ ] 实现 `POST /api/cron/:jobId/trigger`
2. [ ] 在 Cron 列表添加"触发"按钮
3. [ ] 实现 Gateway 重启前端逻辑
4. [ ] 添加操作确认对话框
5. [ ] 测试所有快速操作

### Phase 3: 浏览器通知（2-3 小时）

**任务清单**：
1. [ ] 实现 `src/notifications.js`
2. [ ] 添加通知权限请求 UI
3. [ ] 监听异常事件并发送通知
4. [ ] 实现通知点击跳转
5. [ ] 测试各种异常场景

### Phase 4: 多项目仪表盘（3-4 小时）

**任务清单**：
1. [ ] 创建 `dashboard.html`
2. [ ] 实现聚合视图布局
3. [ ] 添加实时更新逻辑
4. [ ] 添加筛选和排序功能
5. [ ] 测试大量项目场景

---

## ✅ 验证方案

### 功能验证

**WebSocket 实时连接**：
- [ ] 打开页面，WebSocket 自动连接
- [ ] 修改 `project-status.json`，页面立即更新（无需刷新）
- [ ] 断开网络，显示"离线"状态
- [ ] 恢复网络，自动重连成功

**快速操作**：
- [ ] 点击"重启 Gateway"，确认对话框正常
- [ ] Gateway 成功重启，页面显示重启中状态
- [ ] 点击"触发任务"，Cron 任务立即执行
- [ ] 操作结果通过 Toast 提示

**浏览器通知**：
- [ ] 首次访问提示授权通知权限
- [ ] 服务停止时收到通知
- [ ] 项目健康度下降时收到通知
- [ ] 点击通知跳转到对应项目详情

**仪表盘**：
- [ ] 显示所有项目的健康状态
- [ ] 实时更新项目卡片
- [ ] 点击卡片跳转到详情页

### 性能验证

- [ ] WebSocket 心跳正常（30 秒一次）
- [ ] 文件监听无明显延迟（< 1 秒）
- [ ] 大量通知不卡顿浏览器
- [ ] 仪表盘渲染 < 500ms（10 个项目）

---

## 🚨 技术难点与风险

### 难点 1: WebSocket 稳定性

**问题**：
- 网络不稳定时频繁断连
- 重连风暴（多个客户端同时重连）
- 服务器重启导致所有连接丢失

**解决方案**：
- 指数退避重连策略
- 客户端随机延迟（避免同时重连）
- 心跳机制保持连接活跃
- 服务器端优雅关闭（提前通知客户端）

### 难点 2: 文件监听性能

**问题**：
- 监听大量文件消耗资源
- 文件频繁变更导致事件风暴
- Windows 文件系统事件不准确

**解决方案**：
- 使用 `chokidar` 库（跨平台兼容）
- 防抖处理（500ms 内同一文件只触发一次）
- 仅监听 `project-status.json` 文件

### 难点 3: 浏览器通知权限

**问题**：
- 用户可能拒绝通知权限
- 部分浏览器不支持通知
- 通知过多导致用户烦躁

**解决方案**：
- 优雅降级（无通知权限也能正常使用）
- 智能去重（同类通知 5 分钟内只发一次）
- 提供通知开关（用户可关闭）

---

## 📚 参考资料

- [WebSocket API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Notification API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification)
- [chokidar - File Watcher](https://github.com/paulmillr/chokidar)
- [ws - WebSocket Library](https://github.com/websockets/ws)

---

## 📅 里程碑

| 阶段 | 预计时间 | 交付物 |
|------|---------|-------|
| Phase 1 | 3-4h | WebSocket 实时连接 |
| Phase 2 | 2-3h | 快速操作功能 |
| Phase 3 | 2-3h | 浏览器通知 |
| Phase 4 | 3-4h | 多项目仪表盘 |
| **总计** | **10-14h** | **v1.5 完整功能** |

---

**规划状态**：✅ 完成
**下一步**：等待用户确认后开始实施 Phase 1
