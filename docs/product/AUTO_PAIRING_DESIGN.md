# OpenClaw 自动配对设计方案

## 问题定义

**当前痛点：**
- 每次新浏览器/设备访问 Ergo 都需要手动配对
- 配对流程繁琐，影响多端使用体验
- 移动端、平板、多浏览器场景下体验差

**用户期望：**
- 新端接入时自动完成配对
- 无需或仅需极简的手动操作
- 安全可靠，防止未授权访问

---

## Tech Stack 分析

### OpenClaw Gateway 认证机制

从 `openclaw gateway --help` 发现支持两种模式：

```bash
--auth <mode>              # "token" 或 "password"
--password <password>      # 密码模式
--token <token>            # Token 模式（默认使用 OPENCLAW_GATEWAY_TOKEN 环境变量）
```

**当前 Ergo 架构：**
```
浏览器 → Ergo 前端 (8081) → API Bridge (8082) → OpenClaw CLI → Gateway (18789)
```

关键点：
- ✅ API Bridge 已经处理了与 Gateway 的认证（通过 CLI）
- ✅ 前端不需要直接处理 Gateway token
- ❌ 但不同浏览器访问 Ergo 前端时，可能涉及其他认证需求

---

## 方案对比

### 方案 A：无认证模式（适合个人内网使用）⭐ 推荐

**原理：**
- Ergo 完全开放访问，无需认证
- 依赖网络隔离（内网 + cpolar）保证安全

**实现：**
- 无需任何代码改动
- 前端直接调用 API Bridge

**优点：**
- ✅ 最简单，零配置
- ✅ 多端无缝切换
- ✅ 适合个人使用

**缺点：**
- ❌ cpolar 公网地址完全开放（任何人知道 URL 都能访问）
- ❌ 不适合团队或公开场景

**适用场景：**
- 个人使用
- 内网环境
- 信任 cpolar 的访问控制

---

### 方案 B：预配置密钥（Cookie/LocalStorage 持久化）

**原理：**
- API Bridge 设置固定密钥
- 前端首次访问时自动获取并缓存
- 后续访问从缓存读取

**实现步骤：**

1. **后端（API Bridge）增加密钥验证：**
```javascript
const API_SECRET = process.env.ERGO_SECRET || 'default-secret-key';

app.use((req, res, next) => {
    const authHeader = req.headers['x-ergo-key'];
    if (authHeader !== API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});
```

2. **前端自动发送密钥：**
```javascript
// 从配置或 localStorage 读取
const ERGO_KEY = localStorage.getItem('ergoKey') || 'default-secret-key';

fetch(url, {
    headers: {
        'X-Ergo-Key': ERGO_KEY
    }
});
```

**优点：**
- ✅ 简单有效
- ✅ 一次配置，多端同步（如果使用云同步浏览器）
- ✅ 防止陌生人随意访问

**缺点：**
- ❌ 密钥泄露风险（存储在前端）
- ❌ 无法动态撤销单个设备

---

### 方案 C：一次性配对码（动态生成）

**原理：**
- 后端生成短期有效的配对码（如 6 位数字）
- 新设备首次访问时输入配对码
- 配对成功后分配持久 Session Token

**实现步骤：**

1. **后端生成配对码：**
```javascript
let pairingCode = null;
let pairingExpiry = null;

app.post('/api/pairing/generate', (req, res) => {
    pairingCode = Math.random().toString().slice(2, 8); // 6位数字
    pairingExpiry = Date.now() + 5 * 60 * 1000; // 5分钟有效

    console.log(`配对码: ${pairingCode} (5分钟内有效)`);

    res.json({ message: '配对码已生成，请查看服务器控制台' });
});

app.post('/api/pairing/pair', (req, res) => {
    const { code } = req.body;

    if (Date.now() > pairingExpiry) {
        return res.status(400).json({ error: '配对码已过期' });
    }

    if (code !== pairingCode) {
        return res.status(401).json({ error: '配对码错误' });
    }

    // 生成设备 token
    const deviceToken = crypto.randomUUID();
    deviceTokens.add(deviceToken);

    res.json({ token: deviceToken });
});
```

2. **前端配对流程：**
```javascript
// 检查是否已配对
let deviceToken = localStorage.getItem('ergoDeviceToken');

if (!deviceToken) {
    // 显示配对界面
    showPairingDialog();
}

async function doPairing(code) {
    const res = await fetch('/api/pairing/pair', {
        method: 'POST',
        body: JSON.stringify({ code })
    });

    const { token } = await res.json();
    localStorage.setItem('ergoDeviceToken', token);

    // 刷新页面
    location.reload();
}
```

**优点：**
- ✅ 安全性高
- ✅ 支持多设备管理
- ✅ 可以撤销单个设备

**缺点：**
- ❌ 需要一次手动配对
- ❌ 实现复杂度较高

---

### 方案 D：二维码扫码配对（移动端友好）

**原理：**
- PC 端生成带 token 的二维码
- 移动端扫码自动获取并保存 token

**实现步骤：**

1. **后端生成二维码数据：**
```javascript
const QRCode = require('qrcode');

app.get('/api/pairing/qrcode', async (req, res) => {
    const token = crypto.randomUUID();
    deviceTokens.add(token);

    const qrData = `ergo://pair?token=${token}`;
    const qrImage = await QRCode.toDataURL(qrData);

    res.json({ qrcode: qrImage, token });
});
```

2. **前端展示二维码：**
```html
<img id="qrcode" src="" />

<script>
fetch('/api/pairing/qrcode')
    .then(r => r.json())
    .then(data => {
        document.getElementById('qrcode').src = data.qrcode;
        localStorage.setItem('ergoDeviceToken', data.token);
    });
