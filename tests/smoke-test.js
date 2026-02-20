#!/usr/bin/env node
/**
 * Ergo Smoke Tests
 * 验证所有基础功能的端到端测试
 *
 * Usage:
 *   node tests/smoke-test.js
 *   node tests/smoke-test.js --local    # 仅测试本地
 *   node tests/smoke-test.js --public   # 仅测试公网
 */

const http = require('http');
const https = require('https');

// 测试配置
const CONFIG = {
    apiKey: 'ergo-default-secret-key-2026',
    localBaseUrl: 'http://localhost:8081',
    publicBaseUrl: 'https://terryzin.cpolar.top',
    timeout: 10000
};

// 测试模式
const args = process.argv.slice(2);
const testMode = args[0] || 'all';  // all, local, public

// ANSI 颜色
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m'
};

// 测试结果统计
const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
};

/**
 * HTTP/HTTPS 请求封装
 */
function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const timeout = options.timeout || CONFIG.timeout;

        const req = lib.request(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.headers['content-type']?.includes('application/json')) {
                        resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
                    } else {
                        resolve({ status: res.statusCode, data, headers: res.headers });
                    }
                } catch (e) {
                    resolve({ status: res.statusCode, data, headers: res.headers });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

/**
 * 测试用例执行器
 */
async function test(name, fn) {
    stats.total++;
    try {
        process.stdout.write(`  ${colors.gray}[  ]${colors.reset} ${name}...`);
        await fn();
        process.stdout.write(`\r  ${colors.green}[✓]${colors.reset} ${name}\n`);
        stats.passed++;
        return true;
    } catch (error) {
        process.stdout.write(`\r  ${colors.red}[✗]${colors.reset} ${name}\n`);
        console.log(`      ${colors.red}Error: ${error.message}${colors.reset}`);
        stats.failed++;
        return false;
    }
}

/**
 * 断言函数
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertStatus(response, expectedStatus) {
    assertEqual(response.status, expectedStatus, `Expected status ${expectedStatus}, got ${response.status}`);
}

function assertJSON(data) {
    assert(typeof data === 'object' && data !== null, 'Response is not valid JSON');
}

/**
 * 测试套件：基础连通性
 */
async function testConnectivity(baseUrl) {
    const isPublic = baseUrl.includes('cpolar');
    const label = isPublic ? '公网' : '本地';

    console.log(`\n${colors.blue}▸ ${label}连通性测试${colors.reset}`);

    await test(`${label}前端页面可访问`, async () => {
        const res = await fetch(baseUrl);
        assertStatus(res, 200);
        assert(res.data.includes('Ergo'), 'Page does not contain "Ergo"');
    });

    await test(`${label} /api/health 端点`, async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        assertStatus(res, 200);
        assertJSON(res.data);
        assertEqual(res.data.status, 'ok');
    });
}

/**
 * 测试套件：API 认证
 */
async function testAuthentication(baseUrl) {
    const isPublic = baseUrl.includes('cpolar');
    const label = isPublic ? '公网' : '本地';

    console.log(`\n${colors.blue}▸ ${label} API 认证测试${colors.reset}`);

    await test(`${label}未认证请求返回 401`, async () => {
        const res = await fetch(`${baseUrl}/api/status`);
        assertStatus(res, 401);
        assertJSON(res.data);
        assert(res.data.error, 'Should have error message');
    });

    await test(`${label}错误密钥返回 401`, async () => {
        const res = await fetch(`${baseUrl}/api/status`, {
            headers: { 'X-Ergo-Key': 'wrong-key' }
        });
        assertStatus(res, 401);
    });

    await test(`${label}正确密钥返回数据`, async () => {
        const res = await fetch(`${baseUrl}/api/status`, {
            headers: { 'X-Ergo-Key': CONFIG.apiKey }
        });
        assertStatus(res, 200);
        assertJSON(res.data);
        assert(res.data.gateway, 'Should have gateway data');
    });
}

/**
 * 测试套件：API 端点
 */
