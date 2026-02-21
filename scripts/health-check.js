#!/usr/bin/env node
/**
 * Ergo 健康检查脚本
 *
 * 功能：
 * - 检查所有关键服务状态
 * - 验证 API 连接
 * - 输出诊断信息
 *
 * 使用方法：
 *   node scripts/health-check.js
 *   npm run health-check
 */

const http = require('http');
const https = require('https');

// 从环境变量或默认配置读取
const config = {
    frontend: {
        host: 'localhost',
        port: process.env.PORT || 8081,
        name: 'Ergo Frontend'
    },
    apiBridge: {
        host: 'localhost',
        port: process.env.API_BRIDGE_PORT || 8082,
        name: 'API Bridge'
    },
    gateway: {
        host: 'localhost',
        port: process.env.OPENCLAW_GATEWAY_PORT || 18789,
        name: 'OpenClaw Gateway'
    }
};

// ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m'
};

/**
 * 检查 HTTP 服务是否运行
 */
function checkService(service) {
    return new Promise((resolve) => {
        const options = {
            hostname: service.host,
            port: service.port,
            path: '/api/status',
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            resolve({
                name: service.name,
                host: service.host,
                port: service.port,
                status: 'online',
                statusCode: res.statusCode,
                ok: res.statusCode >= 200 && res.statusCode < 400
            });
        });

        req.on('error', (err) => {
            resolve({
                name: service.name,
                host: service.host,
                port: service.port,
                status: 'offline',
                error: err.message,
                ok: false
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                name: service.name,
                host: service.host,
                port: service.port,
                status: 'timeout',
                error: 'Request timeout',
                ok: false
            });
        });

        req.end();
    });
}

/**
 * 检查 Cpolar 隧道状态
 */
function checkCpolarTunnel(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'HEAD',
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            resolve({
                url,
                status: 'online',
                statusCode: res.statusCode,
                ok: res.statusCode >= 200 && res.statusCode < 500
            });
        });

        req.on('error', (err) => {
            resolve({
                url,
                status: 'offline',
                error: err.message,
                ok: false
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                url,
                status: 'timeout',
                error: 'Request timeout',
                ok: false
            });
        });

        req.end();
    });
}

/**
 * 格式化检查结果
 */
function formatResult(result) {
    const status = result.ok
        ? `${colors.green}✓ ONLINE${colors.reset}`
        : `${colors.red}✗ OFFLINE${colors.reset}`;

    const details = result.statusCode
        ? `(HTTP ${result.statusCode})`
        : result.error
        ? `(${result.error})`
        : '';

    const endpoint = result.host
        ? `http://${result.host}:${result.port}`
        : result.url;

    return `${status} ${colors.blue}${result.name || endpoint}${colors.reset} ${colors.gray}${details}${colors.reset}`;
}

/**
 * 主函数
 */
async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║        Ergo 健康检查                      ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    // 检查本地服务
    console.log(`${colors.yellow}[本地服务]${colors.reset}`);
    const frontendResult = await checkService(config.frontend);
    console.log(`  ${formatResult(frontendResult)}`);

    const apiBridgeResult = await checkService(config.apiBridge);
    console.log(`  ${formatResult(apiBridgeResult)}`);

    const gatewayResult = await checkService(config.gateway);
    console.log(`  ${formatResult(gatewayResult)}`);

    console.log('');

    // 检查 Cpolar 隧道（如果配置了）
    const cpolarFrontend = process.env.CPOLAR_FRONTEND_URL;
    const cpolarGateway = process.env.CPOLAR_GATEWAY_URL;

    if (cpolarFrontend || cpolarGateway) {
        console.log(`${colors.yellow}[Cpolar 隧道]${colors.reset}`);

        if (cpolarFrontend) {
            const result = await checkCpolarTunnel(cpolarFrontend);
            console.log(`  ${formatResult(result)}`);
        }

        if (cpolarGateway) {
            const result = await checkCpolarTunnel(cpolarGateway);
            console.log(`  ${formatResult(result)}`);
        }

        console.log('');
    }

    // 汇总结果
    const allResults = [frontendResult, apiBridgeResult, gatewayResult];
    const allOk = allResults.every(r => r.ok);

    console.log('╔════════════════════════════════════════════╗');
    if (allOk) {
        console.log(`║  ${colors.green}✓ 所有服务运行正常${colors.reset}                    ║`);
    } else {
        console.log(`║  ${colors.red}✗ 部分服务异常${colors.reset}                        ║`);
        console.log('╠════════════════════════════════════════════╣');
        console.log('║  故障排查建议：                           ║');
        console.log('║  1. 检查 .env 配置                        ║');
        console.log('║  2. 运行 npm run start:all                ║');
        console.log('║  3. 查看服务日志                          ║');
    }
    console.log('╚════════════════════════════════════════════╝');

    // 退出码
    process.exit(allOk ? 0 : 1);
}

// 运行
main().catch((err) => {
    console.error(`${colors.red}[FATAL ERROR]${colors.reset}`, err);
    process.exit(1);
});
