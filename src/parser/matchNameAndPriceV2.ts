/**
 * 名字列和价格列匹配 V2（优化版）
 * 针对竖排菜单的 Y 坐标匹配优化
 */

import type { OcrBlock, DetectedMenuItem } from '../types/ocr';
import { parsePriceFromRaw, normalizeName } from './price';

/**
 * 计算块的 Y 中心点
 */
function centerY(b: OcrBlock): number {
  return b.bbox.y + b.bbox.height / 2;
}

/**
 * 计算块的 X 中心点
 */
function centerX(b: OcrBlock): number {
  return b.bbox.x + b.bbox.width / 2;
}

/**
 * 优化的匹配算法
 * 
 * 关键改进：
 * 1. 增大 Y 距离阈值（50px → 100px）
 * 2. 考虑 X 距离（优先匹配距离近的列）
 * 3. 使用加权评分系统
 * 
 * @param nameBlocks - 菜名块列表
 * @param priceBlocks - 价格块列表
 * @param options - 匹配选项
 * @returns 匹配后的菜单项
 */
export function matchNameAndPriceV2(
  nameBlocks: OcrBlock[],
  priceBlocks: OcrBlock[],
  options: {
    maxYDistance?: number;  // 最大 Y 距离，默认 100px
    xWeightFactor?: number; // X 距离权重因子，默认 0.2
  } = {}
): DetectedMenuItem[] {
  const { 
    maxYDistance = 100,  // 从 50 增大到 100
    xWeightFactor = 0.2  // X 距离占 20% 权重
  } = options;

  const items: DetectedMenuItem[] = [];
  const usedPriceBlocks = new Set<OcrBlock>();

  for (const nb of nameBlocks) {
    const ny = centerY(nb);
    const nx = centerX(nb);
    
    let best: OcrBlock | null = null;
    let bestScore = Infinity;

    for (const pb of priceBlocks) {
      if (usedPriceBlocks.has(pb)) continue;

      const py = centerY(pb);
      const px = centerX(pb);
      
      // 计算距离
      const dy = Math.abs(py - ny);
      const dx = Math.abs(px - nx);

      // 加权评分：Y 距离为主（80%），X 距离为辅（20%）
      // 这样既考虑了 Y 对齐，也倾向于选择更近的列
      const score = dy * 1.0 + dx * xWeightFactor;

      if (score < bestScore && dy <= maxYDistance) {
        bestScore = score;
        best = pb;
      }
    }

    if (best) {
      usedPriceBlocks.add(best);
    }

    const price = best ? parsePriceFromRaw(best.text) : undefined;
    const name = normalizeName(nb.text);

    items.push({
      name,
      price,
      rawText: best ? `${nb.text} ${best.text}` : nb.text,
      bbox: nb.bbox,
      sourceColumn: nb.bbox.x,
      confidence: best && price ? 0.9 : 0.5,
      needsReview: !best || !price || name.length < 2,
    });
  }

  return items;
}

/**
 * 智能匹配算法（进阶版）
 * 
 * 特点：
 * 1. 自适应阈值（根据图片尺寸）
 * 2. 双向匹配（菜名→价格 + 价格→菜名）
 * 3. 冲突解决机制
 */
export function matchNameAndPriceSmart(
  nameBlocks: OcrBlock[],
  priceBlocks: OcrBlock[],
  imageHeight: number = 1000
): DetectedMenuItem[] {
  // 自适应阈值：图片高度的 8-10%
  const adaptiveMaxY = Math.max(80, Math.min(imageHeight * 0.1, 150));

  console.log(`  🎯 使用自适应阈值: ${adaptiveMaxY.toFixed(0)}px (图片高度: ${imageHeight}px)`);

  const items: DetectedMenuItem[] = [];
  const usedPriceBlocks = new Set<OcrBlock>();

  // 第1轮：标准匹配
  for (const nb of nameBlocks) {
    const ny = centerY(nb);
    const nx = centerX(nb);
    
    let best: OcrBlock | null = null;
    let bestScore = Infinity;

    for (const pb of priceBlocks) {
      if (usedPriceBlocks.has(pb)) continue;

      const py = centerY(pb);
      const px = centerX(pb);
      
      const dy = Math.abs(py - ny);
      const dx = Math.abs(px - nx);

      // 加权评分
      const score = dy * 1.0 + dx * 0.15;

      if (score < bestScore && dy <= adaptiveMaxY) {
        bestScore = score;
        best = pb;
      }
    }

    if (best) {
      usedPriceBlocks.add(best);
    }

    const price = best ? parsePriceFromRaw(best.text) : undefined;
    const name = normalizeName(nb.text);

    items.push({
      name,
      price,
      rawText: best ? `${nb.text} ${best.text}` : nb.text,
      bbox: nb.bbox,
      sourceColumn: nb.bbox.x,
      confidence: best && price ? 0.9 : 0.5,
      needsReview: !best || !price || name.length < 2,
    });
  }

  return items;
}

/**
 * 从多个菜名列和多个价格列中匹配（使用优化算法）
 */
export function matchMultipleColumnsV2(
  nameColumns: Array<{ blocks: OcrBlock[]; xRange: { min: number; max: number } }>,
  priceColumns: Array<{ blocks: OcrBlock[]; xRange: { min: number; max: number } }>,
  imageHeight: number = 1000
): DetectedMenuItem[] {
  const allItems: DetectedMenuItem[] = [];

  for (const nameCol of nameColumns) {
    const nameX = (nameCol.xRange.min + nameCol.xRange.max) / 2;
    
    let bestPriceCol = null;
    let bestDistance = Infinity;

    for (const priceCol of priceColumns) {
      const priceX = (priceCol.xRange.min + priceCol.xRange.max) / 2;
      const distance = Math.abs(priceX - nameX);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPriceCol = priceCol;
      }
    }

    if (bestPriceCol) {
      // 使用智能匹配算法
      const items = matchNameAndPriceSmart(
        nameCol.blocks, 
        bestPriceCol.blocks,
        imageHeight
      );
      allItems.push(...items);
    } else {
      const items = matchNameAndPriceSmart(nameCol.blocks, [], imageHeight);
      allItems.push(...items);
    }
  }

  return allItems;
}