async function testAPIEndpoints(baseUrl) {
    const isPublic = baseUrl.includes('cpolar');
    const label = isPublic ? '公网' : '本地';

    console.log(`\n${colors.blue}▸ ${label} API 端点测试${colors.reset}`);

    const headers = { 'X-Ergo-Key': CONFIG.apiKey };

    await test(`${label} GET /api/status`, async () => {
        const res = await fetch(`${baseUrl}/api/status`, { headers });
        assertStatus(res, 200);
        assertJSON(res.data);
        assert(res.data.gateway, 'Missing gateway data');
        assert(Array.isArray(res.data.agents), 'agents should be array');
        assert(Array.isArray(res.data.cron), 'cron should be array');
    });

    await test(`${label} GET /api/changelog`, async () => {
        const res = await fetch(`${baseUrl}/api/changelog`, { headers });
        assertStatus(res, 200);
        assertJSON(res.data);
        assert(Array.isArray(res.data.versions), 'versions should be array');
        assert(res.data.versions.length > 0, 'Should have at least one version');
    });

    await test(`${label} GET /api/cron`, async () => {
        const res = await fetch(`${baseUrl}/api/cron`, { headers });
        assertStatus(res, 200);
        assertJSON(res.data);
        assert(res.data.cron, 'Missing cron field');
        assert(Array.isArray(res.data.cron), 'cron should be array');
    });
}

/**
 * 测试套件：数据结构
 */
async function testDataStructure(baseUrl) {
    const isPublic = baseUrl.includes('cpolar');
    const label = isPublic ? '公网' : '本地';

    console.log(`\n${colors.blue}▸ ${label}数据结构测试${colors.reset}`);

    const headers = { 'X-Ergo-Key': CONFIG.apiKey };

    await test(`${label} Gateway 结构完整`, async () => {
        const res = await fetch(`${baseUrl}/api/status`, { headers });
        const { gateway } = res.data;
        assert(gateway.status, 'Missing gateway.status');
        assert(gateway.version, 'Missing gateway.version');
        assert(typeof gateway.uptime === 'number', 'gateway.uptime should be number');
    });

    await test(`${label}缓存元数据存在`, async () => {
        const res = await fetch(`${baseUrl}/api/status`, { headers });
        assert(res.data._meta, 'Missing _meta');
        assert(typeof res.data._meta.cached === 'boolean', '_meta.cached should be boolean');
        assert(res.data._meta.lastUpdate, 'Missing _meta.lastUpdate');
    });

    await test(`${label} Agents 结构正确`, async () => {
        const res = await fetch(`${baseUrl}/api/status`, { headers });
        const { agents } = res.data;
        if (agents.length > 0) {
            const agent = agents[0];
            assert(agent.name, 'Agent missing name');
            assert(agent.status, 'Agent missing status');
            assert(agent.model, 'Agent missing model');
        }
    });

    await test(`${label} Changelog 结构正确`, async () => {
        const res = await fetch(`${baseUrl}/api/changelog`, { headers });
        const version = res.data.versions[0];
        assert(version.version, 'Version missing version field');
        assert(version.date, 'Version missing date');
        assert(Array.isArray(version.features), 'Version.features should be array');
    });
}

/**
 * 测试套件：静态文件
 */
async function testStaticFiles(baseUrl) {
    const isPublic = baseUrl.includes('cpolar');
    const label = isPublic ? '公网' : '本地';

    console.log(`\n${colors.blue}▸ ${label}静态文件测试${colors.reset}`);

    await test(`${label} changelog.html 可访问`, async () => {
        const res = await fetch(`${baseUrl}/changelog.html`);
        assertStatus(res, 200);
        assert(res.data.includes('更新日志'), 'Page should contain "更新日志"');
    });

    // TODO: settings.html 待实现
    // await test(`${label} settings.html 可访问`, async () => {
    //     const res = await fetch(`${baseUrl}/settings.html`);
    //     assertStatus(res, 200);
    //     assert(res.data.includes('系统设置'), 'Page should contain "系统设置"');
    // });
}

/**
 * 测试套件：性能
 */
async function testPerformance(baseUrl) {
    const isPublic = baseUrl.includes('cpolar');
    const label = isPublic ? '公网' : '本地';

    console.log(`\n${colors.blue}▸ ${label}性能测试${colors.reset}`);

    await test(`${label} /api/health 响应 < ${isPublic ? 200 : 100}ms`, async () => {
        const start = Date.now();
        const res = await fetch(`${baseUrl}/api/health`);
        const latency = Date.now() - start;
        assertStatus(res, 200);
        const maxLatency = isPublic ? 200 : 100;
        assert(latency < maxLatency, `Latency ${latency}ms exceeds ${maxLatency}ms`);
    });

    await test(`${label} /api/status (缓存) < ${isPublic ? 500 : 200}ms`, async () => {
        const start = Date.now();
        const res = await fetch(`${baseUrl}/api/status`, {
            headers: { 'X-Ergo-Key': CONFIG.apiKey }
        });
        const latency = Date.now() - start;
        assertStatus(res, 200);
        const maxLatency = isPublic ? 500 : 200;
        assert(latency < maxLatency, `Latency ${latency}ms exceeds ${maxLatency}ms`);
    });
}

