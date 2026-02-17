/**
 * Ergo API Module
 * 从本地中转服务获取状态
 */

(function() {
    'use strict';

    const CONFIG = {
        // 本地服务地址
        LOCAL_API: 'http://localhost:8082'
    };

    // 公开API
    window.ErgoAPI = {
        init: function() {},
        
        checkNetworkStatus: async function() {
            try {
                const response = await fetch(CONFIG.LOCAL_API + '/health');
                return response.ok;
            } catch {
                return false;
            }
        },
        
        fetchGatewayStatus: async function() {
            try {
                const response = await fetch(CONFIG.LOCAL_API + '/api/status');
                const data = await response.json();
                return data.gateway || { status: 'unknown' };
            } catch (e) {
                console.error('Failed to fetch status:', e);
                return { status: 'error', error: e.message };
            }
        },
        
        fetchAgents: async function() {
            try {
                const response = await fetch(CONFIG.LOCAL_API + '/api/status');
                const data = await response.json();
                return data.agents || [];
            } catch {
                return [];
            }
        },
        
        fetchCronJobs: async function() {
            try {
                const response = await fetch(CONFIG.LOCAL_API + '/api/status');
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
