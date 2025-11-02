# 菜单图片解析服务

用于识别日本居酒屋菜单照片，提取菜品名称和价格的 OCR 解析服务。

## 功能

- ✅ 调用 Google Cloud Vision API 进行 OCR
- ✅ 支持竖排日文菜单的多列分组
- ✅ 自动提取价格（支持阿拉伯数字、全角数字、汉数字）
- ✅ 结构化输出，包含置信度和审核标记
- ✅ 可扩展架构，支持接入其他 OCR 服务（Azure / AWS / PaddleOCR）

## 安装

### 1. 安装依赖

```bash
npm install @google-cloud/vision
```

### 2. 配置 Google Cloud 凭据

#### 方法一：使用环境变量（推荐）

```bash
# 在 Google Cloud Console 创建服务账号并下载 JSON 密钥文件
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

#### 方法二：在代码中指定

修改 `src/ocr/googleVision.ts` 中的 `getVisionClient()` 函数：

```typescript
visionClient = new vision.ImageAnnotatorClient({
  keyFilename: '/path/to/key.json',
});
```

#### 创建服务账号步骤

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建或选择项目
3. 启用 Vision API
4. 创建服务账号：
   - IAM & Admin → Service Accounts → Create Service Account
   - 授予 "Cloud Vision API User" 角色
   - 创建密钥（JSON）并下载

## 使用方法

### 基础用法

```typescript
import { parseMenuImageToItems } from './parser';

// 从本地文件读取
import fs from 'fs';
const imageBuffer = fs.readFileSync('./menu.jpg');
const items = await parseMenuImageToItems(
  { type: 'buffer', data: imageBuffer },
  { languageHints: ['ja'] }
);

console.log(items);
```

### 从 URL 读取

```typescript
const items = await parseMenuImageToItems(
  { type: 'url', data: 'https://example.com/menu.jpg' },
  { languageHints: ['ja'], maxColumns: 4 }
);
```

### 从 Base64 读取

```typescript
const items = await parseMenuImageToItems(
  { type: 'base64', data: 'data:image/jpeg;base64,...' }
);
```

## 输出格式

```typescript
interface DetectedMenuItem {
  name: string;              // 菜名（已去掉价格部分）
  price?: number;            // 价格（日元），整数
  rawText: string;           // 原始文本行
  bbox?: {                   // 位置坐标
    x: number;
    y: number;
    width: number;
    height: number;
  };
  sourceColumn?: number;     // 所属列号（从0开始）
  confidence?: number;        // 置信度 0~1
  needsReview: boolean;      // 是否需要人工审核
}
```

## 参数调整

### 列分组阈值

如果菜单识别结果不准确，可以调整 `maxColumnGap` 参数：

```typescript
// 菜单列数少（2-3列），增大阈值
const items = await parseMenuImageToItems(input, {
  maxColumnGap: 10,  // 10%
});

// 菜单列数多（4-6列），减小阈值
const items = await parseMenuImageToItems(input, {
  maxColumnGap: 5,   // 5%
});
```

### 最大列数

限制识别的最大列数：

```typescript
const items = await parseMenuImageToItems(input, {
  maxColumns: 4,
});
```

## 支持的价格格式

- ✅ `450円` - 普通阿拉伯数字
- ✅ `４５0円` - 全角+半角混合
- ✅ `三五〇円` - 日式汉数字
- ✅ `500` - 没有"円"
- ✅ `５００` - 全角数字

## 错误处理

```typescript
try {
  const items = await parseMenuImageToItems(input);
} catch (error) {
  if (error.message.includes('OCR request failed')) {
    // OCR API 调用失败
    console.error('请检查 Google Cloud 凭据配置');
  } else {
    // 其他错误
    console.error(error);
  }
}
```

## 测试

运行单元测试：

```bash
npm test -- lineToMenuItem.test.ts
```

## 扩展其他 OCR 服务

### 接入 Azure Computer Vision

1. 安装依赖：
```bash
npm install @azure/cognitiveservices-computervision
```

2. 在 `src/ocr/` 下创建 `azureVision.ts`
3. 实现类似的 `runOcrOnImage()` 函数
4. 在 `parser/index.ts` 中添加对 Azure 的支持

### 接入 AWS Textract

1. 安装依赖：
```bash
npm install @aws-sdk/client-textract
```

2. 在 `src/ocr/` 下创建 `awsTextract.ts`
3. 实现对应的解析函数

## 常见问题

### Q: OCR 识别结果不准怎么办？

A: 可以尝试：
1. 调整 `maxColumnGap` 参数
2. 检查图片质量（清晰度、反光）
3. 使用更高分辨率的图片

### Q: 价格识别不出来？

A: 可能的原因：
1. 价格格式不在支持范围内（可以扩展 `lineToMenuItem.ts` 的正则）
2. OCR 识别错误（检查原始文本 `rawText`）
3. 标记为 `needsReview: true`，需要人工确认

### Q: 如何提高置信度？

A: 
- 使用清晰的图片
- 确保图片方向正确
- 调整列分组阈值，确保列分离准确

## 后续优化方向

- [ ] 支持图片自动旋转检测
- [ ] 支持更多价格格式（如"1,200円"）
- [ ] 添加图片预处理（去反光、增强对比度）
- [ ] 支持批量处理多张图片
- [ ] 添加缓存机制，避免重复 OCR



