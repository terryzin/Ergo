/**
 * Ergo API Module
 * 从中转服务获取状态
 */

(function() {
    'use strict';

    const CONFIG = {
        // 根据环境选择API地址
        get API_BASE() {
            const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
            const isRemote = hostname !== 'localhost' && hostname !== '127.0.0.1';
            // 远程通过cpolar访问status服务
            return isRemote 
                ? 'https://ergo-status.cpolar.top' 
                : 'http://localhost:8082';
        }
    };

    // 公开API
    window.ErgoAPI = {
        init: function() {},
        
        checkNetworkStatus: async function() {
            try {
                const response = await fetch(CONFIG.API_BASE + '/health');
                return response.ok;
            } catch {
                return false;
            }
        },
        
        fetchGatewayStatus: async function() {
            try {
                const response = await fetch(CONFIG.API_BASE + '/api/status');
                const data = await response.json();
                return data.gateway || { status: 'unknown' };
            } catch (e) {
                console.error('Failed to fetch status:', e);
                return { status: 'error', error: e.message };
            }
        },
        
        fetchAgents: async function() {
            try {
                const response = await fetch(CONFIG.API_BASE + '/api/status');
                const data = await response.json();
                return data.agents || [];
            } catch {
                return [];
            }
        },
        
        fetchCronJobs: async function() {
            try {
                const response = await fetch(CONFIG.API_BASE + '/api/status');
                const data = await response.json();
                return data.cron || [];
            } catch {
                return [];
            }
        },
        
        triggerCronJob: function(jobId) {
            window.open('http://localhost:18789', '_blank');
            return Promise.resolve({ success: true });
        },
        
        getNetworkState: async function() {
            const isOnline = await this.checkNetworkStatus();
            return { isOnline };
        }
    };
})();
