#!/bin/bash
# Ergo 快速诊断脚本
# 版本: v1.0
# 用途: 故障时快速定位问题

set +e  # 允许命令失败，继续执行

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║      Ergo 快速诊断 - Quick Diagnose        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 1. 端口监听检查
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 端口监听状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for port in 8081 8082 18789 4040; do
    echo -n "  端口 $port: "
    if netstat -tuln 2>/dev/null | grep -q ":$port"; then
        echo -e "${GREEN}✅ 监听中${NC}"
    elif lsof -i:$port -sTCP:LISTEN > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 监听中${NC}"
    else
        echo -e "${RED}❌ 未监听${NC}"
    fi
done
echo ""

# 2. 进程检查
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. 进程运行状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -n "  Node.js 进程: "
NODE_COUNT=$(ps aux 2>/dev/null | grep -E "node server" | grep -v grep | wc -l)
if [ "$NODE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ $NODE_COUNT 个运行中${NC}"
    ps aux | grep -E "node server" | grep -v grep | awk '{print "    - PID "$2": "$11" "$12" "$13}'
else
    echo -e "${RED}❌ 未运行${NC}"
fi

echo -n "  cpolar 进程: "
if pgrep -x "cpolar" > /dev/null 2>&1; then
    CPOLAR_PID=$(pgrep -x "cpolar")
    echo -e "${GREEN}✅ PID $CPOLAR_PID${NC}"
else
    echo -e "${RED}❌ 未运行${NC}"
fi
echo ""

# 3. 最近的错误日志
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. 最近的错误日志 (最新 10 条)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -d "logs" ]; then
    ERRORS=$(tail -500 logs/*.log 2>/dev/null | grep -i "error" | tail -10)
    if [ -n "$ERRORS" ]; then
        echo "$ERRORS" | sed 's/^/  /'
    else
        echo -e "  ${GREEN}✅ 无错误日志${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠️  logs 目录不存在${NC}"
fi
echo ""

# 4. cpolar 隧道状态
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Cpolar 隧道状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TUNNELS=$(curl -sf http://localhost:4040/api/tunnels 2>/dev/null)
if [ $? -eq 0 ]; then
    TUNNEL_COUNT=$(echo "$TUNNELS" | jq '.tunnels | length' 2>/dev/null || echo "0")
    if [ "$TUNNEL_COUNT" -gt 0 ]; then
        echo -e "  ${GREEN}✅ $TUNNEL_COUNT 个隧道活跃${NC}"
        echo "$TUNNELS" | jq -r '.tunnels[] | "    - \(.name): \(.public_url)"' 2>/dev/null || echo "  (无法解析 JSON)"
    else
        echo -e "  ${YELLOW}⚠️  无活跃隧道${NC}"
    fi
else
    echo -e "  ${RED}❌ cpolar Web UI 不可访问 (http://localhost:4040)${NC}"
fi
echo ""

# 5. API 响应测试
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. API 响应测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "  API Bridge (/api/health): "
START=$(date +%s%3N)
HEALTH=$(curl -sf http://localhost:8082/api/health 2>/dev/null)
END=$(date +%s%3N)
LATENCY=$((END - START))
if [ $? -eq 0 ] && echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ 响应时间 ${LATENCY}ms${NC}"
else
    echo -e "${RED}❌ 无响应${NC}"
fi

echo -n "  OpenClaw Gateway (/api/health): "
START=$(date +%s%3N)
GW_HEALTH=$(curl -sf http://localhost:18789/api/health 2>/dev/null)
END=$(date +%s%3N)
LATENCY=$((END - START))
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 响应时间 ${LATENCY}ms${NC}"
else
    echo -e "${RED}❌ 无响应${NC}"
fi
echo ""

# 6. 磁盘空间
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. 磁盘空间"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
df -h . 2>/dev/null | tail -1 | awk '{print "  可用空间: "$4" ("$5" 已用)"}'
echo ""

# 7. 建议操作
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. 建议操作"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查是否有服务未运行
if [ "$NODE_COUNT" -eq 0 ]; then
    echo -e "  ${RED}❌ Node.js 服务未运行${NC}"
    echo "     解决方案: ./start-ergo.bat"
fi

if ! pgrep -x "cpolar" > /dev/null 2>&1; then
    echo -e "  ${RED}❌ cpolar 未运行${NC}"
    echo "     解决方案: cpolar start-all"
fi

# 检查端口冲突
for port in 8081 8082 18789; do
    if ! netstat -tuln 2>/dev/null | grep -q ":$port" && ! lsof -i:$port -sTCP:LISTEN > /dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠️  端口 $port 未监听${NC}"
        echo "     可能原因: 服务未启动或启动失败"
    fi
done

echo ""
echo "════════════════════════════════════════════"
echo "  诊断完成"
echo ""
echo "  查看详细日志:"
echo "    - API Bridge:  tail -f logs/api-bridge.log"
echo "    - Frontend:    tail -f logs/frontend.log"
echo "    - Cpolar:      tail -f logs/cpolar.log"
echo ""
echo "  应急重启:"
echo "    ./scripts/emergency-restart.sh"
echo "════════════════════════════════════════════"
echo ""
