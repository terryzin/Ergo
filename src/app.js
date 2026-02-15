/**
 * Ergo Application Module
 * 主应用逻辑
 */

// ============================
// MOCK DATA (for development)
// ============================
const mockData = {
    gateway: {
        status: 'online',
        uptime: 259200,
        version: '0.9.5',
        port: 18789
    },
    agents: [
        { name: 'Research Agent', status: 'online', type: 'research', lastActive: '2分钟前' },
        { name: 'Coder Agent', status: 'online', type: 'coder', lastActive: '5分钟前' },
        { name: 'Writer Agent', status: 'offline', type: 'writer', lastActive: '2小时前' }
    ],
    cronJobs: [
        { name: '最佳实践收集', schedule: '每4小时', lastStatus: 'success', lastRun: '3小时前' },
        { name: '健康检查', schedule: '每15分钟', lastStatus: 'success', lastRun: '5分钟前' },
        { name: '日志清理', schedule: '每天0点', lastStatus: 'success', lastRun: '昨天' },
        { name: '系统备份', schedule: '每周日', lastStatus: 'failed', lastRun: '3天前', error: '磁盘空间不足' }
    ],
    devServices: [
        { name: 'my-dashboard', port: 3000, status: 'running', url: 'http://localhost:3000', started: '2小时前' },
        { name: 'api-server', port: 8080, status: 'running', url: 'http://localhost:8080', started: '30分钟前' }
    ]
};

// ============================
// STATE
// ============================
let currentPanel = null;

// ============================
// UI HELPERS
// ============================
/**
 * Format uptime seconds to human readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}天${hours}时`;
    if (hours > 0) return `${hours}时${mins}分`;
    return `${mins}分钟`;
}

/**
 * Toggle panel open/close state
 * @param {string} name - Panel name
 */
function togglePanel(name) {
    const panel = document.getElementById(`${name}Panel`);
    const isOpen = panel && panel.classList.contains('open');

    // Close current
    if (currentPanel && currentPanel !== panel) {
        currentPanel.classList.remove('open');
    }

    // Toggle
    if (!isOpen && panel) {
        panel.classList.add('open');
        currentPanel = panel;
    } else if (panel) {
        panel.classList.remove('open');
        currentPanel = null;
    }
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================
// THEME
// ============================
function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);

    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === saved);
        btn.onclick = () => setTheme(btn.dataset.value);
    });
}

function setTheme(theme) {
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
}

// ============================
// RENDER FUNCTIONS
// ============================
function renderAgentsList(agents) {
    const container = document.getElementById('agentsList');
    if (!container) return;

    container.innerHTML = agents.map(agent => `
        <div class="info-row">
            <span class="info-label">${agent.name}</span>
            <span class="info-value" style="color: ${agent.status === 'online' ? 'var(--ok)' : 'var(--text-3)'}">
                ${agent.status === 'online' ? '在线' : '离线'}
            </span>
        </div>
    `).join('');
}

function renderCronList(jobs) {
    const container = document.getElementById('cronList');
    if (!container) return;

    container.innerHTML = jobs.map(job => `
        <div class="info-row">
            <span class="info-label">${job.name}</span>
            <span class="info-value" style="color: ${job.lastStatus === 'success' ? 'var(--ok)' : 'var(--err)'}">
                ${job.lastStatus === 'success' ? '成功' : '失败'}
            </span>
        </div>
    `).join('');
}

