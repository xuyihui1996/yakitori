/**
 * 竖排文字合并器
 * 将同一竖列的相邻 words 合并成完整的项（菜名或价格）
 * 
 * 这是竖排菜单解析的关键步骤！
 */

import type { OcrBlock } from '../types/ocr';
import { getBlockCenterX, getBlockCenterY } from './layoutV2';

/**
 * 判断两个 block 是否在同一竖列
 */
function isSameVerticalLine(a: OcrBlock, b: OcrBlock, maxXDistance: number = 15): boolean {
  const ax = getBlockCenterX(a);
  const bx = getBlockCenterX(b);
  return Math.abs(ax - bx) < maxXDistance;
}

/**
 * 判断两个 block 在 Y 方向上是否相邻
 */
function isVerticallyAdjacent(a: OcrBlock, b: OcrBlock, maxYGap: number = 10): boolean {
  // a 在上，b 在下
  const aBottom = a.bbox.y + a.bbox.height;
  const bTop = b.bbox.y;
  const gap = bTop - aBottom;
  
  return gap >= -5 && gap <= maxYGap; // 允许轻微重叠
}

/**
 * 将竖排的 words 合并成完整的项
 * 
 * 算法：
 * 1. 按 Y 坐标排序所有 words
 * 2. 从上到下扫描，如果两个 word 在同一竖列且相邻，合并它们
 * 3. 重复直到没有可合并的 words
 * 
 * @param blocks - OCR 识别的 words
 * @returns 合并后的 blocks
 */
export function mergeVerticalWords(blocks: OcrBlock[]): OcrBlock[] {
  if (blocks.length === 0) return [];

  // 按 Y 坐标排序
  const sorted = [...blocks].sort((a, b) => a.bbox.y - b.bbox.y);

  let merged: OcrBlock[] = [];
  let changed = true;

  // 初始化
  merged = sorted.map(b => ({ ...b }));

  // 迭代合并，直到没有新的合并发生
  while (changed) {
    changed = false;
    const newMerged: OcrBlock[] = [];
    const used = new Set<number>();

    for (let i = 0; i < merged.length; i++) {
      if (used.has(i)) continue;

      const current = merged[i];
      let combined = false;

      // 尝试与后面的 words 合并
      for (let j = i + 1; j < merged.length; j++) {
        if (used.has(j)) continue;

        const next = merged[j];

        // 检查是否应该合并
        if (
          isSameVerticalLine(current, next, 15) &&
          isVerticallyAdjacent(current, next, 15)
        ) {
          // 合并！
          const mergedBlock: OcrBlock = {
            text: current.text + next.text,
            bbox: {
              x: Math.min(current.bbox.x, next.bbox.x),
              y: current.bbox.y,
              width: Math.max(
                current.bbox.x + current.bbox.width,
                next.bbox.x + next.bbox.width
              ) - Math.min(current.bbox.x, next.bbox.x),
              height: (next.bbox.y + next.bbox.height) - current.bbox.y,
            },
            words: [],
            confidence: ((current.confidence || 0) + (next.confidence || 0)) / 2,
          };

          newMerged.push(mergedBlock);
          used.add(i);
          used.add(j);
          changed = true;
          combined = true;
          break;
        }
      }

      // 如果没有合并，保留原样
      if (!combined) {
        newMerged.push(current);
        used.add(i);
      }
    }

    merged = newMerged;
  }

  console.log(`🔗 竖排合并: ${blocks.length} words → ${merged.length} items`);

  return merged;
}

/**
 * 过滤掉太短的项（可能是噪音）
 * 但保留看起来像价格的项
 */
export function filterShortItems(blocks: OcrBlock[]): OcrBlock[] {
  return blocks.filter(b => {
    const text = b.text.trim();
    
    // 长度 >= 2，保留
    if (text.length >= 2) return true;

    // 单字符，但如果是数字或"円"，保留
    if (text.length === 1) {
      if (/[0-9０-９一二三四五六七八九〇零円]/.test(text)) {
        return true;
      }
      return false;
    }

    return false;
  });
}


