/**
 * Ergo 全局配置
 *
 * 自动检测运行环境并选择正确的 API 地址：
 * - 本地开发：http://localhost:8082
 * - 外网访问：使用当前域名（通过前端代理转发到 API Bridge）
 */

class ErgoConfig {
    constructor() {
        this.API_KEY = 'ergo-default-secret-key-2026';
        this.API_BASE = this.detectApiBase();
    }

    /**
     * 自动检测 API Base URL
     *
     * 规则：
     * 1. 如果 hostname 是 localhost 或 127.0.0.1，使用 http://localhost:8082
     * 2. 如果是外网域名（cpolar.top），使用 API Bridge 隧道域名
     * 3. 其他域名使用相对路径（由前端代理转发）
     */
    detectApiBase() {
        const hostname = window.location.hostname;

        // 本地开发环境
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8082';
        }

        // 外网访问（cpolar 域名）- 使用 API Bridge 隧道
        if (hostname.includes('cpolar.top')) {
            // 临时隧道域名（TODO: 在 Web UI 启动保留域名后改为 https://terryapi.cpolar.top）
            return 'https://737b33c9.r35.cpolar.top';
        }

        // 其他域名 - 相对路径（由前端代理转发）
        return '';
    }

    /**
     * 获取 API Key
     * 优先从 localStorage 读取，否则使用默认值
     */
    getApiKey() {
        return localStorage.getItem('ergoApiKey') || this.API_KEY;
    }

    /**
     * 设置 API Key
     */
    setApiKey(key) {
        localStorage.setItem('ergoApiKey', key);
        this.API_KEY = key;
    }

    /**
     * 获取完整的 API URL
     */
    getApiUrl(path) {
        // 确保 path 以 / 开头
        const cleanPath = path.startsWith('/') ? path : `/${path}`;

        // 如果是本地环境，返回完整 URL
        if (this.API_BASE) {
            return `${this.API_BASE}${cleanPath}`;
        }

        // 外网环境，返回相对路径
        return cleanPath;
    }

    /**
     * 获取当前环境信息（调试用）
     */
    getEnvironmentInfo() {
        return {
            hostname: window.location.hostname,
            apiBase: this.API_BASE,
            isLocal: this.API_BASE !== '',
            apiKey: this.API_KEY.substring(0, 10) + '...' // 安全显示
        };
    }
}

// 创建全局单例
const ergoConfig = new ErgoConfig();

// 在控制台显示环境信息（调试用）
console.log('[Ergo Config]', ergoConfig.getEnvironmentInfo());

// 导出配置对象
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ergoConfig;
}
