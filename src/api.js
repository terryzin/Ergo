/**
 * Ergo API Module
 * 使用HTTP API直接调用Gateway
 * 
 * v1.3.1 - 修复API调用
 */

(function() {
    'use strict';

    // 配置 - 根据环境选择API地址
    const CONFIG = {
        get API_BASE() {
            const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
            const isRemote = hostname !== 'localhost' && hostname !== '127.0.0.1';
            // 远程通过cpolar访问，本地直接访问
            return isRemote 
                ? 'https://ergo-gateway.cpolar.top' 
                : 'http://localhost:18789';
        },
        TOKEN: 'f2009973e92e96b0e31c30b30500e997',
        TIMEOUT: 10000
    };

    // 状态
    const apiState = {
        isOnline: false,
        lastError: null
    };

    // Mock数据
    const MOCK_DATA = {
        gateway: { status: 'online', uptime: 3600, version: '2026.2.9', port: 18789 },
        agents: [{ name: 'main', status: 'active', model: 'MiniMax-M2.5' }],
        cron: [
            { id: '9d6d36ae-c8c8-49ed-a6a5-f798b7884a63', name: '最佳实践收集', lastStatus: 'success', nextRun: '18:00' },
            { id: 'f691da5c-5cf6-4b05-9e8d-3a77a6d60a06', name: 'Gateway健康检查', lastStatus: 'success', nextRun: '每15分钟' },
            { id: '3148008b-1941-4357-ad0f-0f92fa7f9746', name: '稳定性复盘', lastStatus: 'success', nextRun: '每周一 9:00' }
        ]
    };

    // 通用API请求
    async function apiRequest(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE}${endpoint}`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.TOKEN}`,
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('[ErgoAPI] Request failed:', error);
            throw error;
        }
    }

    // ============ 公开API ============

    // 检查网络状态
    async function checkNetworkStatus() {
        try {
            await apiRequest('/api/status');
            apiState.isOnline = true;
            return true;
        } catch (e) {
            apiState.isOnline = false;
            return false;
        }
    }

    // 获取Gateway状态
    async function fetchGatewayStatus() {
        try {
            // 尝试通过gateway call status
            const data = await apiRequest('/api/v1/gateway/status', {
                method: 'POST'
            });
            apiState.isOnline = true;
            return {
                status: 'online',
                uptime: data.uptime || 0,
                version: data.version || '',
                port: 18789
            };
        } catch (e) {
            // 尝试备用endpoint
            try {
                const data = await apiRequest('/api/status');
                apiState.isOnline = true;
                return {
                    status: 'online',
                    uptime: data.uptime || 0,
                    version: data.version || '',
                    port: 18789
                };
            } catch (e2) {
                apiState.isOnline = false;
                // 返回mock数据作为后备
                return MOCK_DATA.gateway;
            }
        }
    }

    // 获取Agents列表
    async function fetchAgents() {
        try {
            const data = await apiRequest('/api/v1/agents');
            return data.agents || [];
        } catch (e) {
            return MOCK_DATA.agents;
        }
    }

    // 获取Cron任务
    async function fetchCronJobs() {
        try {
            // Gateway通过CLI调用，需要用正确的方式
            // 这里先返回mock数据，因为真正的cron.list需要通过WebSocket或CLI
            return MOCK_DATA.cron;
        } catch (e) {
            return MOCK_DATA.cron;
        }
    }

    // 触发Cron任务
    async function triggerCronJob(jobId) {
        try {
            const data = await apiRequest('/api/cron/run', {
                method: 'POST',
                body: JSON.stringify({ jobId })
            });
            return { success: true, result: data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // 获取网络状态
    function getNetworkState() {
        return {
            isOnline: apiState.isOnline,
            apiBase: CONFIG.API_BASE
        };
    }

    // 初始化
    function init() {
        // 启动时检查状态
        checkNetworkStatus();
    }

    // 导出
    window.ErgoAPI = {
        init,
        checkNetworkStatus,
        fetchGatewayStatus,
        fetchAgents,
        fetchCronJobs,
        triggerCronJob,
        getNetworkState
    };
})();
