/**
 * @jest-environment jsdom
 */

// These tests focus on pure functions without DOM dependencies

const { formatUptime } = require('../src/app');

describe('formatUptime', () => {
    test('formats days correctly', () => {
        expect(formatUptime(172800)).toBe('2天0时'); // 2 days
        expect(formatUptime(90000)).toBe('1天1时'); // 1 day 1 hour
    });

    test('formats hours and minutes correctly', () => {
        expect(formatUptime(3660)).toBe('1时1分'); // 1 hour 1 minute
        expect(formatUptime(7200)).toBe('2时0分'); // 2 hours
        expect(formatUptime(5400)).toBe('1时30分'); // 1 hour 30 minutes
    });

    test('formats minutes only (seconds are ignored)', () => {
        // formatUptime truncates seconds, so 59s = 0 mins
        expect(formatUptime(59)).toBe('0分钟');
        expect(formatUptime(120)).toBe('2分钟');
        expect(formatUptime(180)).toBe('3分钟');
    });

    test('handles zero', () => {
        expect(formatUptime(0)).toBe('0分钟');
    });

    test('handles large values', () => {
        expect(formatUptime(604800)).toBe('7天0时'); // 7 days
        expect(formatUptime(2592000)).toBe('30天0时'); // 30 days
    });

    test('boundary cases', () => {
        // 1 minute exactly
        expect(formatUptime(60)).toBe('1分钟');
        // 1 hour exactly
        expect(formatUptime(3600)).toBe('1时0分');
        // 1 day exactly
        expect(formatUptime(86400)).toBe('1天0时');
    });
});
