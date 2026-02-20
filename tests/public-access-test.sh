#!/bin/bash
# Ergo 公网访问完整测试脚本
# 使用 cpolar 公网域名进行端到端测试

echo "╔════════════════════════════════════════════╗"
echo "║    Ergo v1.3.0 公网访问测试              ║"
echo "╠════════════════════════════════════════════╣"
echo ""

# 测试结果统计
PASS=0
FAIL=0

# 测试函数
test_url() {
    local name=$1
    local url=$2
    local expected=$3

    echo -n "[$name] "
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    if [ "$status" = "$expected" ]; then
        echo "✅ PASS (HTTP $status)"
        ((PASS++))
    else
        echo "❌ FAIL (Expected $expected, got $status)"
        ((FAIL++))
    fi
}

echo "【1. Cpolar 公网隧道测试】"
test_url "Ergo 前端" "https://terryzin.cpolar.top" "200"
test_url "OpenClaw Gateway" "https://terrysopenclaw.cpolar.top" "200"
test_url "设置页面" "https://terryzin.cpolar.top/settings.html" "200"
test_url "更新日志页面" "https://terryzin.cpolar.top/changelog.html" "200"
echo ""

echo "【2. 页面内容完整性】"
echo -n "[Ergo 标题] "
if curl -s https://terryzin.cpolar.top | grep -q "<title>Ergo · AI 管家</title>"; then
    echo "✅ PASS"
    ((PASS++))
else
    echo "❌ FAIL"
    ((FAIL++))
fi

echo -n "[Gateway 标题] "
if curl -s https://terrysopenclaw.cpolar.top | grep -q "<title>OpenClaw Control</title>"; then
    echo "✅ PASS"
    ((PASS++))
else
    echo "❌ FAIL"
    ((FAIL++))
fi

echo -n "[认证代码存在] "
if curl -s https://terryzin.cpolar.top | grep -q "getApiKey"; then
    echo "✅ PASS"
    ((PASS++))
else
    echo "❌ FAIL"
    ((FAIL++))
fi
echo ""

echo "【3. API Bridge 认证测试】"
echo -n "[无密钥访问] "
status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/api/status)
if [ "$status" = "401" ]; then
    echo "✅ PASS (HTTP 401 - 正确拒绝)"
    ((PASS++))
else
    echo "❌ FAIL (Expected 401, got $status)"
    ((FAIL++))
fi

echo -n "[正确密钥访问] "
status=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Ergo-Key: ergo-default-secret-key-2026" http://localhost:8082/api/status)
if [ "$status" = "200" ]; then
    echo "✅ PASS (HTTP 200 - 认证成功)"
    ((PASS++))
else
    echo "❌ FAIL (Expected 200, got $status)"
    ((FAIL++))
fi

echo -n "[健康检查无需认证] "
status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/health)
if [ "$status" = "200" ]; then
    echo "✅ PASS (HTTP 200)"
    ((PASS++))
else
    echo "❌ FAIL (Expected 200, got $status)"
    ((FAIL++))
fi
echo ""

echo "【4. OpenClaw Gateway 连接】"
echo -n "[本地连接] "
status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789)
if [ "$status" = "200" ]; then
    echo "✅ PASS (HTTP 200)"
    ((PASS++))
else
    echo "❌ FAIL (Expected 200, got $status)"
    ((FAIL++))
fi

echo -n "[Cpolar 连接] "
status=$(curl -s -o /dev/null -w "%{http_code}" https://terrysopenclaw.cpolar.top)
if [ "$status" = "200" ]; then
    echo "✅ PASS (HTTP 200)"
    ((PASS++))
else
    echo "❌ FAIL (Expected 200, got $status)"
    ((FAIL++))
fi
echo ""

echo "【5. 自动配对监听器】"
echo -n "[进程运行] "
if ps aux 2>/dev/null | grep -q "[a]uto-pairing-watcher"; then
    echo "✅ PASS"
    ((PASS++))
else
    echo "⚠️  WARN (未检测到进程)"
fi
echo ""

echo "╔════════════════════════════════════════════╗"
echo "║            测试结果                       ║"
echo "╠════════════════════════════════════════════╣"
echo "║  通过: $PASS                                  "
echo "║  失败: $FAIL                                  "
echo "╚════════════════════════════════════════════╝"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "🎉 所有测试通过！"
    exit 0
else
    echo "❌ 有 $FAIL 个测试失败"
    exit 1
fi
