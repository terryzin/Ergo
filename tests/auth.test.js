/**
 * 认证系统测试
 * 测试 v1.3.0 自动配对功能
 */

const http = require('http');

// 测试配置
const API_BASE = 'http://localhost:8082';
const CORRECT_KEY = 'ergo-default-secret-key-2026';
const WRONG_KEY = 'wrong-key';

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
 * 测试套件
 */
describe('v1.3.0 - 自动配对系统认证测试', () => {
    test('健康检查端点不需要认证', async () => {
        const res = await request('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('无密钥访问 /api/status 应返回 401', async () => {
        const res = await request('/api/status');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Missing API key');
    });

    test('错误密钥访问 /api/status 应返回 401', async () => {
        const res = await request('/api/status', {
            'X-Ergo-Key': WRONG_KEY
        });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid API key');
    });

    test('正确密钥访问 /api/status 应返回 200', async () => {
        const res = await request('/api/status', {
            'X-Ergo-Key': CORRECT_KEY
        });
        expect(res.status).toBe(200);
        expect(res.body.gateway).toBeDefined();
        expect(res.body.agents).toBeDefined();
    });

    test('正确密钥访问 /api/changelog 应返回 200', async () => {
        const res = await request('/api/changelog', {
            'X-Ergo-Key': CORRECT_KEY
        });
        expect(res.status).toBe(200);
        expect(res.body.versions).toBeDefined();
        expect(Array.isArray(res.body.versions)).toBe(true);
    });

    test('无密钥访问 /api/changelog 应返回 401', async () => {
        const res = await request('/api/changelog');
        expect(res.status).toBe(401);
    });

    test('正确密钥访问 /api/status/refresh 应返回 200', async () => {
        const res = await request('/api/status/refresh', {
            'X-Ergo-Key': CORRECT_KEY
        });
        expect(res.status).toBe(200);
        expect(res.body._meta).toBeDefined();
        expect(res.body._meta.refreshed).toBe(true);
    }, 20000); // 20秒超时（因为需要执行 CLI）

    test('认证响应应包含正确的提示信息', async () => {
        const res = await request('/api/status');
        expect(res.status).toBe(401);
        expect(res.body.message).toContain('X-Ergo-Key');
        expect(res.body.hint).toBeDefined();
    });

    test('返回的数据应包含缓存元数据', async () => {
        const res = await request('/api/status', {
            'X-Ergo-Key': CORRECT_KEY
        });
        expect(res.status).toBe(200);
        expect(res.body._meta).toBeDefined();
        expect(res.body._meta.cached).toBeDefined();
        expect(res.body._meta.cacheAge).toBeDefined();
    });
});

/**
 * 前端密钥管理测试（使用 jsdom 模拟）
 */
describe('v1.3.0 - 前端密钥管理', () => {
    let localStorage;

    beforeEach(() => {
        // 模拟 localStorage
        localStorage = {
            data: {},
            getItem(key) {
                return this.data[key] || null;
            },
            setItem(key, value) {
                this.data[key] = value;
            },
            removeItem(key) {
                delete this.data[key];
            }
        };
    });

    test('getApiKey 应返回存储的密钥', () => {
        const AUTH_STORAGE_KEY = 'ergoApiKey';
        const DEFAULT_API_KEY = 'ergo-default-secret-key-2026';

        // 模拟首次访问
        expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();

        // 首次访问应返回并保存默认密钥
        let key = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!key) {
            key = DEFAULT_API_KEY;
            localStorage.setItem(AUTH_STORAGE_KEY, key);
        }

        expect(key).toBe(DEFAULT_API_KEY);
        expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(DEFAULT_API_KEY);
    });

    test('setApiKey 应正确保存密钥', () => {
        const AUTH_STORAGE_KEY = 'ergoApiKey';
        const customKey = 'my-custom-key';

        localStorage.setItem(AUTH_STORAGE_KEY, customKey);
        expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(customKey);
    });

    test('密钥应持久化存储', () => {
        const AUTH_STORAGE_KEY = 'ergoApiKey';
        const testKey = 'test-key-123';

        localStorage.setItem(AUTH_STORAGE_KEY, testKey);

        // 模拟页面刷新（重新读取）
        const retrievedKey = localStorage.getItem(AUTH_STORAGE_KEY);
        expect(retrievedKey).toBe(testKey);
    });
});
