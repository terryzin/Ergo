/**
 * Ergo API Module
 * Gateway API 封装
 */

const MOCK_MODE = true; // Set to false when real API is available
const API_BASE = 'http://localhost:18789';

/**
 * Fetch Gateway status
 * @returns {Promise<Object>} Gateway status data
 */
async function fetchGatewayStatus() {
    if (MOCK_MODE) {
        return {
            status: 'online',
            uptime: 259200,
            version: '0.9.5',
            port: 18789
        };
    }

    const resp = await fetch(`${API_BASE}/api/status`);
    if (!resp.ok) {
        throw new Error(`API Error: ${resp.status}`);
    }
    return resp.json();
}

/**
 * Fetch agents list
 * @returns {Promise<Array>} List of agents
 */
async function fetchAgents() {
    if (MOCK_MODE) {
        return [
            { name: 'Research Agent', status: 'online', type: 'research', lastActive: '2分钟前' },
            { name: 'Coder Agent', status: 'online', type: 'coder', lastActive: '5分钟前' },
            { name: 'Writer Agent', status: 'offline', type: 'writer', lastActive: '2小时前' }
        ];
    }

    const resp = await fetch(`${API_BASE}/api/agents`);
    if (!resp.ok) {
        throw new Error(`API Error: ${resp.status}`);
    }
    return resp.json();
}

/**
 * Fetch cron jobs list
 * @returns {Promise<Array>} List of cron jobs
 */
async function fetchCronJobs() {
    if (MOCK_MODE) {
        return [
            { name: '最佳实践收集', schedule: '每4小时', lastStatus: 'success', lastRun: '3小时前' },
            { name: '健康检查', schedule: '每15分钟', lastStatus: 'success', lastRun: '5分钟前' },
            { name: '日志清理', schedule: '每天0点', lastStatus: 'success', lastRun: '昨天' },
            { name: '系统备份', schedule: '每周日', lastStatus: 'failed', lastRun: '3天前', error: '磁盘空间不足' }
        ];
    }

    const resp = await fetch(`${API_BASE}/api/cron`);
    if (!resp.ok) {
        throw new Error(`API Error: ${resp.status}`);
    }
    return resp.json();
}

/**
 * Fetch dev services list
 * @returns {Promise<Array>} List of dev services
 */
async function fetchDevServices() {
    if (MOCK_MODE) {
        return [
            { name: 'my-dashboard', port: 3000, status: 'running', url: 'http://localhost:3000', started: '2小时前' },
            { name: 'api-server', port: 8080, status: 'running', url: 'http://localhost:8080', started: '30分钟前' }
        ];
    }

    const resp = await fetch(`${API_BASE}/api/services`);
    if (!resp.ok) {
        throw new Error(`API Error: ${resp.status}`);
    }
    return resp.json();
}

/**
 * Restart Gateway
 * @returns {Promise<boolean>} Success status
 */
async function restartGateway() {
    if (MOCK_MODE) {
        return true;
    }

    const resp = await fetch(`${API_BASE}/api/restart`, { method: 'POST' });
    return resp.ok;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchGatewayStatus,
        fetchAgents,
        fetchCronJobs,
        fetchDevServices,
        restartGateway,
        MOCK_MODE,
        API_BASE
    };
}
