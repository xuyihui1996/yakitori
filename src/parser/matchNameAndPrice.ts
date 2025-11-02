/**
 * 名字列和价格列匹配
 * 根据 Y 坐标将菜名和价格匹配起来
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
 * 将菜名块和价格块按 Y 坐标匹配
 * 
 * 算法：
 * 1. 对每个菜名块，在所有价格块中找 Y 坐标最接近的
 * 2. 如果距离太远（超过阈值），认为没有对应的价格
 * 
 * @param nameBlocks - 菜名块列表
 * @param priceBlocks - 价格块列表
 * @param maxYDistance - 最大 Y 距离（超过这个距离认为不匹配），默认 50px
 * @returns 匹配后的菜单项
 */
export function matchNameAndPrice(
  nameBlocks: OcrBlock[],
  priceBlocks: OcrBlock[],
  maxYDistance: number = 50
): DetectedMenuItem[] {
  const items: DetectedMenuItem[] = [];

  // 记录已经被匹配的价格块（避免一个价格被多个菜名使用）
  const usedPriceBlocks = new Set<OcrBlock>();

  for (const nb of nameBlocks) {
    const ny = centerY(nb);
    let best: OcrBlock | null = null;
    let bestScore = Infinity;

    for (const pb of priceBlocks) {
      // 跳过已被使用的价格块
      if (usedPriceBlocks.has(pb)) continue;

      const py = centerY(pb);
      const dy = Math.abs(py - ny);

      if (dy < bestScore) {
        bestScore = dy;
        best = pb;
      }
    }

    // 如果距离太远，认为没有对应的价格
    if (best && bestScore > maxYDistance) {
      best = null;
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
      sourceColumn: nb.bbox.x, // 暂时用 x 坐标标识来源
      confidence: best && price ? 0.9 : 0.5,
      needsReview: !best || !price || name.length < 2,
    });
  }

  return items;
}

/**
 * 从多个菜名列和多个价格列中匹配
 * 
 * 策略：
 * 1. 对每个菜名列，找到 X 坐标最近的价格列
 * 2. 在这对列之间进行 Y 坐标匹配
 * 
 * @param nameColumns - 菜名列数组（每列包含多个块）
 * @param priceColumns - 价格列数组
 * @returns 所有匹配后的菜单项
 */
export function matchMultipleColumns(
  nameColumns: Array<{ blocks: OcrBlock[]; xRange: { min: number; max: number } }>,
  priceColumns: Array<{ blocks: OcrBlock[]; xRange: { min: number; max: number } }>
): DetectedMenuItem[] {
  const allItems: DetectedMenuItem[] = [];

  for (const nameCol of nameColumns) {
    // 找到 X 坐标最近的价格列
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

    // 如果找到了价格列，进行匹配
    if (bestPriceCol) {
      const items = matchNameAndPrice(nameCol.blocks, bestPriceCol.blocks);
      allItems.push(...items);
    } else {
      // 没有价格列，只添加菜名
      const items = matchNameAndPrice(nameCol.blocks, []);
      allItems.push(...items);
    }
  }

  return allItems;
}



