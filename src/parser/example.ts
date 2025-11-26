/**
 * 菜单图片解析示例
 * 
 * 使用示例：
 * 
 * ```bash
 * # 安装依赖
 * npm install @google-cloud/vision
 * 
 * # 配置环境变量
 * export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 * 
 * # 运行示例（需要先改为 .js 或使用 tsx/ts-node）
 * node example.ts
 * ```
 * 
 * 注意：此文件仅在 Node.js 环境中使用，浏览器环境需要不同的实现
 */

import { parseMenuImageToItems } from './index';

// 仅在 Node.js 环境中可用
let fs: typeof import('fs') | null = null;
let path: typeof import('path') | null = null;

try {
  // 动态导入 Node.js 模块（仅在 Node.js 环境可用）
  if (typeof require !== 'undefined') {
    fs = require('fs');
    path = require('path');
  }
} catch (e) {
  // 浏览器环境，忽略
}

/**
 * 示例
 * 示例1：从本地文件读取（仅在 Node.js 环境可用）
 */
async function _example1_LocalFile() {
  console.log('=== 示例1：从本地文件读取 ===\n');

  if (!fs || !path) {
    console.error('此示例仅在 Node.js 环境中可用');
    return;
  }

  try {
    // 读取本地图片文件
    const imagePath = path.join(process.cwd(), 'public', 'menu-sample.jpg');
    const imageBuffer = fs.readFileSync(imagePath);

    const items = await parseMenuImageToItems(
      { type: 'buffer', data: imageBuffer },
      {
        languageHints: ['ja'],
        maxColumns: 4,
        maxColumnGap: 8, // 8% 页面宽度
      }
    );

    console.log(`识别到 ${items.length} 个菜单项：\n`);

    items.forEach((item, index) => {
      console.log(`${index + 1}. [列${item.sourceColumn ?? '?'}] ${item.name}`);
      if (item.price) {
        console.log(`   价格: ¥${item.price}`);
      } else {
        console.log(`   价格: 未识别（需要人工确认）`);
      }
      console.log(`   原文: ${item.rawText}`);
      console.log(`   置信度: ${(item.confidence ?? 0).toFixed(2)}`);
      console.log(`   需要审核: ${item.needsReview ? '是' : '否'}`);
      console.log('');
    });

    // 分类统计
    const reviewed = items.filter(item => !item.needsReview);
    const needReview = items.filter(item => item.needsReview);

    console.log('\n统计：');
    console.log(`  ✅ 可用的项: ${reviewed.length}`);
    console.log(`  ⚠️  需要审核的项: ${needReview.length}`);
  } catch (error) {
    console.error('错误:', error);
    console.error('\n提示：');
    console.error('  1. 确保已安装 @google-cloud/vision');
    console.error('  2. 确保已配置 GOOGLE_APPLICATION_CREDENTIALS 环境变量');
    console.error('  3. 确保图片文件存在');
  }
}

/**
 * 示例2：从 URL 读取
 */
async function _example2_Url() {
  console.log('=== 示例2：从 URL 读取 ===\n');

  try {
    const imageUrl = 'https://example.com/menu.jpg';

    const items = await parseMenuImageToItems(
      { type: 'url', data: imageUrl },
      {
        languageHints: ['ja'],
        maxColumns: 6,
      }
    );

    console.log(`识别到 ${items.length} 个菜单项`);
    items.forEach(item => {
      console.log(`  - ${item.name}${item.price ? ` ¥${item.price}` : ''}`);
    });
  } catch (error) {
    console.error('错误:', error);
  }
}

/**
 * 示例3：模拟测试用例
 */
async function example3_MockLines() {
  console.log('=== 示例3：行解析测试 ===\n');

  const { parseMenuLine } = await import('./lineToMenuItem');

  const testLines = [
    '砂肝　３５０円',
    'とりなんこつ　四五〇円',
    'チーズベーコン　４５０',
    '枝豆',
    'かわ　五〇〇円',
    'つくね　４５0円',
    'やげん软骨　八〇〇円',
  ];

  console.log('测试行解析：\n');

  testLines.forEach(line => {
    const result = parseMenuLine(line);
    console.log(`原文: "${line}"`);
    console.log(`  菜名: ${result.name}`);
    if (result.price) {
      console.log(`  价格: ¥${result.price}`);
    } else {
      console.log(`  价格: 未识别`);
    }
    console.log(`  需要审核: ${result.needsReview ? '是' : '否'}`);
    console.log(`  置信度: ${result.confidence.toFixed(2)}`);
    console.log('');
  });
}

/**
 * 主函数
 */
async function main() {
  // 运行示例3（不需要 OCR，可以直接测试行解析）
  await example3_MockLines();

  // 如果需要测试 OCR，取消下面的注释
  // await example1_LocalFile();
  // await example2_Url();
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

