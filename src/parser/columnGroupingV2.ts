/**
 * 列分组算法 V2
 * 针对 Word 级别的 OCR 结果优化
 * 更适合竖排日文菜单
 */

import type { OcrBlock, ColumnGroup } from '../types/ocr';
import { getBlockCenterX, getBlockCenterY, sortBlocksByY } from './layoutV2';

/**
 * 将 words 按列分组（针对竖排菜单优化）
 * 
 * **关键改进**：
 * 1. 使用更小的列间距阈值（因为 word 更细碎）
 * 2. 使用聚类算法而不是简单的距离比较
 * 3. 考虑 Y 坐标的重叠（同一列的 words Y 范围应该相似）
 * 
 * @param blocks - OCR 识别的 word 列表
 * @param options - 选项
 * @returns 列分组结果
 */
export function groupWordsIntoColumns(
  blocks: OcrBlock[],
  options: {
    maxColumnGap?: number;  // 列间距阈值（像素），默认自动计算
    pageWidth?: number;
  } = {}
): ColumnGroup[] {
  if (blocks.length === 0) {
    return [];
  }

  const pageWidth = options.pageWidth || Math.max(...blocks.map(b => b.bbox.x + b.bbox.width));

  // 自动计算列间距阈值：页面宽度的 3%（比之前的 8% 小很多）
  const autoGap = pageWidth * 0.03;
  const gapThreshold = options.maxColumnGap || autoGap;

  console.log(`📏 页面宽度: ${pageWidth}px, 列间距阈值: ${gapThreshold.toFixed(0)}px`);

  // 第1步：按 X 中心点排序
  const blocksWithCenter = blocks.map(block => ({
    block,
    centerX: getBlockCenterX(block),
    centerY: getBlockCenterY(block),
  }));

  blocksWithCenter.sort((a, b) => a.centerX - b.centerX);

  // 第2步：使用简单的聚类算法分组
  // 如果两个 word 的 X 距离 < 阈值，归为同一列
  const columns: ColumnGroup[] = [];

  for (const { block, centerX } of blocksWithCenter) {
    // 找到最匹配的列
    let bestColumn: ColumnGroup | null = null;
    let minDistance = Infinity;

    for (const column of columns) {
      // 计算该列的平均 X 中心点
      const avgCenterX = column.blocks.reduce((sum, b) => sum + getBlockCenterX(b), 0) / column.blocks.length;
      const distance = Math.abs(centerX - avgCenterX);

      if (distance < gapThreshold && distance < minDistance) {
        minDistance = distance;
        bestColumn = column;
      }
    }

    // 如果找到匹配的列，加入；否则创建新列
    if (bestColumn) {
      bestColumn.blocks.push(block);
      bestColumn.xRange.min = Math.min(bestColumn.xRange.min, block.bbox.x);
      bestColumn.xRange.max = Math.max(bestColumn.xRange.max, block.bbox.x + block.bbox.width);
    } else {
      columns.push({
        columnIndex: columns.length,
        blocks: [block],
        xRange: {
          min: block.bbox.x,
          max: block.bbox.x + block.bbox.width,
        },
      });
    }
  }

  // 第3步：对每列按 Y 排序
  for (const column of columns) {
    column.blocks = sortBlocksByY(column.blocks);
  }

  // 第4步：按列的平均 X 排序
  columns.sort((a, b) => {
    const avgA = a.blocks.reduce((sum, b) => sum + getBlockCenterX(b), 0) / a.blocks.length;
    const avgB = b.blocks.reduce((sum, b) => sum + getBlockCenterX(b), 0) / b.blocks.length;
    return avgA - avgB;
  });

  // 重新分配列号
  columns.forEach((column, index) => {
    column.columnIndex = index;
    const avgX = column.blocks.reduce((sum, b) => sum + getBlockCenterX(b), 0) / column.blocks.length;
    console.log(`📋 列 ${index}: ${column.blocks.length} 个 words, 平均 X = ${avgX.toFixed(0)}px`);
  });

  return columns;
}

/**
 * 合并过于靠近的列
 * 有时候同一列的 words 会被错误分成两列
 */
export function mergeCloseColumns(columns: ColumnGroup[], minGap: number = 20): ColumnGroup[] {
  if (columns.length <= 1) return columns;

  const merged: ColumnGroup[] = [];
  let current = columns[0];

  for (let i = 1; i < columns.length; i++) {
    const next = columns[i];
    
    // 计算两列的平均 X
    const currentAvgX = current.blocks.reduce((sum, b) => sum + getBlockCenterX(b), 0) / current.blocks.length;
    const nextAvgX = next.blocks.reduce((sum, b) => sum + getBlockCenterX(b), 0) / next.blocks.length;
    const gap = nextAvgX - currentAvgX;

    if (gap < minGap) {
      // 合并
      console.log(`🔗 合并列 ${current.columnIndex} 和 ${next.columnIndex} (间距: ${gap.toFixed(0)}px)`);
      current.blocks.push(...next.blocks);
      current.blocks = sortBlocksByY(current.blocks);
      current.xRange.min = Math.min(current.xRange.min, next.xRange.min);
      current.xRange.max = Math.max(current.xRange.max, next.xRange.max);
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);

  // 重新分配列号
  merged.forEach((column, index) => {
    column.columnIndex = index;
  });

  return merged;
}


