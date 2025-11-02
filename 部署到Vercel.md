# 🚀 部署到 Vercel 指南

本指南将帮助你将 Ordered 应用部署到 Vercel。

## 前提条件

1. **GitHub/GitLab/Bitbucket 账号**（推荐使用 GitHub）
2. **Vercel 账号**（免费）
3. **Supabase 项目**（如果使用 Supabase 后端）

---

## 方法一：通过 Vercel Dashboard 部署（推荐）

### 步骤 1：准备代码仓库

1. **初始化 Git 仓库**（如果还没有）：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **推送到 GitHub**：
   ```bash
   # 在 GitHub 创建新仓库后
   git remote add origin https://github.com/你的用户名/ordered.git
   git branch -M main
   git push -u origin main
   ```

### 步骤 2：在 Vercel 部署

1. **访问 [vercel.com](https://vercel.com)**，使用 GitHub 账号登录

2. **点击 "Add New Project"**

3. **导入 GitHub 仓库**：
   - 选择你的 `ordered` 仓库
   - 点击 "Import"

4. **配置项目**：
   - **Framework Preset**: 选择 "Vite"（Vercel 会自动检测）
   - **Root Directory**: 留空（或填写 `./`）
   - **Build Command**: `npm run build`（自动填充）
   - **Output Directory**: `dist`（自动填充）
   - **Install Command**: `npm install`（自动填充）

5. **配置环境变量**（如果使用 Supabase）：
   - 点击 "Environment Variables"
   - 添加以下变量：
     ```
     VITE_SUPABASE_URL=你的Supabase项目URL
     VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
     ```

6. **点击 "Deploy"**

7. **等待部署完成**（通常 1-2 分钟）

8. **部署成功后**，Vercel 会提供一个 URL，例如：`https://ordered.vercel.app`

---

## 方法二：通过 Vercel CLI 部署

### 步骤 1：安装 Vercel CLI

```bash
npm install -g vercel
```

### 步骤 2：登录 Vercel

```bash
vercel login
```

### 步骤 3：部署

```bash
# 在项目根目录执行
vercel

# 首次部署会询问：
# - Set up and deploy? [Y/n] → Y
# - Which scope? → 选择你的账号
# - Link to existing project? [y/N] → N（首次部署选择 N）
# - What's your project's name? → ordered（或自定义名称）
# - In which directory is your code located? → ./
```

### 步骤 4：配置环境变量

```bash
# 设置环境变量
vercel env add VITE_SUPABASE_URL
# 输入值时，粘贴你的 Supabase URL

vercel env add VITE_SUPABASE_ANON_KEY
# 输入值时，粘贴你的 Supabase Anon Key
```

### 步骤 5：重新部署以应用环境变量

```bash
vercel --prod
```

---

## 环境变量配置

### 如果使用 Supabase

在 Vercel Dashboard 的 "Settings" → "Environment Variables" 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase 匿名密钥 |

### 如果使用 Mock 数据

**不需要配置环境变量**，应用会自动使用 Mock 服务。

---

## 部署后检查清单

✅ **检查部署状态**
- 访问 Vercel 提供的 URL
- 确认页面可以正常加载

✅ **检查环境变量**
- 确认 Supabase 连接正常（如果使用）
- 查看浏览器控制台是否有错误

✅ **检查功能**
- 测试创建组
- 测试加入组
- 测试点单功能
- 测试结账功能

---

## 常见问题

### 1. 部署失败：Build Error

**原因**：可能是 TypeScript 类型错误或依赖问题

**解决方案**：
```bash
# 本地测试构建
npm run build

# 如果有错误，先修复再部署
```

### 2. 页面空白

**原因**：可能是路由配置问题或环境变量未设置

**解决方案**：
- 检查 `vercel.json` 中的 `rewrites` 配置
- 确认环境变量已正确配置
- 查看浏览器控制台错误信息

### 3. Supabase 连接失败

**原因**：环境变量未配置或配置错误

**解决方案**：
- 在 Vercel Dashboard 中检查环境变量
- 确认变量名以 `VITE_` 开头
- 确认值没有多余的空格或引号

### 4. 路由 404 错误

**原因**：单页应用（SPA）路由需要重写规则

**解决方案**：
- 确认 `vercel.json` 文件存在
- 确认 `rewrites` 配置正确（已包含在本指南中）

---

## 自动部署

Vercel 会自动：
- ✅ 监听 GitHub 仓库的 push 事件
- ✅ 自动触发构建和部署
- ✅ 为每个 push 创建预览部署
- ✅ 为 main/master 分支创建生产部署

**工作流程**：
1. 修改代码 → `git push`
2. Vercel 自动检测到变化
3. 自动构建和部署
4. 部署完成后可通过 URL 访问

---

## 自定义域名

1. 在 Vercel Dashboard 中选择项目
2. 进入 "Settings" → "Domains"
3. 添加你的域名
4. 按照提示配置 DNS 记录

---

## 更新部署

每次代码更新后：

```bash
git add .
git commit -m "Update: 描述你的更改"
git push
```

Vercel 会自动重新部署！

---

## 回滚到之前的版本

1. 在 Vercel Dashboard 中选择项目
2. 进入 "Deployments"
3. 找到想要回滚的版本
4. 点击 "..." → "Promote to Production"

---

## 性能优化建议

1. **启用缓存**：
   - Vercel 会自动缓存静态资源
   - 可以在 `vercel.json` 中配置缓存策略

2. **CDN 加速**：
   - Vercel 自动使用全球 CDN
   - 无需额外配置

3. **PWA 支持**：
   - 应用已配置 PWA
   - 用户可以将应用添加到主屏幕

---

## 支持

如有问题，请查看：
- [Vercel 文档](https://vercel.com/docs)
- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html#vercel)
- 项目中的 `故障排查指南.md`

---

**🎉 部署成功后，你的应用就可以在全球访问了！**

