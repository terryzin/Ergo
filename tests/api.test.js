/**
 * API Module Tests (v1.2)
 */

const {
    isMockMode,
    ENV,
    CONFIG,
    checkNetworkStatus,
    getNetworkState,
    fetchGatewayStatus,
    fetchAgents,
    fetchCronJobs,
    fetchDevServices,
    restartGateway,
    fetchAllData,
    delay
} = require('../src/api');

describe('API Module (v1.2)', () => {
    describe('CONFIG', () => {
        test('has correct default values', () => {
            expect(CONFIG.API_BASE).toBe('http://localhost:18789');
            expect(CONFIG.TIMEOUT).toBe(5000);
            expect(CONFIG.RETRY_COUNT).toBe(3);
            expect(CONFIG.RETRY_DELAY).toBe(1000);
            expect(CONFIG.MOCK_FALLBACK).toBe(true);
        });
    });

    describe('ENV', () => {
        test('has getHostname method', () => {
            expect(typeof ENV.getHostname).toBe('function');
        });

        test('has isProduction getter', () => {
            expect(ENV.isProduction).toBeDefined();
        });

        test('has isDevelopment getter', () => {
            expect(ENV.isDevelopment).toBeDefined();
        });
    });

    describe('delay', () => {
        test('creates a delay', async () => {
            const start = Date.now();
            await delay(100);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(90);
        });
    });

    describe('fetchGatewayStatus', () => {
        test('returns mock data with _source property', async () => {
            const result = await fetchGatewayStatus();

            expect(result).toHaveProperty('status', 'online');
            expect(result).toHaveProperty('uptime', 259200);
            expect(result).toHaveProperty('version', '0.9.5');
            expect(result).toHaveProperty('port', 18789);
            expect(result).toHaveProperty('_source', 'mock');
        });
    });

    describe('fetchAgents', () => {
        test('returns mock agents list', async () => {
            const result = await fetchAgents();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(3);

            const onlineAgents = result.filter(a => a.status === 'online');
            expect(onlineAgents.length).toBe(2);
        });

        test('agents have required properties', async () => {
            const result = await fetchAgents();

            result.forEach(agent => {
                expect(agent).toHaveProperty('name');
                expect(agent).toHaveProperty('status');
                expect(agent).toHaveProperty('type');
                expect(agent).toHaveProperty('lastActive');
            });
        });
    });

    describe('fetchCronJobs', () => {
        test('returns mock cron jobs', async () => {
            const result = await fetchCronJobs();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(4);
        });

        test('has jobs with success and failure status', async () => {
            const result = await fetchCronJobs();

            const successJobs = result.filter(j => j.lastStatus === 'success');
            const failedJobs = result.filter(j => j.lastStatus === 'failed');

            expect(successJobs.length).toBeGreaterThan(0);
            expect(failedJobs.length).toBeGreaterThan(0);
        });
    });

    describe('fetchDevServices', () => {
        test('returns mock services', async () => {
            const result = await fetchDevServices();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(2);
        });

        test('services have required properties', async () => {
            const result = await fetchDevServices();

            result.forEach(svc => {
                expect(svc).toHaveProperty('name');
                expect(svc).toHaveProperty('port');
                expect(svc).toHaveProperty('status');
                expect(svc).toHaveProperty('url');
                expect(svc).toHaveProperty('started');
            });
        });
    });

    describe('restartGateway', () => {
        test('returns true in mock mode', async () => {
            // Mock mode should return true
            const result = await restartGateway();
            expect(result).toBe(true);
        });
    });

    describe('fetchAllData', () => {
        test('fetches all data in parallel', async () => {
            const result = await fetchAllData();

            expect(result).toHaveProperty('gateway');
            expect(result).toHaveProperty('agents');
            expect(result).toHaveProperty('cronJobs');
            expect(result).toHaveProperty('services');

            expect(Array.isArray(result.agents)).toBe(true);
            expect(Array.isArray(result.cronJobs)).toBe(true);
            expect(Array.isArray(result.services)).toBe(true);
        });
    });

    describe('getNetworkState', () => {
        test('returns state object', () => {
            const state = getNetworkState();

            expect(state).toHaveProperty('isOnline');
            expect(state).toHaveProperty('lastError');
            expect(state).toHaveProperty('retryCount');
        });
    });
});
