# 📦 Vercel 部署指南 - OCR 菜单扫描功能

## 环境变量配置

### 步骤 1：准备 Google Cloud 凭证

你已经有了 `yakitori-477003-94640fab8889.json` 文件。

### 步骤 2：在 Vercel 中设置环境变量

#### 方法 A：直接粘贴 JSON 内容（推荐）

1. 登录 Vercel Dashboard
2. 进入你的项目 → Settings → Environment Variables
3. 添加新的环境变量：

```
Name: GOOGLE_APPLICATION_CREDENTIALS
Value: 将 yakitori-477003-94640fab8889.json 的完整内容复制粘贴到这里
```

**注意**：
- 确保 JSON 格式正确，包括所有的大括号和引号
- 不要添加额外的空格或换行
- Vercel 会自动处理多行内容

#### 方法 B：使用 Vercel CLI（备选）

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 设置环境变量（将 JSON 内容转为单行）
vercel env add GOOGLE_APPLICATION_CREDENTIALS production < yakitori-477003-94640fab8889.json
```

### 步骤 3：设置环境（可选）

如果你需要在不同环境使用不同的凭证：

- **Production**: 生产环境（部署到主分支时使用）
- **Preview**: 预览环境（PR 或其他分支部署时使用）
- **Development**: 开发环境（本地 `vercel dev` 时使用）

**建议**：至少在 Production 和 Preview 都设置相同的凭证。

---

## 部署步骤

### 1. 安装依赖

确保 `package.json` 包含以下依赖：

```json
{
  "dependencies": {
    "@google-cloud/vision": "^4.3.3",
    "formidable": "^3.5.1"
  },
  "devDependencies": {
    "@types/formidable": "^3.4.5",
    "@vercel/node": "^3.0.0"
  }
}
```

### 2. 提交代码

```bash
git add .
git commit -m "feat: 添加菜单扫描功能"
git push origin main
```

### 3. 自动部署

Vercel 会自动检测到新的提交并开始部署。

### 4. 验证部署

部署完成后，测试 API：

```bash
# 方法 1：使用 curl（base64）
curl -X POST https://your-project.vercel.app/api/parse-menu \
  -H "Content-Type: application/json" \
  -d '{"image": "base64-image-data-here"}'

# 方法 2：在浏览器中使用前端界面
# 访问你的应用 → 进入组页面 → 点击"扫描菜单"
```

---

## 故障排查

### 错误 1: "OCR service not configured"

**原因**: 环境变量未设置或设置错误。

**解决**:
1. 检查 Vercel Dashboard → Settings → Environment Variables
2. 确认 `GOOGLE_APPLICATION_CREDENTIALS` 存在
3. 重新部署（Settings → Deployments → Redeploy）

### 错误 2: "PERMISSION_DENIED: This API method requires billing"

**原因**: Google Cloud Vision API 未启用计费。

**解决**:
1. 访问 [Google Cloud Console](https://console.cloud.google.com/billing)
2. 选择项目 `yakitori-477003`
3. 启用计费（可以使用免费额度）

### 错误 3: "Failed to parse form data"

**原因**: `formidable` 依赖未正确安装。

**解决**:
```bash
npm install formidable @types/formidable --save
git add package.json package-lock.json
git commit -m "fix: 添加 formidable 依赖"
git push
```

### 错误 4: Function timeout

**原因**: OCR 处理时间超过默认限制（10s）。

**解决**: 在 `vercel.json` 中增加超时时间：

```json
{
  "functions": {
    "api/parse-menu.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

### 错误 5: "Cannot find module '../src/parser/index.js'"

**原因**: TypeScript 编译问题或路径错误。

**解决**:
1. 确保 `tsconfig.json` 配置正确
2. 检查 API 文件中的 import 路径
3. 尝试使用动态导入：
   ```typescript
   const { parseMenuImageToItems } = await import('../src/parser/index.js');
   ```

---

## 性能优化

### 1. 冷启动优化

Vercel Serverless Functions 会有冷启动延迟。优化建议：

- 使用 `memory: 1024` 或更高（在 `vercel.json` 中）
- 保持函数代码简洁，避免大量依赖
- 考虑使用 Vercel Edge Functions（如果支持）

### 2. 图片大小限制

- 前端压缩图片到 < 5MB
- 设置合理的 `maxBodySize`（默认 4.5MB）
- 推荐使用区域切分拍摄（更小的图片，更快的处理）

### 3. 缓存策略

对于相同的菜单图片，可以考虑：
- 客户端缓存识别结果
- 使用 Redis 缓存 OCR 结果（需要额外服务）

---

## 成本预估

### Google Cloud Vision API 定价

- **免费额度**: 前 1,000 次请求/月免费
- **付费**: $1.50 / 1,000 次请求

**预估**（基于使用量）：
- 小团队（10 人，每月 50 次扫描）: **免费**
- 中等使用（100 人，每月 500 次扫描）: **免费**
- 大量使用（每月 5,000 次扫描）: ~$6/月

### Vercel 定价

- **Hobby 计划**: 免费，但有 100GB 带宽/月限制
- **Pro 计划**: $20/月，无限带宽
- **Function 执行时间**: 包含在计划中

**建议**: 
- 个人/小团队使用：Hobby 计划足够
- 商业用途：考虑 Pro 计划

---

## 监控和日志

### 查看函数日志

1. Vercel Dashboard → 你的项目
2. Functions → Logs
3. 筛选 `/api/parse-menu` 相关日志

### 设置告警

1. Vercel → Settings → Notifications
2. 设置告警阈值：
   - 函数错误率 > 5%
   - 函数执行时间 > 20s
   - 函数调用量异常

---

## 安全建议

### 1. 限制请求频率

在 API 中添加速率限制：

```typescript
// api/parse-menu.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 10, // 最多 10 次请求
});
```

### 2. 验证用户身份

集成 Supabase Auth：

```typescript
// 验证用户是否已登录
const { user } = await supabase.auth.getUser(req.headers.authorization);
if (!user) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### 3. 限制图片大小

前端和后端都要验证：

```typescript
// 前端
if (file.size > 10 * 1024 * 1024) {
  throw new Error('图片文件太大');
}

// 后端
const form = new IncomingForm({
  maxFileSize: 10 * 1024 * 1024,
});
```

---

## 更新和维护

### 更新依赖

定期更新依赖以获取安全补丁和性能改进：

```bash
npm update @google-cloud/vision
npm update formidable
npm audit fix
```

### 回滚部署

如果新版本有问题，可以快速回滚：

1. Vercel Dashboard → Deployments
2. 找到之前的稳定版本
3. 点击 "..." → "Promote to Production"

---

## 下一步

功能已集成完成！你现在可以：

1. ✅ 在 Vercel 设置环境变量
2. ✅ 推送代码触发自动部署
3. ✅ 在应用中测试"扫描菜单"功能
4. ✅ 查看识别结果并编辑确认
5. ✅ 批量添加菜品到菜单

**需要帮助？** 查看 [菜单扫描功能使用指南.md](./菜单扫描功能使用指南.md)

