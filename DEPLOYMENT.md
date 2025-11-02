# 部署指南

## 📦 部署到 Vercel（推荐）

Vercel 是最简单的部署方式，自动提供 HTTPS，完美支持 PWA。

### 方法 1: 通过 Vercel 网站

1. 访问 [vercel.com](https://vercel.com)
2. 点击 "New Project"
3. 导入你的 GitHub 仓库
4. Vercel 会自动检测 Vite 项目
5. 点击 "Deploy"
6. 完成！你的应用会自动部署到 `https://your-project.vercel.app`

### 方法 2: 通过 CLI

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel

# 部署到生产环境
vercel --prod
```

### 环境变量配置（如果需要）

在 Vercel 项目设置中添加环境变量：
- `VITE_API_URL`: 后端 API 地址（如果使用真实后端）
- `VITE_SUPABASE_URL`: Supabase URL（如果使用 Supabase）
- `VITE_SUPABASE_KEY`: Supabase Key

## 📦 部署到 GitHub Pages

GitHub Pages 提供免费的静态网站托管，支持 HTTPS。

### 步骤

1. **修改 `vite.config.ts`**

```typescript
export default defineConfig({
  base: '/Ordered/',  // 替换为你的仓库名
  // ... 其他配置
});
```

2. **安装 gh-pages**

```bash
npm install -D gh-pages
```

3. **添加部署脚本到 `package.json`**

```json
{
  "scripts": {
    "deploy": "npm run build && gh-pages -d dist"
  }
}
```

4. **部署**

```bash
npm run deploy
```

5. **启用 GitHub Pages**
   - 进入仓库的 Settings
   - 找到 Pages 选项
   - Source 选择 `gh-pages` 分支
   - 保存

6. **访问**
   - 地址：`https://your-username.github.io/Ordered/`

## 📦 部署到 Netlify

Netlify 也是一个优秀的选择，支持自动部署和 HTTPS。

### 通过 Netlify 网站

1. 访问 [netlify.com](https://netlify.com)
2. 点击 "New site from Git"
3. 选择你的仓库
4. 构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
5. 点击 "Deploy site"

### 通过 CLI

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 初始化
netlify init

# 部署
netlify deploy --prod
```

## 📦 部署到 Cloudflare Pages

Cloudflare Pages 提供快速的全球 CDN 和免费 HTTPS。

### 步骤

1. 访问 [pages.cloudflare.com](https://pages.cloudflare.com)
2. 点击 "Create a project"
3. 连接你的 GitHub 仓库
4. 构建设置：
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 点击 "Save and Deploy"

## 🐳 使用 Docker 部署

如果你需要在自己的服务器上部署：

### 创建 `Dockerfile`

```dockerfile
# 构建阶段
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 创建 `nginx.conf`

```nginx
server {
    listen 80;
    server_name localhost;
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # PWA 支持
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 构建和运行

```bash
# 构建镜像
docker build -t ordered-app .

# 运行容器
docker run -d -p 8080:80 ordered-app

# 访问
open http://localhost:8080
```

## 📱 PWA 部署注意事项

### 1. HTTPS 必需
PWA 功能（包括 Service Worker）需要 HTTPS 环境才能正常工作。

- ✅ Vercel、Netlify、Cloudflare Pages 默认提供 HTTPS
- ✅ GitHub Pages 支持 HTTPS
- ⚠️ 本地开发用 `localhost` 也可以（浏览器允许）
- ❌ HTTP 网站无法使用 PWA 功能

### 2. Service Worker 缓存策略

当前配置使用 `autoUpdate` 策略：
- 用户访问时自动检查更新
- 有新版本时自动下载
- 下次访问时使用新版本

### 3. 图标和 Manifest

需要准备以下图标（放在 `public` 目录）：
- `pwa-192x192.png`: 192x192 像素
- `pwa-512x512.png`: 512x512 像素
- `apple-touch-icon.png`: 180x180 像素（iOS）
- `favicon.ico`: 网站图标

### 4. iOS 特殊支持

在 `index.html` 中添加：

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Ordered">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

## 🔧 性能优化

### 1. 代码分割

Vite 自动进行代码分割，但你可以手动优化：

```typescript
// 路由懒加载
const GroupHome = lazy(() => import('./pages/GroupHome'));
```

### 2. 图片优化

- 使用 WebP 格式
- 使用适当的尺寸
- 启用懒加载

### 3. CDN 加速

使用 Vercel、Netlify 等平台时，自动获得全球 CDN 加速。

## 📊 监控和分析

### 添加 Google Analytics

```typescript
// main.tsx
import ReactGA from 'react-ga4';

ReactGA.initialize('YOUR-GA-ID');
```

### 错误监控

可以集成 Sentry 进行错误监控：

```bash
npm install @sentry/react
```

## 🔐 安全建议

1. **环境变量**: 敏感信息不要硬编码，使用环境变量
2. **HTTPS**: 确保生产环境使用 HTTPS
3. **CSP**: 配置 Content Security Policy
4. **CORS**: 如果使用后端 API，配置正确的 CORS 策略

## 📞 故障排查

### PWA 不工作
- 检查是否使用 HTTPS
- 检查 Service Worker 是否注册成功
- 清除浏览器缓存重试

### 路由 404
- 确保服务器配置了 SPA 回退
- Netlify: 创建 `_redirects` 文件
- Vercel: 自动处理

### 构建失败
- 检查 Node.js 版本（推荐 18+）
- 清除 `node_modules` 重新安装
- 检查 TypeScript 错误

## 🎉 部署成功后

1. 测试所有功能
2. 在不同设备上测试（手机、平板、桌面）
3. 测试 PWA 安装功能
4. 分享给朋友试用
5. 收集反馈持续改进

Happy Deploying! 🚀

