/**
 * Ergo Realtime Service - WebSocket 客户端
 * 用于与 API Bridge Server 建立实时连接
 * 支持自动重连、心跳检测、事件监听
 *
 * @version 1.5.0
 * @author Ergo Team
 */

class RealtimeService {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 初始重连延迟 1 秒
        this.listeners = new Map();
        this.heartbeatTimer = null;
        this.reconnectTimer = null;
        this.isManualClose = false;
    }

    /**
     * 建立 WebSocket 连接
     */
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[Realtime] Already connected');
            return;
        }

        console.log('[Realtime] Connecting to', this.url);
        this.isManualClose = false;

        try {
            this.ws = new WebSocket(this.url);
        } catch (error) {
            console.error('[Realtime]WebSocket creation failed:', error);
            this.emit('error', error);
            this.scheduleReconnect();
            return;
        }

        // 连接成功
        this.ws.onopen = () => {
            console.log('[Realtime] ✅ Connected');
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            this.emit('connected');
            this.startHeartbeat();
        };

        // 接收消息
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('[Realtime] Invalid message:', error);
            }
        };

        // 连接错误
        this.ws.onerror = (error) => {
            console.error('[Realtime] Connection error:', error);
            this.emit('error', error);
        };

        // 连接关闭
        this.ws.onclose = (event) => {
            console.log('[Realtime] Disconnected', event.code, event.reason);
            this.stopHeartbeat();
            this.emit('disconnected');

            if (!this.isManualClose) {
                this.scheduleReconnect();
            }
        };
    }

    /**
     * 处理接收到的消息
     */
    handleMessage(data) {
        const { type, payload } = data;

        // 内部消息处理
        switch (type) {
            case 'heartbeat':
                // 收到心跳，无需处理
                break;

            case 'connected':
                console.log('[Realtime] Welcome message:', payload.message);
                break;

            default:
                // 触发事件
                this.emit(type, payload);
        }
    }

    /**
     * 自动重连
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[Realtime] ❌ Max reconnect attempts reached');
            this.emit('reconnect-failed');
            return;
        }

        this.reconnectAttempts++;

        // 指数退避算法
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        const jitter = Math.random() * 1000; // 随机延迟 0-1 秒（避免同时重连）
        const finalDelay = Math.min(delay + jitter, 30000); // 最大 30 秒

        console.log(`[Realtime] Reconnecting in ${Math.floor(finalDelay / 1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, finalDelay);
    }

    /**
     * 启动心跳检测（30 秒）
     */
    startHeartbeat() {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send('ping', {});
            }
        }, 30000); // 30 秒
    }

    /**
     * 停止心跳检测
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * 监听事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * 移除事件监听
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数（可选，不传则移除所有）
     */
    off(event, callback) {
        if (!callback) {
            this.listeners.delete(event);
            return;
        }

        const callbacks = this.listeners.get(event) || [];
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {any} data - 事件数据
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => {
            try {
                cb(data);
            } catch (error) {
                console.error(`[Realtime] Error in event handler "${event}":`, error);
            }
        });
    }

    /**
     * 发送消息
     * @param {string} type - 消息类型
     * @param {any} payload - 消息数据
     */
    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type, payload });
            this.ws.send(message);
        } else {
            console.warn('[Realtime] Cannot send message: not connected');
        }
    }

    /**
     * 手动断开连接
     */
    disconnect() {
        console.log('[Realtime] Manual disconnect');
        this.isManualClose = true;
        this.stopHeartbeat();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * 获取连接状态
     * @returns {string} - 'connecting' | 'open' | 'closing' | 'closed'
     */
    getState() {
        if (!this.ws) return 'closed';

        switch (this.ws.readyState) {
            case WebSocket.CONNECTING:
                return 'connecting';
            case WebSocket.OPEN:
                return 'open';
            case WebSocket.CLOSING:
                return 'closing';
            case WebSocket.CLOSED:
                return 'closed';
            default:
                return 'unknown';
        }
    }

    /**
     * 检查是否已连接
     * @returns {boolean}
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}

// 导出（支持 CommonJS 和 ES Module）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealtimeService;
}
