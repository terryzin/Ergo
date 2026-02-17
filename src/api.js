/**
 * Ergo API Module
 * 从本地JSON文件读取状态
 */

(function() {
    'use strict';

    const CONFIG = {
        STATUS_FILE: 'data/gateway-status.json',
        // 根据环境选择地址
        get API_BASE() {
            const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
            const isRemote = hostname !== 'localhost' && hostname !== '127.0.0.1';
            return isRemote ? 'https://terryzin.cpolar.top' : 'http://localhost:8081';
        }
    };

    // 加载状态文件
    async function loadStatus() {
        try {
            const response = await fetch(CONFIG.STATUS_FILE);
            if (!response.ok) throw new Error('Failed to load status');
            return await response.json();
        } catch (e) {
            console.log('[ErgoAPI] Using default status, error:', e.message);
            return getDefaultStatus();
        }
    }

    function getDefaultStatus() {
        return {
            gateway: { status: 'unknown', uptime: 0, version: '2026.2.9', port: 18789, lastUpdate: null },
            agents: [],
            cron: [],
            updatedAt: null
        };
    }

    // 公开API
    window.ErgoAPI = {
        init: async function() {
            // 加载状态
            const status = await loadStatus();
            return status;
        },
        
        checkNetworkStatus: async function() {
            try {
                const response = await fetch(CONFIG.STATUS_FILE, { cache: 'no-cache' });
                return response.ok;
            } catch {
                return false;
            }
        },
        
        fetchGatewayStatus: async function() {
            const status = await loadStatus();
            return status.gateway;
        },
        
        fetchAgents: async function() {
            const status = await loadStatus();
            return status.agents || [];
        },
        
        fetchCronJobs: async function() {
            const status = await loadStatus();
            return status.cron || [];
        },
        
        triggerCronJob: function(jobId) {
            // 打开本地Gateway页面触发
            window.open(CONFIG.API_BASE.replace('8081', '18789'), '_blank');
            return Promise.resolve({ success: true });
        },
        
        getNetworkState: async function() {
            try {
                await fetch(CONFIG.STATUS_FILE, { cache: 'no-cache' });
                return { isOnline: true };
            } catch {
                return { isOnline: false };
            }
        }
    };
})();
