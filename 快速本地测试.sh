#!/bin/bash

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   🧪 菜单扫描功能 - 本地测试                              ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# 步骤 1: 设置环境变量
echo "📋 步骤 1: 设置环境变量"
echo "═══════════════════════════════════════════════════════════"

if [ -f "yakitori-477003-94640fab8889.json" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/yakitori-477003-94640fab8889.json"
    echo "✅ 环境变量已设置: $GOOGLE_APPLICATION_CREDENTIALS"
else
    echo "❌ 错误: 找不到 yakitori-477003-94640fab8889.json"
    echo "   请确保文件在项目根目录"
    exit 1
fi

echo ""
echo "📋 步骤 2: 测试 OCR 功能（命令行）"
echo "═══════════════════════════════════════════════════════════"

# 检查测试图片
if [ ! -f "截图 2025-11-02 14-51-50.png" ]; then
    echo "⚠️  警告: 找不到测试图片"
    echo "   你可以使用自己的图片测试"
    echo ""
    echo "使用方法："
    echo "  npm run parse:menu \"你的图片.png\""
    echo ""
    exit 0
fi

echo "🔍 测试图片 1: 截图 2025-11-02 14-51-50.png"
npm run parse:menu "截图 2025-11-02 14-51-50.png"

echo ""
echo "📊 识别结果摘要："
echo "─────────────────────────────────────────────────────────"

if [ -f "menu-output.json" ]; then
    total=$(jq 'length' menu-output.json)
    perfect=$(jq '[.[] | select(.price != null and .needsReview == false)] | length' menu-output.json)
    
    echo "  总项数:     $total"
    echo "  完美识别:   $perfect"
    echo "  识别率:     $(echo "scale=1; $perfect * 100 / $total" | bc)%"
    echo ""
    echo "📋 前 5 个识别结果："
    jq -r '.[:5] | .[] | "  - \(.name) → ¥\(.price // "未识别")"' menu-output.json
    echo ""
    echo "💾 完整结果已保存到: menu-output.json"
else
    echo "❌ 未生成输出文件"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🎯 下一步测试选项："
echo ""
echo "  1️⃣  测试区域切分（推荐，识别率更高）："
echo "      npm run parse:regions \"图片1.png\" \"图片2.png\" \"图片3.png\""
echo ""
echo "  2️⃣  启动完整应用测试："
echo "      npm run dev"
echo "      然后访问 http://localhost:5173"
echo ""
echo "  3️⃣  使用 Vercel 本地环境（支持 API 路由）："
echo "      npx vercel dev"
echo "      然后访问 http://localhost:3000"
echo ""
echo "═══════════════════════════════════════════════════════════"

