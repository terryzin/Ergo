#!/bin/bash
# 验证配置文件是否正确集成

echo "🔍 验证 Ergo 配置集成..."
echo ""

# 检查配置文件是否存在
echo "1️⃣ 检查配置文件..."
if [ -f "src/config.js" ]; then
    echo "   ✅ src/config.js 存在"
else
    echo "   ❌ src/config.js 不存在"
    exit 1
fi

# 检查页面是否引用配置
echo ""
echo "2️⃣ 检查页面集成..."

pages=("file-browser.html" "terminal.html")
for page in "${pages[@]}"; do
    if grep -q "src/config.js" "$page"; then
        echo "   ✅ $page 已引入配置"
    else
        echo "   ❌ $page 未引入配置"
    fi
    
    if grep -q "ergoConfig" "$page"; then
        echo "   ✅ $page 使用 ergoConfig"
    else
        echo "   ❌ $page 未使用 ergoConfig"
    fi
done

# 检查是否还有硬编码的 localhost:8082
echo ""
echo "3️⃣ 检查硬编码问题..."
hardcoded=$(grep -n "localhost:8082" file-browser.html terminal.html 2>/dev/null | grep -v "ergoConfig" | grep -v "//")

if [ -z "$hardcoded" ]; then
    echo "   ✅ 无硬编码 localhost:8082"
else
    echo "   ⚠️  发现硬编码:"
    echo "$hardcoded"
fi

echo ""
echo "4️⃣ 检查配置检查工具..."
if [ -f "config-check.html" ]; then
    echo "   ✅ config-check.html 存在"
else
    echo "   ❌ config-check.html 不存在"
fi

echo ""
echo "5️⃣ 检查文档..."
if [ -f "docs/CONFIG.md" ]; then
    echo "   ✅ docs/CONFIG.md 存在"
else
    echo "   ❌ docs/CONFIG.md 不存在"
fi

echo ""
echo "✅ 配置验证完成！"
echo ""
echo "🚀 下一步："
echo "   1. 访问 http://localhost:8081/config-check.html 测试本地环境"
echo "   2. 访问 https://terryzin.cpolar.top/config-check.html 测试外网环境"
echo "   3. 在两个环境中测试文件浏览器和终端功能"
