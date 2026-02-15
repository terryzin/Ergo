/**
 * Jest Setup File
 * 配置测试环境
 */

// Mock localStorage
global.localStorage = {
    getItem: jest.fn(() => 'dark'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

// Mock window.matchMedia
global.window = {
    matchMedia: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    }))
};

// Mock document
const mockDocument = {
    getElementById: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    createElement: jest.fn(),
    addEventListener: jest.fn(),
    documentElement: {
        setAttribute: jest.fn(),
        getAttribute: jest.fn()
    }
};

global.document = mockDocument;

// Suppress console output during tests
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// Set default test timeout
jest.setTimeout(10000);
