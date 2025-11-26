#!/bin/bash

echo "🔍 快速排查部署问题"
echo "════════════════════════════════════════════════════════"

# 1. Git 状态
echo -e "\n1️⃣  Git 状态检查"
echo "────────────────────────────────────────────────────────"
if [[ -n $(git status -s) ]]; then
  echo "⚠️  有未提交的更改："
  git status -s
  echo ""
  echo "需要运行："
  echo "  git add ."
  echo "  git commit -m 'feat: 添加菜单扫描功能'"
  echo "  git push origin main"
else
  echo "✅ 所有文件已提交"
fi

# 2. 最后提交
echo -e "\n2️⃣  最后提交检查"
echo "────────────────────────────────────────────────────────"
git log --oneline -1

# 3. 关键文件
echo -e "\n3️⃣  关键文件检查"
echo "────────────────────────────────────────────────────────"
files=(
  "src/components/MenuScanner.tsx"
  "api/parse-menu.ts"
  "vercel.json"
  "src/parser/matchNameAndPriceV2.ts"
)

for file in "${files[@]}"; do
  if git ls-files | grep -q "$file"; then
    echo "✅ $file"
  else
    echo "❌ $file (未在 git 中)"
  fi
done

# 4. Vercel 部署
echo -e "\n4️⃣  Vercel 部署状态"
echo "────────────────────────────────────────────────────────"
vercel ls --prod 2>&1 | head -5

echo -e "\n════════════════════════════════════════════════════════"
echo "📋 下一步操作："
echo ""
if [[ -n $(git status -s) ]]; then
  echo "  有未提交的更改，运行："
  echo "    git add ."
  echo "    git commit -m 'feat: 添加菜单扫描功能'"
  echo "    git push origin main"
else
  echo "  1. 检查 Vercel Dashboard 环境变量是否设置"
  echo "  2. 访问生产环境 URL 测试（不是预览 URL）"
  echo "  3. 强制刷新浏览器 (Ctrl+Shift+R)"
fi

