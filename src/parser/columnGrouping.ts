/**
 * 按列分组算法
 * 
 * 将 OCR 识别的块按照 x 中心点分成多个竖列
 * 适用于竖排日文菜单
 */

import type { OcrBlock, ColumnGroup } from '../types/ocr';
import { sortBlocksByY, getBlockCenterX } from './layout';

/**
 * 将块按列分组
 * 
 * @param blocks - OCR 识别的块列表
 * @param options - 选项
 * @param options.maxColumnGap - 列之间的最大间距（页面宽度的百分比），默认 8%
 * @param options.pageWidth - 页面宽度（用于计算间距阈值）
 * @returns 列分组结果
 * 
 * 算法思路：
 * 1. 计算每个块的 x 中心点
 * 2. 按 x 中心点排序
 * 3. 从左到右扫描：如果当前块与前一个列的平均 x 距离小于阈值，归入该列；否则创建新列
 * 
 * 阈值调整建议：
 * - 如果菜单列数较少（2-3列），可以增大 maxColumnGap 到 10-12%
 * - 如果菜单列数较多（4-6列），可以减小 maxColumnGap 到 5-6%
 * - 如果识别结果中出现同一列被分成多列，减小阈值
 * - 如果识别结果中不同列被合并，增大阈值
 */
export function groupBlocksIntoColumns(
  blocks: OcrBlock[],
  options: {
    maxColumnGap?: number;  // 默认 8%
    pageWidth: number;
  } = { pageWidth: 0 }
): ColumnGroup[] {
  if (blocks.length === 0) {
    return [];
  }

  const maxGap = (options.maxColumnGap ?? 8) / 100; // 转换为小数
  const pageWidth = options.pageWidth || Math.max(...blocks.map(b => b.bbox.x + b.bbox.width));
  const gapThreshold = pageWidth * maxGap;

  // 计算每个块的 x 中心点并排序
  const blocksWithCenter = blocks.map(block => ({
    block,
    centerX: getBlockCenterX(block),
  }));

  blocksWithCenter.sort((a, b) => a.centerX - b.centerX);

  // 从左到右扫描，分组
  const columns: ColumnGroup[] = [];
  
  for (const { block, centerX } of blocksWithCenter) {
    // 找到最近的列
    let matchedColumn: ColumnGroup | null = null;
    let minDistance = Infinity;

    for (const column of columns) {
      // 计算该列的平均 x 中心点
      const avgCenterX = column.blocks.reduce((sum, b) => sum + getBlockCenterX(b), 0) / column.blocks.length;
      const distance = Math.abs(centerX - avgCenterX);

      if (distance < gapThreshold && distance < minDistance) {
        minDistance = distance;
        matchedColumn = column;
      }
    }

    // 如果找到匹配的列，加入该列；否则创建新列
    if (matchedColumn) {
      matchedColumn.blocks.push(block);
      // 更新 x 范围
      matchedColumn.xRange.min = Math.min(matchedColumn.xRange.min, block.bbox.x);
      matchedColumn.xRange.max = Math.max(matchedColumn.xRange.max, block.bbox.x + block.bbox.width);
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

  // 对每个列的块按 Y 排序（从上到下）
  for (const column of columns) {
    column.blocks = sortBlocksByY(column.blocks);
  }

  // 按列的平均 x 排序（从左到右）
  columns.sort((a, b) => {
    const avgA = a.blocks.reduce((sum, b) => sum + getBlockCenterX(b), 0) / a.blocks.length;
    const avgB = b.blocks.reduce((sum, b) => sum + getBlockCenterX(b), 0) / b.blocks.length;
    return avgA - avgB;
  });

  // 重新分配列号
  columns.forEach((column, index) => {
    column.columnIndex = index;
  });

  return columns;
}

/**
 * 将同一列的块按 Y 坐标排序（从上到下）
 * 
 * @param blocks - 同一列的块
 * @returns 排序后的块列表
 */
export function sortBlocksInColumnByY(blocks: OcrBlock[]): OcrBlock[] {
  return sortBlocksByY(blocks);
}



