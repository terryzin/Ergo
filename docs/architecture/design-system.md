# Ergo 设计系统 v1.0

> 基于 Apple Human Interface Guidelines 与 Material Design 原则
> 维护者: UI Design Agent (Matías Duarte 思维模型)

---

## 1. 设计原则

### 1.1 核心价值观

| 原则 | 描述 | 实践 |
|------|------|------|
| **Bold** | 大胆醒目 | 排版优先，关键信息使用大字号和高对比度 |
| **Graphic** | 图形化 | 用视觉元素传达信息，颜色和图标语义化 |
| **Intentional** | 有意图 | 每个视觉元素都有存在的理由 |
| **Material** | 材质感 | 借用量世界规律，elevation 传达层级 |

### 1.2 设计目标

- **移动优先**: 最小触摸区域 44×44pt
- **多主题**: 支持浅色/深色/自动三种模式
- **无障碍**: WCAG 2.1 AA 级对比度
- **一致性**: 相同场景使用相同模式

---

## 2. 色彩系统

### 2.1 语义色彩

```css
:root {
    /* 品牌色 */
    --brand: #0071E3;        /* 主色 - 链接、按钮、重点 */
    --brand-light: #2997FF;  /* 浅色变体 */
    --brand-bg: rgba(0, 113, 227, 0.08);  /* 品牌背景色 */

    /* 状态色 */
    --ok: #34C759;           /* 成功/在线 */
    --ok-bg: rgba(52,199,89, 0.10);
    --err: #FF3B30;          /* 错误/离线 */
    --err-bg: rgba(255,59,48, 0.10);
    --warn: #FF9500;         /* 警告 */
    --warn-bg: rgba(255,149,0, 0.10);
}
```

### 2.2 浅色主题 (Light)

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-page` | `#F5F5F7` | 页面背景 |
| `--bg-card` | `rgba(255,255,255, 0.85)` | 卡片背景 (毛玻璃) |
| `--bg-card-solid` | `#FFFFFF` | 纯色卡片 |
| `--bg-card-hover` | `rgba(255,255,255, 1)` | 卡片悬停 |
| `--bg-elevated` | `rgba(255,255,255, 0.85)` | 浮层/弹窗 |
| `--bg-inset` | `rgba(0,0,0, 0.03)` | 内嵌区域 |
| `--text-1` | `#000000` | 主要文字 |
| `--text-2` | `#3D3D3D` | 次要文字 |
| `--text-3` | `#767676` | 辅助/禁用文字 |
| `--border` | `rgba(0,0,0, 0.06)` | 边框 |
| `--border-vivid` | `rgba(0,0,0, 0.1)` | 强调边框 |

### 2.3 深色主题 (Dark)

```css
@media (prefers-color-scheme: dark),
       [data-theme="dark"] {
    :root {
        --bg-page: #000000;
        --bg-card: rgba(28,28,30, 0.72);
        --bg-card-solid: #1C1C1E;
        --bg-card-hover: rgba(44,44,46, 0.85);
        --bg-elevated: rgba(44,44,46, 0.82);
        --bg-inset: rgba(255,255,255, 0.04);
        --text-1: #F5F5F7;
        --text-2: #8E8E93;
        --text-3: #48484A;
        --border: rgba(255,255,255, 0.06);
        --border-vivid: rgba(255,255,255, 0.1);
    }
}
```

### 2.4 对比度要求

| 场景 | 最小对比度 | 实践 |
|------|------------|------|
| 主要文字 | 4.5:1 | `--text-1` on `--bg-card` |
| 次要文字 | 3:1 | `--text-2` on `--bg-card` |
| 大字号文字 | 3:1 | 18pt+ 文字 |
| 组件边界 | 1.5:1 | `--border-vivid` |

---

## 3. 排版系统

### 3.1 字体栈

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
```

### 3.2 字号层级

| Token |字号|行高|字重|用途|
|-------|-----|-----|-----|------|
| `--text-xs` | 12px | 1.4 | 400 | 标签、徽标 |
| `--text-sm` | 14px | 1.5 | 400 | 辅助说明 |
| `--text-base` | 16px | 1.5 | 400 | 正文 |
| `--text-lg` | 18px | 1.4 | 500 | 小标题 |
| `--text-xl` | 22px | 1.3 | 600 | 卡片标题 |
| `--text-2xl` | 28px | 1.2 | 700 | 页面标题 |
| `--text-3xl` | 34px | 1.1 | 700 | Hero 文字 |

### 3.3 行长规范

- **最大行长**: 60ch (约 60 个字符)
- **移动端**: 100% 宽度，左右留白 16px

---

## 4. 间距系统

### 4.1 基础网格

基于 4px 网格:

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-1` | 4px | 紧凑间距 |
| `--space-2` | 8px | 组件内间距 |
| `--space-3` | 12px | 组件间距 |
| `--space-4` | 16px | 卡片内边距 |
| `--space-5` | 20px | 卡片间距 |
| `--space-6` | 24px | 区块间距 |
| `--space-8` | 32px | 区域间距 |
| `--space-10`| 40px | 大间距 |
| `--space-12`| 48px | 章节间距 |