function renderDevServices(services) {
    const container = document.getElementById('devServicesList');
    if (!container) return;

    if (services.length === 0) {
        container.innerHTML = `
            <div class="list-row">
                <div class="list-icon purple">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <div class="list-content">
                    <div class="list-title">暂无运行中的服务</div>
                    <div class="list-desc">开发服务启动后将自动显示</div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = services.map(svc => `
        <div class="list-row" onclick="openUrl('${svc.url}')">
            <div class="list-icon green">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                </svg>
            </div>
            <div class="list-content">
                <div class="list-title">${svc.name} <span style="color:var(--text-3)">:${svc.port}</span></div>
                <div class="list-desc">${svc.status} · 启动于 ${svc.started}</div>
            </div>
            <span class="list-arrow">></span>
        </div>
    `).join('');
}

function renderMockData() {
    const data = mockData;

    // Gateway
    const uptime = formatUptime(data.gateway.uptime);
    const gatewayUptimeEl = document.getElementById('gatewayUptime');
    const gatewayStatusEl = document.getElementById('gatewayStatus');
    const panelGatewayStatusEl = document.getElementById('panelGatewayStatus');
    const panelGatewayUptimeEl = document.getElementById('panelGatewayUptime');
    const panelGatewayVersionEl = document.getElementById('panelGatewayVersion');

    if (gatewayUptimeEl) gatewayUptimeEl.textContent = uptime;
    if (gatewayStatusEl) {
        gatewayStatusEl.innerHTML = '<span class="status-dot"></span><span>运行中</span>';
        gatewayStatusEl.className = 'status-pill ok';
    }
    if (panelGatewayStatusEl) {
        panelGatewayStatusEl.textContent = '运行中';
        panelGatewayStatusEl.style.color = 'var(--ok)';
    }
    if (panelGatewayUptimeEl) panelGatewayUptimeEl.textContent = uptime;
    if (panelGatewayVersionEl) panelGatewayVersionEl.textContent = data.gateway.version;

    // Agents
    const agentsCountEl = document.getElementById('agentsCount');
    const agentsSubEl = document.getElementById('agentsSub');
    const agentsDescEl = document.getElementById('agentsDesc');
    const onlineAgents = data.agents.filter(a => a.status === 'online').length;

    if (agentsCountEl) agentsCountEl.textContent = `${onlineAgents}/${data.agents.length}`;
    if (agentsSubEl) agentsSubEl.textContent = '在线';
    if (agentsDescEl) agentsDescEl.textContent = `${data.agents.length} 个 Agent`;

    // Cron
    const cronCountEl = document.getElementById('cronCount');
    const cronSubEl = document.getElementById('cronSub');
    const cronDescEl = document.getElementById('cronDesc');
    const successJobs = data.cronJobs.filter(j => j.lastStatus === 'success').length;

    if (cronCountEl) cronCountEl.textContent = `${successJobs}/${data.cronJobs.length}`;
    if (cronSubEl) cronSubEl.textContent = '成功';
    if (cronDescEl) cronDescEl.textContent = `${data.cronJobs.length} 个任务 · 最近 ${successJobs} 个成功`;

    // Network
    const networkStatusEl = document.getElementById('networkStatus');
    const networkPillEl = document.getElementById('networkPill');
    if (networkStatusEl) networkStatusEl.textContent = '正常';
    if (networkPillEl) {
        networkPillEl.innerHTML = '<span class="status-dot"></span><span>已连接</span>';
    }

    // Render lists
    renderAgentsList(data.agents);
    renderCronList(data.cronJobs);
    renderDevServices(data.devServices);
}

function renderError() {
    const gatewayStatusEl = document.getElementById('gatewayStatus');
    const gatewayUptimeEl = document.getElementById('gatewayUptime');

    if (gatewayStatusEl) {
        gatewayStatusEl.innerHTML = '<span>离线</span>';
        gatewayStatusEl.className = 'status-pill err';
    }
    if (gatewayUptimeEl) gatewayUptimeEl.textContent = '--';
    showToast('无法连接到 Gateway');
}

// ============================
// ACTIONS
// ============================
function openDashboard() {
    if (MOCK_MODE) {
        showToast('Mock 模式：将在新窗口打开 Dashboard');
        return;
    }
    window.open(`${API_BASE}/openclaw`, '_blank');
}

function openUrl(url) {
    window.open(url, '_blank');
}

function showRestartConfirm() {
    const overlay = document.getElementById('sheetOverlay');
    const sheetTitle = document.getElementById('sheetTitle');
    const sheetActions = document.getElementById('sheetActions');

    if (overlay && sheetTitle && sheetActions) {
        sheetTitle.textContent = '重启 Gateway';
        sheetActions.innerHTML = `
            <button class="sheet-action danger" onclick="restartGateway()">确认重启</button>
        `;
        overlay.classList.add('active');
    }
}

function closeSheet() {
    const overlay = document.getElementById('sheetOverlay');
    if (overlay) overlay.classList.remove('active');
}

function restartGateway() {
    closeSheet();
    showToast('Mock 模式：Gateway 重启指令已发送');

    const gatewayStatusEl = document.getElementById('gatewayStatus');
    if (gatewayStatusEl) {
        gatewayStatusEl.innerHTML = '<span>重启中...</span>';
        gatewayStatusEl.className = 'status-pill warn';
    }

    setTimeout(() => {
        if (gatewayStatusEl) {
            gatewayStatusEl.innerHTML = '<span class="status-dot"></span><span>运行中</span>';
            gatewayStatusEl.className = 'status-pill ok';
        }
        showToast('Gateway 重启成功');
    }, 2000);
}

// ============================
// INIT
// ============================
function loadData() {
    if (MOCK_MODE) {
        renderMockData();
        return;
    }

    // Real API mode
    Promise.all([
        fetchGatewayStatus(),
        fetchAgents(),
        fetchCronJobs(),
        fetchDevServices()
    ]).then(([gateway, agents, cronJobs, services]) => {
        // Render real data
        renderRealData({ gateway, agents, cronJobs, services });
    }).catch(() => {
        renderError();
    });
}

function renderRealData(data) {
    // TODO: Implement when real API is available
    console.log('Real data received:', data);
}

function init() {
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            initTheme();
            loadData();
        });
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatUptime,
        togglePanel,
        showToast,
        initTheme,
        setTheme,
        renderAgentsList,
        renderCronList,
        renderDevServices,
        renderMockData,
        renderError,
        openDashboard,
        openUrl,
        showRestartConfirm,
        closeSheet,
        restartGateway,
        loadData,
        init,
        mockData
    };
}
