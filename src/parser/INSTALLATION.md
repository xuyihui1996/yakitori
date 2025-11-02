# 菜单图片解析服务 - 安装指南

## 快速开始

### 1. 安装依赖

```bash
npm install @google-cloud/vision
```

### 2. 配置 Google Cloud 凭据

#### 方法一：使用环境变量（推荐）

```bash
# Linux/Mac
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-key.json

# Windows (PowerShell)
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your-key.json"
```

#### 方法二：在代码中指定

修改 `src/ocr/googleVision.ts`：

```typescript
visionClient = new ImageAnnotatorClient({
  keyFilename: '/path/to/your-key.json',
});
```

## 创建 Google Cloud 项目和服务账号

### 步骤 1：创建项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击项目选择器，创建新项目（或选择现有项目）
3. 输入项目名称，点击"创建"

### 步骤 2：启用 Vision API

1. 在左侧菜单选择 "API 和服务" → "库"
2. 搜索 "Cloud Vision API"
3. 点击进入，点击"启用"

### 步骤 3：创建服务账号

1. 在左侧菜单选择 "IAM 和管理" → "服务账号"
2. 点击 "创建服务账号"
3. 填写服务账号信息：
   - 服务账号名称：`menu-ocr-service`
   - 服务账号 ID：自动生成
   - 描述：`用于菜单图片 OCR 的服务账号`
4. 点击"创建并继续"

### 步骤 4：授予权限

在"授予此服务账号对项目的访问权限"步骤：
1. 选择角色：`Cloud Vision API 用户` 或 `Cloud Vision API Client`
2. 点击"继续" → "完成"

### 步骤 5：创建密钥

1. 在服务账号列表中，找到刚创建的服务账号
2. 点击右侧的"操作"菜单（三个点）
3. 选择"管理密钥"
4. 点击"添加密钥" → "创建新密钥"
5. 选择 JSON 格式
6. 点击"创建"，密钥文件会自动下载

### 步骤 6：配置凭据

将下载的 JSON 文件放到安全的位置（**不要提交到 Git**），然后设置环境变量：

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/downloaded-key.json
```

## 测试安装

创建一个测试文件 `test-ocr.ts`：

```typescript
import { parseMenuImageToItems } from './src/parser';

async function test() {
  try {
    // 从本地文件读取（需要 Node.js 环境）
    const fs = require('fs');
    const imageBuffer = fs.readFileSync('./menu-sample.jpg');
    
    const items = await parseMenuImageToItems(
      { type: 'buffer', data: imageBuffer },
      { languageHints: ['ja'] }
    );
    
    console.log('识别到', items.length, '个菜单项');
    items.forEach(item => {
      console.log(`- ${item.name}${item.price ? ` ¥${item.price}` : ''}`);
    });
  } catch (error) {
    console.error('错误:', error);
  }
}

test();
```

运行测试：

```bash
# 使用 tsx（推荐）
npm install -g tsx
tsx test-ocr.ts

# 或使用 ts-node
npm install -g ts-node
ts-node test-ocr.ts
```

## 费用说明

Google Cloud Vision API 的定价：

- **前 1,000 次调用/月**：免费
- **1,001 - 5,000,000 次**：$1.50 / 1,000 次调用
- 详细价格：https://cloud.google.com/vision/pricing

对于测试和个人项目，免费额度通常足够使用。

## 故障排查

### 错误：无法找到凭据

**错误信息**：
```
Error: Could not load the default credentials
```

**解决方案**：
1. 检查环境变量是否设置：`echo $GOOGLE_APPLICATION_CREDENTIALS`
2. 确保文件路径正确且文件存在
3. 确保文件格式是有效的 JSON

### 错误：API 未启用

**错误信息**：
```
Error: Cloud Vision API has not been used in project
```

**解决方案**：
1. 在 Google Cloud Console 启用 Cloud Vision API
2. 等待几分钟让变更生效

### 错误：权限不足

**错误信息**：
```
Error: Permission denied
```

**解决方案**：
1. 确保服务账号有 "Cloud Vision API User" 角色
2. 检查项目是否正确

### 错误：超出配额

**错误信息**：
```
Error: Quota exceeded
```

**解决方案**：
1. 检查 API 配额使用情况
2. 升级计费账户（如果需要）

## 下一步

- 查看 `src/parser/README.md` 了解使用方法
- 查看 `src/parser/example.ts` 查看示例代码
- 查看 `src/parser/__tests__/lineToMenuItem.test.ts` 查看测试用例



