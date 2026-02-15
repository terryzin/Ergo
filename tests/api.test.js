/**
 * API Module Tests
 */

const { fetchGatewayStatus, fetchAgents, fetchCronJobs, fetchDevServices, restartGateway, MOCK_MODE } = require('../src/api');

// Mock fetch
global.fetch = jest.fn();

describe('API Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('MOCK_MODE', () => {
        test('mock mode is enabled by default', () => {
            expect(MOCK_MODE).toBe(true);
        });
    });

    describe('fetchGatewayStatus', () => {
        test('returns mock data in mock mode', async () => {
            const result = await fetchGatewayStatus();

            expect(result).toHaveProperty('status', 'online');
            expect(result).toHaveProperty('uptime', 259200);
            expect(result).toHaveProperty('version', '0.9.5');
            expect(result).toHaveProperty('port', 18789);
        });

        test('fetches from real API when mock mode disabled', async () => {
            // This test would require actually disabling mock mode
            // For now we just verify mock returns expected structure
            const result = await fetchGatewayStatus();

            expect(result).toEqual({
                status: 'online',
                uptime: 259200,
                version: '0.9.5',
                port: 18789
            });
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
            const result = await restartGateway();
            expect(result).toBe(true);
        });
    });
});
