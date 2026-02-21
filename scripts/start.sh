#!/usr/bin/env bash
# ============================
# Ergo 一键启动脚本 (Unix/Linux/macOS)
# ============================
# 功能：
# 1. 检查环境变量配置
# 2. 启动所有必要服务
# 3. 显示访问地址
# ============================

set -e

cd "$(dirname "$0")/.."

echo "╔════════════════════════════════════════════╗"
echo "║        Ergo - AI 管家控制台启动           ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "[ERROR] .env 文件不存在"
    echo "[INFO] 请复制 .env.example 为 .env 并配置参数"
    echo ""
    echo "执行命令:"
    echo "  cp .env.example .env"
    echo "  nano .env  # 或使用 vi/vim"
    echo ""
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js 未安装"
    echo "[INFO] 请访问 https://nodejs.org/ 安装"
    exit 1
fi

# 检查依赖
if [ ! -d node_modules ]; then
    echo "[INFO] 检测到 node_modules 缺失，正在安装依赖..."
    npm install
fi

echo "[INFO] 启动 Ergo 服务..."
echo ""

# 使用 npm run start:all 启动所有服务
npm run start:all &
ERGO_PID=$!

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║           服务已启动                      ║"
echo "╠════════════════════════════════════════════╣"
echo "║  本地访问: http://localhost:8081          ║"
echo "║  公网访问: 见 cpolar 配置                 ║"
echo "╠════════════════════════════════════════════╣"
echo "║  健康检查: npm test                       ║"
echo "║  停止服务: Ctrl+C                         ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 等待服务启动
echo "[INFO] 等待服务初始化..."
sleep 5

# 运行健康检查
echo ""
echo "[INFO] 运行健康检查..."
npm test

echo ""
echo "[SUCCESS] Ergo 已启动完成"
echo "[INFO] 服务运行中，按 Ctrl+C 停止"

# 捕获 Ctrl+C 信号
trap "echo ''; echo '[INFO] 正在停止服务...'; kill $ERGO_PID; exit 0" INT

# 保持脚本运行
wait $ERGO_PID
