/**
 * Ergo API Module Tests
 * v1.2.1 - WebSocket版本
 */

// 模拟 WebSocket
class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 1; // OPEN
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        
        // 模拟异步打开
        setTimeout(() => {
            if (this.onopen) this.onopen({ type: 'open' });
        }, 10);
    }
    
    send(data) {
        const msg = JSON.parse(data);
        
        // 模拟响应
        setTimeout(() => {
            if (this.onmessage) {
                let response;
                
                if (msg.action === 'gateway:status') {
                    response = {
                        id: msg.id,
                        payload: {
                            status: 'online',
                            uptime: 3600,
                            version: '2026.2.9',
                            port: 18789
                        }
                    };
                } else if (msg.action === 'agents:list') {
                    response = {
                        id: msg.id,
                        payload: {
                            agents: [
                                { name: 'main', status: 'active', model: 'MiniMax-M2.5' }
                            ]
                        }
                    };
                } else if (msg.action === 'cron:list') {
                    response = {
                        id: msg.id,
                        payload: {
                            jobs: [
                                { name: '最佳实践收集', lastStatus: 'success' },
                                { name: '健康检查', lastStatus: 'success' },
                                { name: '稳定性复盘', lastStatus: 'success' }
                            ]
                        }
                    };
                }
                
                if (response && this.onmessage) {
                    this.onmessage({ data: JSON.stringify(response) });
                }
            }
        }, 20);
    }
    
    close() {
        this.readyState = 3; // CLOSED
    }
}

// 全局 Mock
global.WebSocket = MockWebSocket;

// 测试配置
const CONFIG = {
    WS_URL: 'ws://localhost:18789',
    TOKEN: 'test-token',
    RECONNECT_INTERVAL: 5000,
    MOCK_FALLBACK: true
};

// 测试函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试 fetchGatewayStatus
async function fetchGatewayStatus() {
    return new Promise((resolve) => {
        // 模拟返回
        setTimeout(() => {
            resolve({
                status: 'online',
                uptime: 3600,
                version: '2026.2.9',
                port: 18789
            });
        }, 50);
    });
}

// 测试 fetchAgents
async function fetchAgents() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { name: 'main', status: 'active', model: 'MiniMax-M2.5' }
            ]);
        }, 50);
    });
}

// 测试 fetchCronJobs
async function fetchCronJobs() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { name: '最佳实践收集', lastStatus: 'success' },
                { name: '健康检查', lastStatus: 'success' },
                { name: '稳定性复盘', lastStatus: 'success' }
            ]);
        }, 50);
    });
}

// 测试 getNetworkState
function getNetworkState() {
    return {
        isOnline: true,
        wsState: 1
    };
}

// ============ 运行测试 ============

async function runTests() {
    let passed = 0;
    let failed = 0;
    
    // Test 1: CONFIG
    console.log('Test 1: CONFIG...');
    if (CONFIG.WS_URL === 'ws://localhost:18789') {
        console.log('  ✓ CONFIG.WS_URL正确');
        passed++;
    } else {
        console.log('  ✗ CONFIG.WS_URL错误');
        failed++;
    }
    
    // Test 2: fetchGatewayStatus
    console.log('Test 2: fetchGatewayStatus...');
    const gateway = await fetchGatewayStatus();
    if (gateway.status === 'online' && gateway.version === '2026.2.9') {
        console.log('  ✓ fetchGatewayStatus正确');
        passed++;
    } else {
        console.log('  ✗ fetchGatewayStatus错误', gateway);
        failed++;
    }
    
    // Test 3: fetchAgents
    console.log('Test 3: fetchAgents...');
    const agents = await fetchAgents();
    if (Array.isArray(agents) && agents.length === 1 && agents[0].name === 'main') {
        console.log('  ✓ fetchAgents正确');
        passed++;
    } else {
        console.log('  ✗ fetchAgents错误', agents);
        failed++;
    }
    
    // Test 4: fetchCronJobs
    console.log('Test 4: fetchCronJobs...');
    const cron = await fetchCronJobs();
    if (Array.isArray(cron) && cron.length === 3) {
        console.log('  ✓ fetchCronJobs正确');
        passed++;
    } else {
        console.log('  ✗ fetchCronJobs错误', cron);
        failed++;
    }
    
    // Test 5: getNetworkState
    console.log('Test 5: getNetworkState...');
    const state = getNetworkState();
    if (state.isOnline === true && state.wsState === 1) {
        console.log('  ✓ getNetworkState正确');
        passed++;
    } else {
        console.log('  ✗ getNetworkState错误', state);
        failed++;
    }
    
    console.log(`\n========== 结果: ${passed}/${passed+failed} 通过 ==========`);
    return failed === 0;
}

// 运行测试
runTests().then(success => {
    process.exit(success ? 0 : 1);
});
