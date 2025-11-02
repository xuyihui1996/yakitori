# 🔐 解决 Vercel 部署权限问题

## 问题

```
Error: Git author kyo2@example.com must have access to the team 
xuyihui863-5563's projects on Vercel to create deployments.
```

## 原因

Git 配置的邮箱（`kyo2@example.com`）与 Vercel 账号邮箱不匹配，或者该邮箱没有项目权限。

---

## 🚀 解决方案（3 选 1）

### ✅ 方案 1: 使用 Git 自动部署（推荐，最简单）

**不需要 `vercel --prod` 命令，直接 push 到 GitHub！**

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: 添加菜单扫描功能"

# 2. 推送到 GitHub
git push origin main

# 3. Vercel 会自动检测并部署
# 访问 https://vercel.com/dashboard 查看部署进度
```

**优点**：
- ✅ 无需处理权限问题
- ✅ Vercel 自动部署
- ✅ 部署历史记录清晰
- ✅ 支持自动回滚

---

### 方案 2: 更新 Git 邮箱（如果你想用 vercel 命令）

```bash
# 1. 检查当前 Vercel 账号邮箱
vercel whoami

# 2. 更新 Git 配置为 Vercel 账号邮箱
# 假设你的 Vercel 账号邮箱是 your-real-email@example.com
git config user.email "your-real-email@example.com"

# 3. 重新提交（修改最后一次提交的作者信息）
git commit --amend --reset-author --no-edit

# 4. 再次部署
vercel --prod
```

---

### 方案 3: 在 Vercel 添加 Git 邮箱

如果你想保持当前的 Git 邮箱配置：

1. 访问 [Vercel Settings](https://vercel.com/account)
2. 进入 **Emails** 部分
3. 添加邮箱 `kyo2@example.com`
4. 验证邮箱
5. 重新运行 `vercel --prod`

---

## 🎯 推荐操作流程

**使用方案 1（Git 自动部署）**，这是最标准的做法：

```bash
# 1. 检查 Git 状态
git status

# 2. 提交所有更改
git add .
git commit -m "feat: 添加菜单扫描功能
- 创建 MenuScanner 组件
- 集成 Google Cloud Vision API
- 支持图片上传和 OCR 识别
- 优化 Y 坐标匹配算法
- 识别率达到 50%+"

# 3. 推送到远程仓库
git push origin main

# 4. 查看 Vercel 部署状态
# 方法 A: 访问 https://vercel.com/dashboard
# 方法 B: 终端中运行
vercel ls
```

---

## 📊 部署后检查清单

### 1. 检查部署状态

访问 Vercel Dashboard，应该看到：
- ✅ 最新的部署正在进行或已完成
- ✅ 状态为 "Ready"
- ✅ 有生产环境 URL

### 2. 设置环境变量（如果还没设置）

**这一步非常重要！**

1. Vercel Dashboard → 你的项目
2. Settings → Environment Variables
3. 添加：
   ```
   Name: GOOGLE_APPLICATION_CREDENTIALS
   Value: [粘贴 yakitori-477003-94640fab8889.json 的完整内容]
   ```
4. Environment: 选择 **Production**
5. Save

### 3. 重新部署（如果刚设置了环境变量）

```bash
# 方法 A: 在 Vercel Dashboard
# Deployments → 最新部署 → ... → Redeploy

# 方法 B: 触发新部署
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

### 4. 测试功能

1. 访问你的 Vercel 域名（如 `https://your-project.vercel.app`）
2. 创建或加入组
3. 点击 **"扫描菜单"** 按钮
4. 上传测试图片
5. 查看识别结果

---

## 🐛 常见问题

### Q: 推送后 Vercel 没有自动部署？

**检查项**：
1. Vercel 项目是否正确连接到 GitHub 仓库？
   - Dashboard → Project Settings → Git
2. 是否推送到了正确的分支（main/master）？
   - `git branch` 查看当前分支
3. Vercel 是否有部署权限？
   - 查看 GitHub → Settings → Applications → Vercel

**解决**：
```bash
# 重新连接 GitHub 仓库
vercel link

# 手动触发部署
vercel --prod
```

### Q: 环境变量设置后不生效？

**原因**: 需要重新部署才能使新的环境变量生效。

**解决**：
```bash
# 触发新部署
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

### Q: 部署成功但 API 返回 500 错误？

**排查步骤**：
1. Vercel Dashboard → Functions → Logs
2. 查看 `/api/parse-menu` 的日志
3. 检查错误信息

**常见错误**：
- ❌ 环境变量未设置：重新设置并重新部署
- ❌ Google Cloud API 未启用计费：访问 Google Cloud Console 启用
- ❌ API 配额超限：检查 Google Cloud 配额

---

## 📝 完整操作总结

```bash
# 1. 确保所有更改已提交
git status
git add .
git commit -m "feat: 添加菜单扫描功能"

# 2. 推送到 GitHub
git push origin main

# 3. 访问 Vercel Dashboard
# https://vercel.com/dashboard

# 4. 查看部署状态（应该自动开始部署）

# 5. 如果还没设置环境变量，现在设置
# Settings → Environment Variables
# 添加 GOOGLE_APPLICATION_CREDENTIALS

# 6. 如果刚设置了环境变量，触发重新部署
git commit --allow-empty -m "chore: redeploy with env vars"
git push origin main

# 7. 等待部署完成，测试功能！
```

---

## ✅ 成功标志

部署成功后，你应该能够：
1. ✅ 访问 Vercel 域名，应用正常加载
2. ✅ 点击"扫描菜单"，弹窗正常打开
3. ✅ 上传图片，识别结果正常显示
4. ✅ 批量添加菜品成功

---

**建议：使用 Git push 自动部署，这是最简单可靠的方式！** 🚀

