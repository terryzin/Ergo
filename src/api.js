/**
 * Ergo API Module
 * Gateway API 封装
 *
 * v1.2 更新:
 * - 环境检测：生产环境自动禁用 Mock
 * - 网络状态检测
 * - 请求超时处理
 * - 重连机制
 */

// 配置
const CONFIG = {
    // 生产环境使用 cpolar URL，本地开发使用 localhost
    API_BASE: (window && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') 
        ? 'https://ergo-gateway.cpolar.top' 
        : 'http://localhost:18789',
    TIMEOUT: 5000,           // 请求超时 (ms)
    RETRY_COUNT: 3,         // 重试次数
    RETRY_DELAY: 1000,       // 重试间隔 (ms)
    MOCK_FALLBACK: true      // API 失败时回退到 Mock
};

// 环境检测
const ENV = {
    // 获取 hostname 的安全方式
    getHostname: function() {
        try {
            return window.location.hostname;
        } catch (e) {
            // jsdom 或测试环境中可能无法访问
            return 'localhost';
        }
    },

    // 判断是否为生产环境
    get isProduction() {
        const hostname = this.getHostname();
        return hostname !== 'localhost' && hostname !== '127.0.0.1';
    },

    // 判断是否为开发环境
    get isDevelopment() {
        return !this.isProduction;
    },

    // 判断是否为测试环境
    get isTest() {
        // Jest 测试环境
        return typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    }
};

// Mock 模式：根据环境自动决定
function isMockMode() {
    // 测试环境始终使用 Mock
    if (ENV.isTest) {
        return true;
    }
    if (ENV.isProduction) {
        return false;  // 生产环境禁用 Mock
    }
    // 开发环境：优先尝试真实 API，失败时回退
    return !CONFIG.MOCK_FALLBACK;
}

// 延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 请求封装，带重试
async function request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    try {
        const resp = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        return await resp.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// 状态存储
const apiState = {
    isOnline: true,
    lastError: null,
    retryCount: 0
};

/**
 * 检测网络状态
 * @returns {Promise<boolean>}
 */
async function checkNetworkStatus() {
    try {
        const resp = await fetch(`${CONFIG.API_BASE}/api/status`, {
            method: 'HEAD',
            cache: 'no-store'
        });
        apiState.isOnline = resp.ok;
        apiState.lastError = null;
        apiState.retryCount = 0;
        return resp.ok;
    } catch (error) {
        apiState.isOnline = false;
        apiState.lastError = error.message;
        return false;
    }
}

/**
 * 获取网络状态
 * @returns {Object}
 */
function getNetworkState() {
    return {
        isOnline: apiState.isOnline,
        lastError: apiState.lastError,
        retryCount: apiState.retryCount
    };
}

/**
 * Fetch Gateway status
 * @returns {Promise<Object>} Gateway status data
 */
async function fetchGatewayStatus() {
    // Mock 模式
    if (isMockMode()) {
        return {
            status: 'online',
            uptime: 259200,
            version: '0.9.5',
            port: 18789,
            _source: 'mock'
        };
    }

    // 尝试真实 API，失败时回退
    for (let i = 0; i < CONFIG.RETRY_COUNT; i++) {
        try {
            const data = await request('/api/status');
            apiState.retryCount = 0;
            return { ...data, _source: 'api' };
        } catch (error) {
            apiState.lastError = error.message;
            apiState.retryCount = i + 1;

            if (i < CONFIG.RETRY_COUNT - 1) {
                await delay(CONFIG.RETRY_DELAY);
            }
        }
    }

    // 回退到 Mock
    if (CONFIG.MOCK_FALLBACK) {
        console.warn('[API] Gateway API unavailable, falling back to mock data');
        return {
            status: 'offline',
            uptime: 0,
            version: 'unknown',
            port: 18789,
            _source: 'mock-fallback'
        };
    }

    throw new Error('Gateway API unavailable');
}

/**
 * Fetch agents list
 * @returns {Promise<Array>} List of agents
 */
async function fetchAgents() {
    if (isMockMode()) {
        return [
            { name: 'Research Agent', status: 'online', type: 'research', lastActive: '2分钟前' },
            { name: 'Coder Agent', status: 'online', type: 'coder', lastActive: '5分钟前' },
            { name: 'Writer Agent', status: 'offline', type: 'writer', lastActive: '2小时前' }
        ];
    }

    for (let i = 0; i < CONFIG.RETRY_COUNT; i++) {
        try {
            const data = await request('/api/agents');
            return { ...data, _source: 'api' };
        } catch (error) {
            if (i < CONFIG.RETRY_COUNT - 1) {
                await delay(CONFIG.RETRY_DELAY);
            }
        }
    }

    if (CONFIG.MOCK_FALLBACK) {
        return [];
    }

    throw new Error('Agents API unavailable');
}

/**
 * Fetch cron jobs list
 * @returns {Promise<Array>} List of cron jobs
 */
async function fetchCronJobs() {
    if (isMockMode()) {
        return [
            { name: '最佳实践收集', schedule: '每4小时', lastStatus: 'success', lastRun: '3小时前' },
            { name: '健康检查', schedule: '每15分钟', lastStatus: 'success', lastRun: '5分钟前' },
            { name: '日志清理', schedule: '每天0点', lastStatus: 'success', lastRun: '昨天' },
            { name: '系统备份', schedule: '每周日', lastStatus: 'failed', lastRun: '3天前', error: '磁盘空间不足' }
        ];
    }

    for (let i = 0; i < CONFIG.RETRY_COUNT; i++) {
        try {
            const data = await request('/api/cron');
            return { ...data, _source: 'api' };
        } catch (error) {
            if (i < CONFIG.RETRY_COUNT - 1) {
                await delay(CONFIG.RETRY_DELAY);
            }
        }
    }

    if (CONFIG.MOCK_FALLBACK) {
        return [];
    }

    throw new Error('Cron API unavailable');
}

/**
 * Fetch dev services list
 * @returns {Promise<Array>} List of dev services
 */
async function fetchDevServices() {
    if (isMockMode()) {
        return [
            { name: 'my-dashboard', port: 3000, status: 'running', url: 'http://localhost:3000', started: '2小时前' },
            { name: 'api-server', port: 8080, status: 'running', url: 'http://localhost:8080', started: '30分钟前' }
        ];
    }

    for (let i = 0; i < CONFIG.RETRY_COUNT; i++) {
        try {
            const data = await request('/api/services');
            return { ...data, _source: 'api' };
        } catch (error) {
            if (i < CONFIG.RETRY_COUNT - 1) {
                await delay(CONFIG.RETRY_DELAY);
            }
        }
    }

    if (CONFIG.MOCK_FALLBACK) {
        return [];
    }

    throw new Error('Services API unavailable');
}

/**
 * Restart Gateway
 * @returns {Promise<boolean>} Success status
 */
async function restartGateway() {
    if (isMockMode()) {
        return true;
    }

    for (let i = 0; i < CONFIG.RETRY_COUNT; i++) {
        try {
            const resp = await fetch(`${CONFIG.API_BASE}/api/restart`, {
                method: 'POST'
            });
            return resp.ok;
        } catch (error) {
            if (i < CONFIG.RETRY_COUNT - 1) {
                await delay(CONFIG.RETRY_DELAY);
            }
        }
    }

    return false;
}

/**
 * 批量获取所有数据
 * @returns {Promise<Object>}
 */
async function fetchAllData() {
    const [gateway, agents, cronJobs, services] = await Promise.all([
        fetchGatewayStatus(),
        fetchAgents(),
        fetchCronJobs(),
        fetchDevServices()
    ]);

    return { gateway, agents, cronJobs, services };
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        ENV,
        isMockMode,
        checkNetworkStatus,
        getNetworkState,
        fetchGatewayStatus,
        fetchAgents,
        fetchCronJobs,
        fetchDevServices,
        restartGateway,
        fetchAllData,
        delay,
        request
    };
}
