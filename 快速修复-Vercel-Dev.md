# 🔧 Vercel Dev 环境修复指南

## 问题描述

在使用 `vercel dev` 测试菜单扫描功能时，出现错误：
```
Failed to execute 'json' on 'Response': Unexpected end of JSON input
```

## 原因分析

1. **Body Parser 冲突**: Vercel 默认的 body parser 会预处理请求体，导致 `formidable` 无法正确解析 multipart/form-data
2. **错误处理不足**: 当 API 返回非 JSON 响应时，前端没有正确处理

## 修复方案

### ✅ 已修复的问题

1. **禁用 Vercel 默认 body parser**
   - 在 `api/parse-menu.ts` 中添加配置
   ```typescript
   export const config = {
     api: {
       bodyParser: false,
     },
   };
   ```

2. **增强错误处理**
   - 前端检查响应的 Content-Type
   - 对非 JSON 响应提供友好提示
   - 后端添加详细日志

3. **添加调试日志**
   - 环境变量检查
   - 文件上传进度
   - OCR 处理状态

## 重新测试

### 步骤 1: 重启 Vercel Dev

```bash
# 停止当前的 vercel dev（Ctrl+C）

# 确保环境变量已设置
export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/yakitori-477003-94640fab8889.json

# 重新启动
vercel dev
```

### 步骤 2: 测试上传

1. 浏览器访问 `http://localhost:3000`
2. 进入组页面
3. 点击"扫描菜单"
4. 上传图片

### 步骤 3: 查看日志

在终端中查看详细日志：
```
✅ Environment variable set: YES
📦 Parsing multipart/form-data...
📁 Files received: ['image']
📷 Image file: menu.png 123456 bytes
✅ Image data loaded: 123456 bytes
🧹 Temp file cleaned
🤖 Starting OCR processing...
✅ OCR completed: 10 items found
```

## 常见错误和解决方案

### 错误 1: "GOOGLE_APPLICATION_CREDENTIALS not set"

**解决**:
```bash
# 在启动 vercel dev 之前设置环境变量
export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/yakitori-477003-94640fab8889.json

# 验证
echo $GOOGLE_APPLICATION_CREDENTIALS

# 启动
vercel dev
```

### 错误 2: "No image file uploaded"

**原因**: FormData 字段名不匹配

**解决**: 检查前端代码，确保字段名是 `image`：
```typescript
formData.append('image', imageFile);
```

### 错误 3: "OCR processing failed"

**可能原因**:
- Google Cloud Vision API 配置问题
- 网络连接问题
- 图片格式不支持

**解决**: 查看终端日志获取详细错误信息

### 错误 4: 仍然出现 JSON 解析错误

**临时解决方案**: 先用命令行测试 OCR 功能

```bash
# 设置环境变量
export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/yakitori-477003-94640fab8889.json

# 测试 OCR
npm run parse:menu "截图 2025-11-02 14-51-50.png"

# 如果命令行测试成功，问题出在 Vercel Dev 配置
# 可以：
# 1. 重启 Vercel Dev
# 2. 清除 Vercel 缓存：rm -rf .vercel
# 3. 重新登录：vercel logout && vercel login
```

## 替代测试方案

如果 Vercel Dev 仍有问题，可以：

### 方案 A: 直接部署测试

```bash
# 提交代码
git add .
git commit -m "fix: 修复 API body parser 配置"
git push

# 在 Vercel Dashboard 设置环境变量后
# 在生产环境测试
```

### 方案 B: 命令行测试 + 前端 Mock

```bash
# 1. 用命令行测试 OCR
npm run parse:menu "test.png"

# 2. 启动 Vite（不需要 API）
npm run dev

# 3. 前端暂时使用 mock 数据测试 UI
```

## 验证修复

修复成功的标志：

1. ✅ 终端显示详细处理日志
2. ✅ 浏览器控制台无 JSON 错误
3. ✅ 识别结果正常显示
4. ✅ 菜品可以成功添加到菜单

## 下一步

修复完成后，继续完整测试流程：

1. ✅ 上传不同的菜单图片
2. ✅ 测试编辑功能
3. ✅ 测试批量添加
4. ✅ 验证菜品添加到数据库
5. ✅ 检查订单自动创建

---

**现在重启 vercel dev 并重新测试！** 🚀

