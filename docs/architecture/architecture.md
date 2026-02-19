# Ergo 架构设计文档（简化版）

> 版本: v1.1 | 日期: 2026-02-15
>
> 设计原则：DHH - 一个人高效工作，先跑起来再优化

---

## 一、核心问题

**为什么需要 Ergo？**

OpenClaw Dashboard 手机端难用 → Ergo 提供移动端优化的信息聚合页 + 快速入口

---

## 二、技术方案

### 最简方案：纯前端 + CORS 代理

```
┌──────────────┐
│   Browser    │
│   (Ergo)    │
└──────┬───────┘
       │ fetch
       ▼
┌──────────────┐     ┌─────────────────┐
│  CORS Proxy  │────▶│  Gateway API   │
│  (可选)      │     │  localhost:18789│
└──────────────┘     └─────────────────┘
```

**两种实现路径**：

| 路径 | 描述 | 复杂度 |
|------|------|--------|
| **A** | 直接请求 Gateway（如果支持 CORS） | ⭐ 最简 |
| **B** | 用 cpolar 的 API 隧道 | ⭐⭐ |
| **C** | 轻量 Node.js 代理 | ⭐⭐⭐ |

---

### 推荐的 MVP 实现

**路径 A → 失败就用路径 C**

```javascript
// 路径 A：直接请求（最理想）
const status = await fetch('http://localhost:18789/api/status');

// 路径 C：Node.js 代理（20 行）
// server.js
const http = require('http');
http.createServer((req, res) => {
    const url = 'http://127.0.0.1:18789' + req.url;
    req.pipe(http.request(url, res => res.pipe(res)), { end: true });
}).listen(18790);
```

---

## 三、MVP 功能范围

| 功能 | 实现 | 优先级 |
|------|------|--------|
| Gateway 状态显示 | `/api/status` | P0 |
| 跳转 Dashboard | 超链接 | P0 |
| 主题切换 | CSS Variables | P0 |
| Agent 状态 | 需 CLI Wrapper | P1 |
| 重启 Gateway | 需 CLI Wrapper | P2 |

---

## 四、技术栈（最简化）

| 层级 | 选型 |
|------|------|
| **前端** | Vanilla JS + CSS（单文件） |
| **状态** | 无，用 DOM 直接操作 |
| **后端** | 暂不需要，先用纯前端试试 |
| **代理** | 如需要，简单的 Node.js 脚本 |

---

## 五、下一步

1. **先试路径 A**：检查 Gateway 是否支持 CORS
2. **如不支持，用路径 C**：20 行 Node.js 代理
3. **前端直接开干**：用 design-system 的样式实现 prototype

---

## 六、文件结构

```
Ergo/
├── index.html          # 主页面（先在这里实现 MVP）
├── server.js           # 可选：轻量代理（如需要）
├── docs/
│   ├── prototype.html  # 已完成的设计稿
│   ├── design-system.md
│   └── cto/architecture.md
└── assets/logo.png
```

---

## 七、行动计划

**今天就可以开始**：

1. 检查 `http://localhost:18789/api/status` 能否直接请求
2. 能 → 直接在 index.html 实现
3. 不能 → 写 20 行 server.js 代理
4. 用 design-system 样式实现 UI
