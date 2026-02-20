/**
 * Ergo Notifications - 浏览器通知管理
 * 用于异常实时提醒、服务停止通知等
 *
 * @version 1.5.0
 * @author Ergo Team
 */

class NotificationManager {
    constructor() {
        this.notificationSent = new Map(); // 通知去重缓存
        this.dedupeWindow = 5 * 60 * 1000; // 5 分钟内同类通知只发一次
        this.enabled = false;
    }

    /**
     * 请求通知权限
     * @returns {Promise<boolean>}
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('[Notifications] Browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.enabled = true;
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            this.enabled = permission === 'granted';
            return this.enabled;
        }

        console.warn('[Notifications] Permission denied by user');
        return false;
    }

    /**
     * 检查通知是否已启用
     * @returns {boolean}
     */
    isEnabled() {
        return this.enabled && Notification.permission === 'granted';
    }

    /**
     * 发送通知
     * @param {string} title - 通知标题
     * @param {object} options - 通知选项
     * @returns {Notification|null}
     */
    send(title, options = {}) {
        if (!this.isEnabled()) {
            console.log('[Notifications] Not enabled or permission not granted');
            return null;
        }

        // 去重检查
        const tag = options.tag || title;
        const now = Date.now();
        const lastSent = this.notificationSent.get(tag);

        if (lastSent && now - lastSent < this.dedupeWindow) {
            console.log(`[Notifications] Skipped duplicate notification: "${tag}" (${Math.floor((now - lastSent) / 1000)}s ago)`);
            return null;
        }

        // 创建通知
        const notification = new Notification(title, {
            icon: options.icon || '/assets/logo.png',
            badge: options.badge || '/assets/logo.png',
            body: options.body || '',
            tag: tag,
            requireInteraction: options.requireInteraction || false,
            silent: options.silent || false,
            data: options.data || {},
            ...options
        });

        // 记录发送时间
        this.notificationSent.set(tag, now);

        // 点击跳转
        notification.onclick = () => {
            window.focus();

            if (options.onClick) {
                options.onClick(notification);
            } else if (options.data?.url) {
                window.location.href = options.data.url;
            } else if (options.data?.projectId) {
                window.location.href = `docs/archive/project.html?id=${options.data.projectId}`;
            }

            notification.close();
        };

        // 自动关闭事件
        if (options.autoClose) {
            setTimeout(() => {
                notification.close();
            }, options.autoClose);
        }

        console.log(`[Notifications] Sent: "${title}"`);
        return notification;
    }

    /**
     * 项目健康度下降通知
     * @param {object} project - 项目信息
     */
    notifyHealthDegradation(project) {
        const { id, name, health } = project;

        let title = '⚠️ 项目异常';
        let body = `项目 "${name}" `;

        switch (health?.overall) {
            case 'unhealthy':
                title = '❌ 项目严重异常';
                body += '出现严重问题，请立即处理！';
                break;
            case 'degraded':
                body += '健康度下降，建议检查。';
                break;
            default:
                return; // 健康状态正常，不发送通知
        }

        this.send(title, {
            body,
            tag: `health-${id}`,
            requireInteraction: true,
            data: { projectId: id, type: 'health' },
            icon: '/assets/logo.png'
        });
    }

    /**
     * 服务停止通知
     * @param {object} project - 项目信息
     * @param {array} stoppedServices - 停止的服务列表
     */
    notifyServicesStopped(project, stoppedServices) {
        if (!stoppedServices || stoppedServices.length === 0) return;

        const { id, name } = project;
        const serviceNames = stoppedServices.map(s => s.name).join(', ');

        this.send('🛑 服务停止', {
            body: `项目 "${name}" 中的服务已停止：${serviceNames}`,
            tag: `services-${id}`,
            requireInteraction: true,
            data: { projectId: id, type: 'services' }
        });
    }

    /**
     * Gateway 离线通知
     */
    notifyGatewayOffline() {
        this.send('❌ Gateway 离线', {
            body: 'OpenClaw Gateway 连接失败，请检查服务状态',
            tag: 'gateway-offline',
            requireInteraction: true,
            data: { url: 'index.html', type: 'gateway' }
        });
    }

    /**
     * Gateway 恢复通知
     */
    notifyGatewayOnline() {
        this.send('✅ Gateway 已恢复', {
            body: 'OpenClaw Gateway 已重新连接',
            tag: 'gateway-online',
            autoClose: 5000,
            data: { type: 'gateway' }
        });
    }

    /**
     * Cron 任务失败通知
     * @param {object} job - 任务信息
     */
    notifyCronFailed(job) {
        this.send('⏰ 定时任务失败', {
            body: `任务 "${job.name}" 执行失败`,
            tag: `cron-${job.id}`,
            data: { type: 'cron', jobId: job.id }
        });
    }

    /**
     * 通用成功通知（自动关闭）
     * @param {string} message - 消息内容
     */
    notifySuccess(message) {
        this.send('✅ 操作成功', {
            body: message,
            tag: 'success',
            autoClose: 3000
        });
    }

    /**
     * 通用错误通知
     * @param {string} message - 错误信息
     */
    notifyError(message) {
        this.send('❌ 操作失败', {
            body: message,
            tag: 'error',
            requireInteraction: false,
            autoClose: 5000
        });
    }

    /**
     * 清理过期的去重缓存
     */
    cleanupCache() {
        const now = Date.now();
        for (const [tag, timestamp] of this.notificationSent.entries()) {
            if (now - timestamp > this.dedupeWindow) {
                this.notificationSent.delete(tag);
            }
        }
    }

    /**
     * 启动定期清理
     */
    startCleanup() {
        // 每 5 分钟清理一次过期缓存
        setInterval(() => {
            this.cleanupCache();
        }, this.dedupeWindow);
    }
}

// 导出（支持 CommonJS 和 ES Module）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}
