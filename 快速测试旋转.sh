#!/bin/bash

echo "🧪 测试图片旋转优化"
echo ""
echo "测试 A：无旋转（基准）"
npm run parse:menu './截图 2025-11-02 12-48-38.png' 2>&1 | head -30
echo ""
echo "保存基准结果..."
cp menu-output.json menu-output-baseline.json
echo ""
echo "================================================"
echo ""
echo "测试 B：启用旋转"
npm run parse:menu './截图 2025-11-02 12-48-38.png' -- --rotate 2>&1 | head -30
echo ""
echo "保存旋转结果..."
cp menu-output.json menu-output-rotate.json
echo ""
echo "================================================"
echo ""
echo "📊 对比统计"
echo ""
echo "基准（无旋转）："
echo "  有价格的项: $(jq '[.[] | select(.price != null)] | length' menu-output-baseline.json)"
echo "  不需审核的项: $(jq '[.[] | select(.needsReview == false)] | length' menu-output-baseline.json)"
echo ""
echo "旋转后："
echo "  有价格的项: $(jq '[.[] | select(.price != null)] | length' menu-output-rotate.json)"
echo "  不需审核的项: $(jq '[.[] | select(.needsReview == false)] | length' menu-output-rotate.json)"
echo ""
echo "✅ 测试完成！查看 menu-output-baseline.json 和 menu-output-rotate.json"
