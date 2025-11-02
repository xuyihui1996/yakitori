/**
 * 批量解析切分后的菜单图片
 * 对比切分前后的效果
 */

import { parseMenuImageToItems } from '../src/parser/index.js';
import fs from 'fs';
import path from 'path';

interface RegionResult {
  filename: string;
  items: any[];
  stats: {
    total: number;
    withPrice: number;
    noReview: number;
    perfect: number;
  };
}

async function parseRegion(imagePath: string): Promise<RegionResult> {
  const filename = path.basename(imagePath);
  console.log(`\n📷 解析: ${filename}`);
  
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const items = await parseMenuImageToItems(
      { type: 'buffer', data: imageBuffer },
      { languageHints: ['ja'] }
    );

    const stats = {
      total: items.length,
      withPrice: items.filter(i => i.price != null).length,
      noReview: items.filter(i => !i.needsReview).length,
      perfect: items.filter(i => i.price != null && !i.needsReview).length,
    };

    console.log(`  ✅ 总计: ${stats.total} 项`);
    console.log(`  💰 有价格: ${stats.withPrice} 项`);
    console.log(`  ⭐ 完美识别: ${stats.perfect} 项`);

    return { filename, items, stats };
  } catch (error) {
    console.error(`  ❌ 解析失败: ${error}`);
    return {
      filename,
      items: [],
      stats: { total: 0, withPrice: 0, noReview: 0, perfect: 0 },
    };
  }
}

async function main() {
  const imageFiles = process.argv.slice(2);

  if (imageFiles.length === 0) {
    console.error('❌ 错误：请提供图片路径');
    console.error('使用方法: npx tsx scripts/batch-parse-regions.ts <图片1> <图片2> ...');
    process.exit(1);
  }

  console.log('🎯 批量解析切分后的菜单图片\n');
  console.log(`📊 共 ${imageFiles.length} 个图片\n`);
  console.log('='.repeat(60));

  const results: RegionResult[] = [];

  // 逐个解析
  for (const imagePath of imageFiles) {
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ 文件不存在: ${imagePath}`);
      continue;
    }

    const result = await parseRegion(imagePath);
    results.push(result);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 汇总统计\n');

  // 汇总统计
  const totalStats = {
    total: 0,
    withPrice: 0,
    noReview: 0,
    perfect: 0,
  };

  for (const result of results) {
    totalStats.total += result.stats.total;
    totalStats.withPrice += result.stats.withPrice;
    totalStats.noReview += result.stats.noReview;
    totalStats.perfect += result.stats.perfect;
  }

  console.log(`总项数: ${totalStats.total}`);
  console.log(`有价格: ${totalStats.withPrice} (${(totalStats.withPrice / totalStats.total * 100).toFixed(1)}%)`);
  console.log(`完美识别: ${totalStats.perfect} (${(totalStats.perfect / totalStats.total * 100).toFixed(1)}%)`);

  // 合并所有结果
  const allItems = results.flatMap((r, index) => 
    r.items.map(item => ({
      ...item,
      region: r.filename,
      regionIndex: index,
    }))
  );

  // 保存结果
  const outputPath = 'menu-output-regions.json';
  fs.writeFileSync(outputPath, JSON.stringify(allItems, null, 2), 'utf-8');
  console.log(`\n✅ 结果已保存到: ${outputPath}`);

  // 显示前 20 个完美识别的项
  console.log('\n📋 前 20 个完美识别的项：\n');
  const perfectItems = allItems.filter(i => i.price != null && !i.needsReview);
  
  perfectItems.slice(0, 20).forEach((item, index) => {
    console.log(`${index + 1}. ${item.name} → ¥${item.price} (${item.region})`);
  });

  if (perfectItems.length > 20) {
    console.log(`\n... 还有 ${perfectItems.length - 20} 项\n`);
  }

  // 对比基准
  if (fs.existsSync('menu-output-baseline.json')) {
    const baseline = JSON.parse(fs.readFileSync('menu-output-baseline.json', 'utf-8'));
    const baselineStats = {
      total: baseline.length,
      perfect: baseline.filter((i: any) => i.price != null && !i.needsReview).length,
    };

    console.log('\n📈 对比基准（完整图片）：\n');
    console.log(`基准: ${baselineStats.perfect}/${baselineStats.total} (${(baselineStats.perfect / baselineStats.total * 100).toFixed(1)}%)`);
    console.log(`切分: ${totalStats.perfect}/${totalStats.total} (${(totalStats.perfect / totalStats.total * 100).toFixed(1)}%)`);
    
    const improvement = totalStats.perfect - baselineStats.perfect;
    const improvementPercent = ((totalStats.perfect / totalStats.total) - (baselineStats.perfect / baselineStats.total)) * 100;
    
    if (improvement > 0) {
      console.log(`\n✅ 提升: +${improvement} 项 (+${improvementPercent.toFixed(1)}%)`);
    } else {
      console.log(`\n⚠️  变化: ${improvement} 项 (${improvementPercent.toFixed(1)}%)`);
    }
  }
}

main();