/**
 * 测试套件：错误处理
 */
async function testErrorHandling(baseUrl) {
    const isPublic = baseUrl.includes('cpolar');
    const label = isPublic ? '公网' : '本地';

    console.log(`\n${colors.blue}▸ ${label}错误处理测试${colors.reset}`);

    await test(`${label} 404 返回首页`, async () => {
        const res = await fetch(`${baseUrl}/nonexistent-page`);
        assertStatus(res, 404);
        // Express 配置的 404 处理返回 index.html
        assert(res.data.includes('Ergo'), 'Should return index.html');
    });

    await test(`${label}不存在的 API 返回错误`, async () => {
        try {
            await fetch(`${baseUrl}/api/nonexistent`, {
                headers: { 'X-Ergo-Key': CONFIG.apiKey }
            });
            throw new Error('Should have thrown');
        } catch (error) {
            // 期望出错
            assert(true);
        }
    });
}

/**
 * 主函数
 */
async function main() {
    console.log(`\n${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.blue}║       Ergo Smoke Tests v1.0               ║${colors.reset}`);
    console.log(`${colors.blue}╠════════════════════════════════════════════╣${colors.reset}`);
    console.log(`${colors.blue}║   Mode: ${testMode.padEnd(34)}║${colors.reset}`);
    console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}\n`);

    const startTime = Date.now();

    try {
        // 本地测试
        if (testMode === 'all' || testMode === 'local') {
            await testConnectivity(CONFIG.localBaseUrl);
            await testAuthentication(CONFIG.localBaseUrl);
            await testAPIEndpoints(CONFIG.localBaseUrl);
            await testDataStructure(CONFIG.localBaseUrl);
            await testStaticFiles(CONFIG.localBaseUrl);
            await testPerformance(CONFIG.localBaseUrl);
            await testErrorHandling(CONFIG.localBaseUrl);
        }

        // 公网测试
        if (testMode === 'all' || testMode === 'public') {
            await testConnectivity(CONFIG.publicBaseUrl);
            await testAuthentication(CONFIG.publicBaseUrl);
            await testAPIEndpoints(CONFIG.publicBaseUrl);
            await testDataStructure(CONFIG.publicBaseUrl);
            await testStaticFiles(CONFIG.publicBaseUrl);
            await testPerformance(CONFIG.publicBaseUrl);
            await testErrorHandling(CONFIG.publicBaseUrl);
        }
    } catch (error) {
        console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
        process.exit(1);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 打印结果
    console.log(`\n${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.blue}║   Test Results                            ║${colors.reset}`);
    console.log(`${colors.blue}╠════════════════════════════════════════════╣${colors.reset}`);
    console.log(`${colors.blue}║${colors.reset}   Total:  ${stats.total.toString().padEnd(32)}${colors.blue}║${colors.reset}`);
    console.log(`${colors.blue}║${colors.reset}   ${colors.green}Passed: ${stats.passed.toString().padEnd(31)}${colors.reset}${colors.blue}║${colors.reset}`);
    console.log(`${colors.blue}║${colors.reset}   ${colors.red}Failed: ${stats.failed.toString().padEnd(31)}${colors.reset}${colors.blue}║${colors.reset}`);
    console.log(`${colors.blue}║${colors.reset}   Duration: ${duration}s${' '.repeat(26 - duration.length)}${colors.blue}║${colors.reset}`);
    console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}\n`);

    if (stats.failed > 0) {
        console.log(`${colors.red}✗ ${stats.failed} test(s) failed${colors.reset}\n`);
        process.exit(1);
    } else {
        console.log(`${colors.green}✓ All tests passed!${colors.reset}\n`);
        process.exit(0);
    }
}

// 运行测试
main().catch(error => {
    console.error(`\n${colors.red}Unhandled error: ${error.message}${colors.reset}\n`);
    process.exit(1);
});
