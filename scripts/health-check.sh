#!/bin/bash
# Ergo 健康检查脚本
# 版本: v1.0
# 用途: 检查所有服务是否正常运行

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
PASS=0
FAIL=0

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║      Ergo 健康检查 - Health Check          ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 1. 检查前端服务 (8081)
echo -n "[1/4] 前端服务 (8081)... "
if curl -sf http://localhost:8081 > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    ((PASS++))
else
    echo -e "${RED}❌${NC}"
    ((FAIL++))
fi

# 2. 检查 API Bridge (8082)
echo -n "[2/4] API Bridge (8082)... "
HEALTH_RESPONSE=$(curl -sf http://localhost:8082/api/health 2>/dev/null)
if [ $? -eq 0 ] && echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✅${NC}"
    ((PASS++))
else
    echo -e "${RED}❌${NC}"
    ((FAIL++))
fi

# 3. 检查 OpenClaw Gateway (18789)
echo -n "[3/4] OpenClaw Gateway (18789)... "
GW_HEALTH=$(curl -sf http://localhost:18789/api/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅${NC}"
    ((PASS++))
else
    echo -e "${RED}❌${NC}"
    ((FAIL++))
fi

# 4. 检查 cpolar 隧道
echo -n "[4/4] Cpolar 隧道... "
TUNNEL_COUNT=$(curl -sf http://localhost:4040/api/tunnels 2>/dev/null | jq '.tunnels | length' 2>/dev/null || echo "0")
if [ "$TUNNEL_COUNT" -ge 2 ]; then
    echo -e "${GREEN}✅ ($TUNNEL_COUNT 个活跃)${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠️  ($TUNNEL_COUNT 个活跃)${NC}"
    # cpolar 可选，不计入失败
fi

echo ""
echo "════════════════════════════════════════════"
echo "  结果: $PASS 通过, $FAIL 失败"

if [ $FAIL -eq 0 ]; then
    echo -e "  ${GREEN}✅ 所有核心服务正常${NC}"
else
    echo -e "  ${RED}❌ 有 $FAIL 个服务异常${NC}"
    echo ""
    echo "  故障排查:"
    echo "    1. 运行: ./scripts/quick-diagnose.sh"
    echo "    2. 查看日志: tail -f logs/*.log"
    echo "    3. 应急重启: ./scripts/emergency-restart.sh"
fi
echo "════════════════════════════════════════════"
echo ""

# 如果有失败，返回非 0 退出码
exit $FAIL
