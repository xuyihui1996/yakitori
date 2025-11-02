/**
 * 菜单解析示例脚本
 * 输出结果到 menu-output.json 文件
 * 
 * 使用方法：
 * npx tsx scripts/parse-sample.ts <图片路径> [--rotate] [--enhance]
 */

import { parseMenuImageToItems } from '../src/parser/index.js';
import { preprocessImageForVerticalMenu } from '../src/utils/imagePreprocess.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const imagePath = process.argv[2];
  const shouldRotate = process.argv.includes('--rotate');
  const shouldEnhance = process.argv.includes('--enhance');

  if (!imagePath) {
    console.error('❌ 错误：请提供图片路径');
    console.error('使用方法: npx tsx scripts/parse-sample.ts <图片路径> [--rotate] [--enhance]');
    console.error('\n选项：');
    console.error('  --rotate   自动旋转横向图片为竖向（推荐用于竖排菜单）');
    console.error('  --enhance  增强图片对比度和锐度');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 错误：图片文件不存在: ${imagePath}`);
    process.exit(1);
  }

  console.log(`📷 解析图片: ${imagePath}`);
  if (shouldRotate) console.log('🔄 启用自动旋转');
  if (shouldEnhance) console.log('✨ 启用图片增强');
  console.log('');

  try {
    // 读取图片
    let imageBuffer = fs.readFileSync(imagePath);

    // 预处理（可选）
    if (shouldRotate || shouldEnhance) {
      const preprocessResult = await preprocessImageForVerticalMenu(imageBuffer, {
        autoRotate: shouldRotate,
        enhance: shouldEnhance,
      });

      imageBuffer = preprocessResult.buffer;

      if (preprocessResult.rotated) {
        console.log(`🔄 图片已旋转: ${preprocessResult.originalSize.width}x${preprocessResult.originalSize.height} → ${preprocessResult.newSize.width}x${preprocessResult.newSize.height}\n`);
      }

      if (preprocessResult.enhanced) {
        console.log('✨ 图片已增强\n');
      }
    }

    // 调用解析函数
    const startTime = Date.now();
    const items = await parseMenuImageToItems(
      { type: 'buffer', data: imageBuffer },
      {
        languageHints: ['ja'],
        maxColumns: 10,
        maxColumnGap: 8,
      }
    );
    const duration = Date.now() - startTime;

    // 输出到文件
    const outputPath = 'menu-output.json';
    fs.writeFileSync(outputPath, JSON.stringify(items, null, 2), 'utf-8');

    console.log(`✅ 解析完成 (耗时: ${duration}ms)`);
    console.log(`📝 结果已保存到: ${outputPath}\n`);

    // 显示简要统计
    const reviewed = items.filter(i => !i.needsReview);
    const needReview = items.filter(i => i.needsReview);

    console.log('统计：');
    console.log(`  ✅ 可用的项: ${reviewed.length}`);
    console.log(`  ⚠️  需要审核的项: ${needReview.length}`);
    console.log(`  📊 总计: ${items.length}\n`);

    // 显示前 10 个结果
    console.log('前 10 个结果预览：\n');
    items.slice(0, 10).forEach((item, index) => {
      const status = item.needsReview ? '⚠️' : '✅';
      console.log(`${status} ${index + 1}. ${item.name}`);
      if (item.price) {
        console.log(`   价格: ¥${item.price}`);
      } else {
        console.log(`   价格: 未识别`);
      }
      console.log(`   原文: "${item.rawText}"`);
      if (item.note) {
        console.log(`   备注: ${item.note}`);
      }
      console.log('');
    });

    if (items.length > 10) {
      console.log(`... 还有 ${items.length - 10} 项，请查看 ${outputPath}\n`);
    }

  } catch (error) {
    console.error('\n❌ 解析失败：\n');
    console.error(error);
    process.exit(1);
  }
}

main();

