/**
 * Ergo API Module - 简化版
 * 直接返回状态数据
 */

(function() {
    'use strict';

    const CONFIG = {
        // 暂时使用Mock数据，因为Gateway API协议不兼容
        USE_MOCK: true
    };

    // Mock数据 - 从cron jobs.json读取
    const MOCK_DATA = {
        gateway: { 
            status: 'online', 
            uptime: 0, 
            version: '2026.2.9', 
            port: 18789 
        },
        agents: [
            { name: 'main', status: 'online', model: 'MiniMax-M2.5' }
        ],
        cron: [
            { 
                id: '9d6d36ae-c8c8-49ed-a6a5-f798b7884a63', 
                name: '最佳实践收集', 
                lastStatus: 'success', 
                nextRun: '18:00' 
            },
            { 
                id: 'f691da5c-5cf6-4b05-9e8d-3a77a6d60a06', 
                name: 'Gateway健康检查', 
                lastStatus: 'success', 
                nextRun: '每15分钟' 
            },
            { 
                id: '3148008b-1941-4357-ad0f-0f92fa7f9746', 
                name: '稳定性复盘', 
                lastStatus: 'success', 
                nextRun: '每周一 9:00' 
            }
        ]
    };

    // 公开API
    window.ErgoAPI = {
        init: function() {},
        
        checkNetworkStatus: function() {
            return Promise.resolve(true);
        },
        
        fetchGatewayStatus: function() {
            return Promise.resolve(MOCK_DATA.gateway);
        },
        
        fetchAgents: function() {
            return Promise.resolve(MOCK_DATA.agents);
        },
        
        fetchCronJobs: function() {
            return Promise.resolve(MOCK_DATA.cron);
        },
        
        triggerCronJob: function(jobId) {
            // 触发任务 - 通过打开本地页面
            window.open('http://localhost:18789', '_blank');
            return Promise.resolve({ success: true });
        },
        
        getNetworkState: function() {
            return { isOnline: true };
        }
    };
})();
