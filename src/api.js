/**
 * Ergo API Module
 * Gateway API 封装 - 使用 WebSocket 连接
 *
 * v1.2.1 更新:
 * - 改为 WebSocket 连接（Gateway 使用 ws 协议）
 * - 支持 cpolar 穿透访问
 */

(function() {
    'use strict';

    // 配置
    const CONFIG = {
        // 根据环境选择 WebSocket URL
        get WS_URL() {
            const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
            const isRemote = hostname !== 'localhost' && hostname !== '127.0.0.1';
            return isRemote 
                ? 'wss://ergo-gateway.cpolar.top' 
                : 'ws://127.0.0.1:18789';
        },
        TOKEN: 'f2009973e92e96b0e31c30b30500e997',
        RECONNECT_INTERVAL: 5000,  // 重连间隔 (ms)
        MOCK_FALLBACK: true         // 失败时回退到 Mock
    };

    // WebSocket 实例
    let ws = null;
    let wsReady = false;
    let pendingRequests = new Map();
    let requestId = 0;
    let reconnectTimer = null;
    let isConnecting = false;

    // 状态
    const apiState = {
        isOnline: false,
        lastError: null,
        uptime: 0,
        version: '',
        port: 18789
    };

    // Mock 数据
    const MOCK_DATA = {
        gateway: {
            status: 'online',
            uptime: 3600,
            version: '2026.2.9',
            port: 18789
        },
        agents: [
            { name: 'main', status: 'active', model: 'MiniMax-M2.5' }
        ],
        cron: [
            { id: '9d6d36ae-c8c8-49ed-a6a5-f798b7884a63', name: '最佳实践收集', lastStatus: 'success', nextRun: '18:00' },
            { id: 'f691da5c-5cf6-4b05-9e8d-3a77a6d60a06', name: 'Gateway健康检查', lastStatus: 'success', nextRun: '每15分钟' },
            { id: '3148008b-1941-4357-ad0f-0f92fa7f9746', name: '稳定性复盘', lastStatus: 'success', nextRun: '每周一 9:00' }
        ]
    };

    // 生成请求 ID
    function generateId() {
        return `req_${++requestId}_${Date.now()}`;
    }

    // WebSocket 连接
    function connect() {
        if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
            return;
        }

        isConnecting = true;
        
        try {
            ws = new WebSocket(CONFIG.WS_URL);

            ws.onopen = function() {
                console.log('[Ergo] WebSocket connected');
                wsReady = true;
                isConnecting = false;
                apiState.isOnline = true;
                
                // 发送认证
                send({ action: 'auth', token: CONFIG.TOKEN });
                
                // 重新发送 pending 请求
                pendingRequests.forEach((resolve, id) => {
                    resolve({ error: 'Request resend after reconnect' });
                });
                pendingRequests.clear();
                
                // 清除重连定时器
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
            };

            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    const { id, payload, error } = data;
                    
                    if (id && pendingRequests.has(id)) {
                        const { resolve, reject } = pendingRequests.get(id);
                        pendingRequests.delete(id);
                        
                        if (error) {
                            reject(new Error(error));
                        } else {
                            resolve(payload);
                        }
                    }
                } catch (e) {
                    console.error('[Ergo] Parse message error:', e);
                }
            };

            ws.onerror = function(error) {
                console.error('[Ergo] WebSocket error:', error);
                isConnecting = false;
            };

            ws.onclose = function() {
                console.log('[Ergo] WebSocket closed');
                wsReady = false;
                apiState.isOnline = false;
                isConnecting = false;
                
                // 自动重连
                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        connect();
                    }, CONFIG.RECONNECT_INTERVAL);
                }
            };
        } catch (e) {
            console.error('[Ergo] Connect error:', e);
            isConnecting = false;
        }
    }

    // 发送请求
    function send(data) {
        return new Promise((resolve, reject) => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            const id = generateId();
            const message = { ...data, id };
            
            pendingRequests.set(id, { resolve, reject });
            
            ws.send(JSON.stringify(message));
            
            // 超时处理
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 10000);
        });
    }

    // 通用请求封装
    async function request(action, payload = {}) {
        // 如果未连接，尝试连接
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connect();
            
            // 等待连接
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        try {
            const result = await send({ action, payload, token: CONFIG.TOKEN });
            return result;
        } catch (error) {
            console.error('[Ergo] Request error:', error);
            
            // 失败时回退到 Mock
            if (CONFIG.MOCK_FALLBACK) {
                console.log('[Ergo] Falling back to mock data');
                return getMockData(action);
            }
            throw error;
        }
    }

    // 获取 Mock 数据
    function getMockData(action) {
        switch (action) {
            case 'gateway:status':
                return MOCK_DATA.gateway;
            case 'agents:list':
                return { agents: MOCK_DATA.agents };
            case 'cron:list':
                return { jobs: MOCK_DATA.cron };
            default:
                return {};
        }
    }

    // ============ 公开 API ============

    // 检测网络状态
    function checkNetworkStatus() {
        return new Promise((resolve) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                apiState.isOnline = true;
                resolve(true);
            } else {
                apiState.isOnline = false;
                resolve(false);
            }
        });
    }

    // 获取 Gateway 状态
    async function fetchGatewayStatus() {
        try {
            const data = await request('gateway:status');
            apiState.isOnline = true;
            apiState.uptime = data.uptime || 0;
            apiState.version = data.version || '';
            return {
                status: 'online',
                uptime: apiState.uptime,
                version: apiState.version,
                port: CONFIG.WS_URL.includes('18789') ? 18789 : 80
            };
        } catch (e) {
            apiState.isOnline = false;
            if (CONFIG.MOCK_FALLBACK) {
                return MOCK_DATA.gateway;
            }
            throw e;
        }
    }

    // 获取 Agents 列表
    async function fetchAgents() {
        try {
            const data = await request('agents:list');
            return data.agents || [];
        } catch (e) {
            if (CONFIG.MOCK_FALLBACK) {
                return MOCK_DATA.agents;
            }
            throw e;
        }
    }

    // 获取 Cron 任务
    async function fetchCronJobs() {
        try {
            const data = await request('cron:list');
            return data.jobs || [];
        } catch (e) {
            if (CONFIG.MOCK_FALLBACK) {
                return MOCK_DATA.cron;
            }
            throw e;
        }
    }

    // 手动触发 Cron 任务
    async function triggerCronJob(jobId) {
        try {
            const data = await request('cron:run', { jobId });
            return { success: true, result: data };
        } catch (e) {
            console.error('[Ergo] Trigger cron error:', e);
            return { success: false, error: e.message };
        }
    }

    // 获取网络状态
    function getNetworkState() {
        return {
            isOnline: apiState.isOnline,
            wsState: ws ? ws.readyState : WebSocket.CLOSED
        };
    }

    // 初始化连接
    function init() {
        connect();
    }

    // 导出到全局
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
