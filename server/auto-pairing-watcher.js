#!/usr/bin/env node
/**
 * OpenClaw 自动配对监听器
 *
 * 功能：
 * - 定期检查 pending devices
 * - 自动审批新设备
 * - 记录审批日志
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// 配置
const CHECK_INTERVAL = parseInt(process.env.PAIRING_CHECK_INTERVAL) || 10000; // 10秒
const AUTO_APPROVE = process.env.AUTO_APPROVE !== 'false'; // 默认启用
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // debug, info, warn, error

// 日志函数
function log(level, message, data = null) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[LOG_LEVEL] || 1;

    if (levels[level] >= currentLevel) {
        const timestamp = new Date().toISOString();
        const prefix = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌'
        }[level] || '';

        console.log(`[${timestamp}] ${prefix} ${message}`);
        if (data && level === 'debug') {
            console.log(JSON.stringify(data, null, 2));
        }
    }
}

/**
 * 获取待审批设备列表
 */
async function getPendingDevices() {
    try {
        const { stdout } = await execAsync('openclaw devices list --json 2>&1', {
            timeout: 15000,
            maxBuffer: 2 * 1024 * 1024
        });

        // 解析 JSON（跳过 ANSI 代码和警告）
        const jsonStart = stdout.indexOf('\n{');
        if (jsonStart === -1) {
            const altStart = stdout.indexOf('{');
            if (altStart === -1) throw new Error('No JSON found in output');
            const data = JSON.parse(stdout.substring(altStart));
            return data.pending || [];
        }

        const jsonStr = stdout.substring(jsonStart + 1);
        const data = JSON.parse(jsonStr);
        return data.pending || [];
    } catch (error) {
        log('error', `Failed to get pending devices: ${error.message}`);
        return [];
    }
}

/**
 * 审批设备
 */
async function approveDevice(requestId) {
    try {
        log('info', `Approving device: ${requestId}`);

        const { stdout } = await execAsync(
            `openclaw devices approve ${requestId} --json 2>&1`,
            { timeout: 15000 }
        );

        // 解析结果
        const jsonStart = stdout.indexOf('\n{');
        if (jsonStart !== -1) {
            const jsonStr = stdout.substring(jsonStart + 1);
            const result = JSON.parse(jsonStr);
            log('info', `✅ Device approved: ${result.device?.deviceId?.substring(0, 8)}... (${result.device?.platform})`);
            return result;
        }

        log('warn', 'Device approved but no JSON response');
        return { success: true };
    } catch (error) {
        log('error', `Failed to approve device ${requestId}: ${error.message}`);
        return null;
    }
}

/**
 * 主循环：检查并审批设备
 */
async function checkAndApprove() {
    try {
        const pending = await getPendingDevices();

        if (pending.length === 0) {
            log('debug', 'No pending devices');
            return;
        }

        log('info', `Found ${pending.length} pending device(s)`);

        if (AUTO_APPROVE) {
            for (const device of pending) {
                log('info', `Pending device: ${device.deviceId.substring(0, 8)}... (${device.platform}, ${device.clientId})`);
                await approveDevice(device.requestId);
                // 等待一下，避免并发问题
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            log('warn', 'Auto-approve is disabled. Manual approval required.');
            pending.forEach(device => {
                log('info', `  - ${device.deviceId.substring(0, 8)}... (${device.platform}, ${device.clientId})`);
            });
        }
    } catch (error) {
        log('error', `Check and approve failed: ${error.message}`);
    }
}

/**
 * 启动监听器
 */
async function start() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   OpenClaw Auto-Pairing Watcher          ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   Check Interval: ${CHECK_INTERVAL / 1000}s                   ║`);
    console.log(`║   Auto Approve: ${AUTO_APPROVE ? 'Enabled ✓' : 'Disabled'}            ║`);
    console.log(`║   Log Level: ${LOG_LEVEL}                        ║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    log('info', 'Watcher started. Press Ctrl+C to stop.');
    console.log('');

    // 立即执行一次
    await checkAndApprove();

    // 定期检查
    setInterval(async () => {
        await checkAndApprove();
    }, CHECK_INTERVAL);
}

// 优雅退出
process.on('SIGINT', () => {
    console.log('');
    log('info', 'Watcher stopped.');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('info', 'Watcher stopped (SIGTERM).');
    process.exit(0);
});

// 异常处理
process.on('uncaughtException', (error) => {
    log('error', `Uncaught exception: ${error.message}`);
    console.error(error);
});

process.on('unhandledRejection', (reason) => {
    log('error', `Unhandled rejection: ${reason}`);
});

// 启动
if (require.main === module) {
    start().catch(error => {
        log('error', `Failed to start watcher: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { getPendingDevices, approveDevice, checkAndApprove };
