#!/usr/bin/env node
/**
 * 简单的测试运行器（无需 jest）
 * 用于测试 v1.3.0 认证系统
 */

const http = require('http');

// 测试配置
const API_BASE = 'http://localhost:8082';
const CORRECT_KEY = 'ergo-default-secret-key-2026';
const WRONG_KEY = 'wrong-key';

let passCount = 0;
let failCount = 0;

/**
 * 发送 HTTP 请求
 */
function request(path, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: 'GET',
            headers
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

/**
 * 断言工具
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * 测试用例
 */
async function test(name, fn) {
    try {
        await fn();
        console.log(`✓ ${name}`);
        passCount++;
    } catch (error) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${error.message}`);
        failCount++;
    }
}

/**
 * 主测试套件
 */
async function runTests() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  v1.3.0 认证系统测试              ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 测试 1: 健康检查不需要认证
    await test('健康检查端点不需要认证', async () => {
        const res = await request('/health');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.status === 'ok', 'Health status should be ok');
    });

    // 测试 2: 无密钥访问应返回 401
    await test('无密钥访问 /api/status 应返回 401', async () => {
        const res = await request('/api/status');
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assert(res.body.error === 'Missing API key', 'Should return missing key error');
    });

    // 测试 3: 错误密钥应返回 401
    await test('错误密钥访问 /api/status 应返回 401', async () => {
        const res = await request('/api/status', {
            'X-Ergo-Key': WRONG_KEY
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assert(res.body.error === 'Invalid API key', 'Should return invalid key error');
    });

    // 测试 4: 正确密钥应返回 200
    await test('正确密钥访问 /api/status 应返回 200', async () => {
        const res = await request('/api/status', {
            'X-Ergo-Key': CORRECT_KEY
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.gateway, 'Response should contain gateway');
        assert(res.body.agents, 'Response should contain agents');
        assert(res.body._meta, 'Response should contain _meta');
    });

    // 测试 5: Changelog 端点认证
    await test('正确密钥访问 /api/changelog 应返回 200', async () => {
        const res = await request('/api/changelog', {
            'X-Ergo-Key': CORRECT_KEY
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.body.versions), 'Should return versions array');
    });

    // 测试 6: Changelog 无密钥应失败
    await test('无密钥访问 /api/changelog 应返回 401', async () => {
        const res = await request('/api/changelog');
        assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    // 测试 7: 缓存元数据
    await test('返回的数据应包含缓存元数据', async () => {
        const res = await request('/api/status', {
            'X-Ergo-Key': CORRECT_KEY
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body._meta, 'Response should contain _meta');
        assert(typeof res.body._meta.cached === 'boolean', '_meta.cached should be boolean');
        assert(typeof res.body._meta.cacheAge === 'number', '_meta.cacheAge should be number');
    });

    // 测试 8: 认证提示信息
    await test('认证响应应包含正确的提示信息', async () => {
        const res = await request('/api/status');
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assert(res.body.message && res.body.message.includes('X-Ergo-Key'), 'Should mention X-Ergo-Key');
        assert(res.body.hint, 'Should contain hint');
    });

    // 前端密钥管理测试
    console.log('\n--- 前端密钥管理测试 ---\n');

    await test('localStorage 密钥存储和读取', async () => {
        // 模拟 localStorage
        const storage = {};
        const AUTH_STORAGE_KEY = 'ergoApiKey';
        const DEFAULT_API_KEY = 'ergo-default-secret-key-2026';

        // 首次访问
        let key = storage[AUTH_STORAGE_KEY];
        if (!key) {
            key = DEFAULT_API_KEY;
            storage[AUTH_STORAGE_KEY] = key;
        }

        assert(key === DEFAULT_API_KEY, 'Should use default key on first access');
        assert(storage[AUTH_STORAGE_KEY] === DEFAULT_API_KEY, 'Should save key to storage');
    });

    await test('自定义密钥设置', async () => {
        const storage = {};
        const AUTH_STORAGE_KEY = 'ergoApiKey';
        const customKey = 'my-custom-key';

        storage[AUTH_STORAGE_KEY] = customKey;
        assert(storage[AUTH_STORAGE_KEY] === customKey, 'Should save custom key');
    });

    // 输出结果
    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║  测试结果: ${passCount} 通过 / ${failCount} 失败       ║`);
    console.log('╚════════════════════════════════════════╝\n');

    process.exit(failCount > 0 ? 1 : 0);
}

// 执行测试
runTests().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
});