### 4.2 移动端安全区

```css
:root {
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left: env(safe-area-inset-left, 0px);
    --safe-right: env(safe-area-inset-right, 0px);
}
```

---

## 5. 组件库

### 5.1 卡片 (Card)

```css
.card {
    background: var(--bg-card);
    backdrop-filter: var(--glass-blur);
    border-radius: 20px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    padding: var(--space-4);
    transition: background 0.2s, box-shadow 0.2s;
}
.card:hover {
    background: var(--bg-card-hover);
    box-shadow: var(--shadow-lg);
}
```

### 5.2 按钮 (Button)

**主按钮**:
```css
.btn-primary {
    background: var(--brand);
    color: #FFFFFF;
    border-radius: 12px;
    padding: 12px 24px;
    font-weight: 600;
    min-height: 44px;
}
.btn-primary:active {
    opacity: 0.8;
    transform: scale(0.98);
}
```

**次按钮**:
```css
.btn-secondary {
    background: var(--bg-inset);
    color: var(--text-1);
    border-radius: 12px;
    padding: 12px 24px;
    font-weight: 500;
    min-height: 44px;
}
```

### 5.3 列表行 (List Row)

```css
.list-row {
    display: flex;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    min-height: 44px;
    cursor: pointer;
}
.list-row:active {
    background: var(--bg-inset);
}
```

### 5.4 状态指示器 (Status Pill)

```css
.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: 500;
}
.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: pulse 2s infinite;
}
@keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 currentColor; }
    50% { box-shadow: 0 0 6px 2px currentColor; }
}
```

### 5.5 动作面板 (Action Sheet)

```css
.action-sheet {
    position: fixed;
    bottom: calc(var(--safe-bottom) + 20px);
    left: 16px;
    right: 16px;
    background: var(--bg-elevated);
    backdrop-filter: var(--glass-blur);
    border-radius: 20px;
    overflow: hidden;
    animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.action-cancel {
    margin-top: 8px;
    border-radius: 20px;
}
```

---

## 6. Elevation 系统

### 6.1 阴影层级

| 层级 | Token | 效果 |
|------|-------|------|
| 0 | `--shadow-none` | 无阴影 |
| 1 | `--shadow-sm` | 卡片轻微浮起 |
| 2 | `--shadow-md` | 卡片正常状态 |
| 3 | `--shadow-lg` | 悬停/浮层 |

### 6.2 阴影值

**浅色主题**:
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04);
--shadow-md: 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
--shadow-lg: 0 4px 8px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.08);
```

**深色主题**:
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
--shadow-md: 0 2px 4px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.25);
--shadow-lg: 0 4px 8px rgba(0,0,0,0.25), 0 16px 48px rgba(0,0,0,0.3);
```

---

## 7. 动效系统

### 7.1 时长规范

| Token | 值 | 用途 |
|-------|-----|------|
| `--duration-fast` | 150ms | 按钮点击、微交互 |
| `--duration-base` | 200ms | 状态变化 |
| `--duration-slow` | 300ms | 面板展开、页面过渡 |

### 7.2 缓动函数

```css
--ease-out: cubic-bezier(0.32, 0.72, 0, 1);  /* 苹果风格 */
--ease-in-out: cubic-bezier(0.32, 0.72, 0.48, 1);
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);  /* 弹性效果 */
```

### 7.3 典型动效

**面板展开**:
```css
.panel {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows var(--duration-slow) var(--ease-out);
}
.panel.open {
    grid-template-rows: 1fr;
}
.panel-inner {
    overflow: hidden;
}
```

**Toast 通知**:
```css
.toast {
    animation: toastIn 0.3s var(--ease-spring),
               toastOut 0.2s var(--ease-out) 2.5s forwards;
}
@keyframes toastIn {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
```

---

## 8. 响应式断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| `sm` | 375px+ | 单列、移动端默认 |
| `md` | 768px+ | 双列、指标卡片 |
| `lg` | 1024px+ | 桌面端、侧边栏 |
| `xl` | 1280px+ | 宽屏布局 |

---

## 9. 无障碍规范

### 9.1 触摸目标

- 最小尺寸: 44×44pt (移动端)
- 间距: 至少 8px

### 9.2 焦点管理

```css
:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
}
```

### 9.3 语义化

- 按钮使用 `<button>`
- 链接使用 `<a>`
- 列表使用 `<ul>/<li>`
- 图片包含 `alt` 属性

---

## 10. 文件结构

```
docs/
├── ui/
│   └── design-system.md    # 本文件
├── prototype.html          # 交互原型
├── PRD.md                  # 产品需求
└── design/
    └── ergo-logo.png       # 品牌标识
```

---

## 11. 更新日志

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-02-15 | 初始版本 |