</script>
```

**优点：**
- ✅ 移动端体验最佳
- ✅ 可视化配对，不易出错

**缺点：**
- ❌ 需要二维码库
- ❌ PC 端无法扫码（需结合其他方案）

---

## 推荐方案 🎯

### 阶段 1：v1.3.0 - 预配置密钥（方案 B）

**原因：**
- 实现简单，1-2 小时完成
- 80% 场景够用（个人多端使用）
- 平衡安全性和便利性

**实现清单：**
- [ ] API Bridge 增加 `X-Ergo-Key` 验证
- [ ] 前端自动发送密钥
- [ ] 支持通过环境变量配置 `ERGO_SECRET`
- [ ] 设置页面支持修改密钥
- [ ] 文档更新

### 阶段 2：v1.4.0 - 一次性配对码（方案 C）

**原因：**
- 适合多用户、团队场景
- 支持设备管理和撤销
- 安全性更高

**实现清单：**
- [ ] 后端生成/验证配对码
- [ ] 前端配对界面（弹窗/独立页面）
- [ ] 设备列表管理
- [ ] 配对码过期机制
- [ ] 设备撤销功能

### 阶段 3：v1.5.0 - 二维码扫码（方案 D，可选）

**原因：**
- 移动端体验优化
- 视觉化配对流程

---

## 技术设计细节（v1.3.0）

### 1. 环境变量配置

**server/.env（新建）：**
```env
ERGO_SECRET=your-random-secret-key-here
PORT=8082
```

**启动脚本：**
```bash
# start-ergo.bat
@echo off
set ERGO_SECRET=your-secret-key
start "API Bridge" cmd /k "cd /d %~dp0 && node server/api-bridge.js"
start "Frontend" cmd /k "cd /d %~dp0 && npx http-server -p 8081"
```

### 2. 前端配置页面

**settings.html（新建）：**
```html
<div class="settings">
    <h2>设置</h2>
    <label>API 密钥：</label>
    <input type="password" id="apiKey" />
    <button onclick="saveKey()">保存</button>
</div>

<script>
function saveKey() {
    const key = document.getElementById('apiKey').value;
    localStorage.setItem('ergoKey', key);
    alert('密钥已保存');
}
</script>
```

### 3. 首次访问引导

**首页增加密钥检测：**
```javascript
async function checkAuthentication() {
    const key = localStorage.getItem('ergoKey');

    if (!key) {
        // 显示设置引导
        showWelcomeDialog();
        return false;
    }

    // 验证密钥是否有效
    const res = await fetch('/api/status', {
        headers: { 'X-Ergo-Key': key }
    });

    if (res.status === 401) {
        alert('密钥无效，请重新设置');
        showWelcomeDialog();
        return false;
    }

    return true;
}
```

---

## 安全性考虑

### 密钥强度
- 使用至少 32 字符的随机字符串
- 支持定期更换密钥

### 传输安全
- 使用 HTTPS（cpolar 默认支持）
- 密钥通过 Header 传输，不在 URL 中

### 存储安全
- 使用 `localStorage`（持久化）
- 可选：使用加密存储（v1.4+）

### 日志记录
- 记录配对时间和设备信息
- 支持查看已配对设备列表

---

## 用户体验流程

### 首次访问（新设备）

```
1. 访问 http://localhost:8081
   ↓
2. 检测到无密钥，显示欢迎页
   ↓
3. 用户输入密钥（或使用默认密钥）
   ↓
4. 验证成功，保存到 localStorage
   ↓
5. 进入主页
```

### 后续访问（已配对设备）

```
1. 访问 http://localhost:8081
   ↓
2. 自动从 localStorage 读取密钥
   ↓
3. 静默验证通过
   ↓
4. 直接进入主页（无感知）
```

---

## 实施计划（v1.3.0）

### 工作量评估
- 后端改造：1-2 小时
- 前端改造：2-3 小时
- 测试验证：1 小时
- 文档更新：30 分钟

**总计：4-6 小时**

### 优先级
**P0（必须）：**
- ✅ API Bridge 密钥验证
- ✅ 前端自动发送密钥
- ✅ 错误处理（401 提示）

**P1（重要）：**
- ✅ 设置页面
- ✅ 首次访问引导
- ✅ 环境变量配置

**P2（可选）：**
- ⚪ 密钥强度检测
- ⚪ 配对历史记录
- ⚪ 多密钥支持（团队模式）

---

## 替代方案：完全开放（方案 A）

如果您的使用场景满足以下条件，可以直接跳过认证：

1. ✅ 仅个人使用
2. ✅ 不在公共网络环境
3. ✅ cpolar URL 不会泄露

**无需任何开发工作，当前架构已经满足需求。**

---

## 下一步行动

请选择实施方案：

**A. 无认证模式**（当前状态，适合个人使用）
- 无需开发，现状即可

**B. 预配置密钥**（推荐 v1.3.0）
- 开发周期：4-6 小时
- 安全性：⭐⭐⭐⚪⚪
- 易用性：⭐⭐⭐⭐⭐

**C. 一次性配对码**（v1.4.0）
- 开发周期：8-12 小时
- 安全性：⭐⭐⭐⭐⭐
- 易用性：⭐⭐⭐⭐⚪

**D. 二维码扫码**（v1.5.0，可选）
- 开发周期：6-8 小时
- 安全性：⭐⭐⭐⭐⚪
- 易用性：⭐⭐⭐⭐⭐（移动端）

---

**作者**：Claude (Ergo 全栈工程师 Agent)
**日期**：2026-02-20
**版本**：v1.0
