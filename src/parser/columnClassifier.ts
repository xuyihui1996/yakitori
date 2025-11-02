/**
 * 列分类器
 * 判断一列是菜名列还是价格列
 */

import type { OcrBlock, ColumnGroup, ColumnType } from '../types/ocr';

/**
 * 分类单个列
 * 
 * 算法：统计该列中"像价格"的块的比例
 * 如果超过 60%，认为是价格列；否则是菜名列
 * 
 * @param blocks - 该列的所有块
 * @returns 列类型
 */
export function classifyColumn(blocks: OcrBlock[]): ColumnType {
  if (blocks.length === 0) return 'unknown';

  let priceLike = 0;

  for (const b of blocks) {
    const t = b.text.replace(/\s+/g, '');

    // 价格列的典型特征：几乎都是"数字/日文数字 + 円"
    // 1. 纯数字+円：120円, １２０円
    if (/^[一二三四五六七八九〇零十百千0-9０-９]+円?$/.test(t)) {
      priceLike++;
      continue;
    }

    // 2. 混合格式：三00円, 四50円
    if (/^[一二三四五六七八九〇零]+[0-9０-９]+円?$/.test(t)) {
      priceLike++;
      continue;
    }

    // 3. 只有数字（没有円）：120, １２０
    if (/^[0-9０-９]{2,4}$/.test(t)) {
      // 两到四位数字，很可能是价格
      priceLike++;
      continue;
    }

    // 4. 只有日文数字（没有円）：二五〇
    if (/^[一二三四五六七八九〇零]{2,4}$/.test(t)) {
      priceLike++;
      continue;
    }
  }

  const ratio = priceLike / blocks.length;
  
  // 降低阈值：从 0.6 → 0.4，让更多列被识别为价格列
  // 原因：有些价格列混有标题或说明文字，导致比例不到 60%
  return ratio > 0.4 ? 'price' : 'name';
}

/**
 * 对所有列进行分类
 * 
 * @param columns - 列分组
 * @returns 分类后的列（原地修改 type 字段）
 */
export function classifyColumns(columns: ColumnGroup[]): ColumnGroup[] {
  for (const column of columns) {
    column.type = classifyColumn(column.blocks);
  }
  return columns;
}

/**
 * 分离菜名列和价格列
 * 
 * @param columns - 已分类的列
 * @returns 分离后的菜名列和价格列
 */
export function separateNameAndPriceColumns(columns: ColumnGroup[]): {
  nameColumns: ColumnGroup[];
  priceColumns: ColumnGroup[];
} {
  const nameColumns: ColumnGroup[] = [];
  const priceColumns: ColumnGroup[] = [];

  for (const column of columns) {
    if (column.type === 'price') {
      priceColumns.push(column);
    } else if (column.type === 'name') {
      nameColumns.push(column);
    }
  }

  return { nameColumns, priceColumns };
}

