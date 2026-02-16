/**
 * Ergo API Module
 * Gateway API 封装 - 使用 WebSocket 连接
 *
 * v1.2.2 更新:
 * - 修复WebSocket认证流程
 * - 支持cron任务触发
 */

(function() {
    'use strict';

    // 配置
    const CONFIG = {
        get WS_URL() {
            const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
            const isRemote = hostname !== 'localhost' && hostname !== '127.0.0.1';
            return isRemote 
                ? 'wss://ergo-gateway.cpolar.top' 
                : 'ws://127.0.0.1:18789';
        },
        TOKEN: 'f2009973e92e96b0e31c30b30500e997',
        RECONNECT_INTERVAL: 5000,
        MOCK_FALLBACK: false  // 关闭Mock回退，要求真实API
    };

    // WebSocket 实例
    let ws = null;
    let wsReady = false;
    let authenticated = false;
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

    // Mock 数据 (仅用于展示结构)
    const MOCK_DATA = {
        gateway: { status: 'online', uptime: 3600, version: '2026.2.9', port: 18789 },
        agents: [{ name: 'main', status: 'active', model: 'MiniMax-M2.5' }],
        cron: [
            { id: '9d6d36ae-c8c8-49ed-a6a5-f798b7884a63', name: '最佳实践收集', lastStatus: 'success', nextRun: '18:00' },
            { id: 'f691da5c-5cf6-4b05-9e8d-3a77a6d60a06', name: 'Gateway健康检查', lastStatus: 'success', nextRun: '每15分钟' },
            { id: '3148008b-1941-4357-ad0f-0f92fa7f9746', name: '稳定性复盘', lastStatus: 'success', nextRun: '每周一 9:00' }
        ]
    };

    function generateId() {
        return `req_${++requestId}_${Date.now()}`;
    }

    // WebSocket 连接
    function connect() {
        if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
            return;
        }

        isConnecting = true;
        console.log('[Ergo] Connecting to Gateway...');
        
        try {
            ws = new WebSocket(CONFIG.WS_URL);

            ws.onopen = function() {
                console.log('[Ergo] WebSocket connected, authenticating...');
                // 发送认证
                send({ action: 'auth', token: CONFIG.TOKEN }).then(() => {
                    console.log('[Ergo] Authenticated successfully');
                    authenticated = true;
                    apiState.isOnline = true;
                }).catch(err => {
                    console.error('[Ergo] Auth failed:', err);
                });
            };

            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[Ergo] Received:', JSON.stringify(data));
                    
                    const { id, payload, error, action } = data;
                    
                    // 处理认证响应 - Gateway可能返回不同的格式
                    if (action === 'auth' || data.type === 'auth' || !action) {
                        // 检查是否是认证成功
                        if (data.auth === true || payload === true || data.error === undefined) {
                            console.log('[Ergo] Auth success');
                            authenticated = true;
                            apiState.isOnline = true;
                        } else if (data.error) {
                            console.error('[Ergo] Auth error:', data.error);
                            authenticated = false;
                        }
                        return;
                    }
                    
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
                authenticated = false;
                apiState.isOnline = false;
                isConnecting = false;
                
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
            
            console.log('[Ergo] Sending:', message);
            pendingRequests.set(id, { resolve, reject });
            
            ws.send(JSON.stringify(message));
            
            // 超时处理
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 15000);
        });
    }

    // 通用请求封装
    async function request(action, payload = {}) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connect();
            // 等待连接和认证
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 等待认证完成
        let attempts = 0;
        while (!authenticated && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        if (!authenticated) {
            throw new Error('Not authenticated');
        }

        try {
            const result = await send({ action, payload });
            return result;
        } catch (error) {
            console.error('[Ergo] Request error:', error);
            if (CONFIG.MOCK_FALLBACK) {
                console.log('[Ergo] Using mock data');
                return getMockData(action);
            }
            throw error;
        }
    }

    function getMockData(action) {
        switch (action) {
            case 'status': return MOCK_DATA.gateway;
            case 'agents:list': return { agents: MOCK_DATA.agents };
            case 'cron.list': return { jobs: MOCK_DATA.cron };
            default: return {};
        }
    }

    // ============ 公开 API ============

    function checkNetworkStatus() {
        return new Promise((resolve) => {
            if (ws && ws.readyState === WebSocket.OPEN && authenticated) {
                apiState.isOnline = true;
                resolve(true);
            } else {
                apiState.isOnline = false;
                resolve(false);
            }
        });
    }

    async function fetchGatewayStatus() {
        try {
            const data = await send({ action: 'status' });
            apiState.isOnline = true;
            return {
                status: 'online',
                uptime: data.uptime || 0,
                version: data.version || '',
                port: 18789
            };
        } catch (e) {
            apiState.isOnline = false;
            if (CONFIG.MOCK_FALLBACK) return MOCK_DATA.gateway;
            throw e;
        }
    }

    async function fetchAgents() {
        try {
            const data = await send({ action: 'agents:list' });
            return data.agents || [];
        } catch (e) {
            if (CONFIG.MOCK_FALLBACK) return MOCK_DATA.agents;
            throw e;
        }
    }

    async function fetchCronJobs() {
        try {
            const data = await send({ action: 'cron.list' });
            return data.jobs || [];
        } catch (e) {
            if (CONFIG.MOCK_FALLBACK) return MOCK_DATA.cron;
            throw e;
        }
    }

    async function triggerCronJob(jobId) {
        try {
            console.log('[Ergo] Triggering cron job:', jobId);
            const data = await send({ action: 'cron.run', payload: { jobId } });
            return { success: true, result: data };
        } catch (e) {
            console.error('[Ergo] Trigger cron error:', e);
            return { success: false, error: e.message };
        }
    }

    function getNetworkState() {
        return {
            isOnline: apiState.isOnline && authenticated,
            wsState: ws ? ws.readyState : WebSocket.CLOSED,
            authenticated: authenticated
        };
    }

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
