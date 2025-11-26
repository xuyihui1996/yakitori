/**
 * 菜单图片解析服务
 * 
 * 主入口：parseMenuImageToItems
 * 
 * 流程：
 * 1. 调用 OCR（Google Vision）
 * 2. 规范化 OCR 结果
 * 3. 按列分组
 * 4. 每行解析（菜名+价格）
 * 5. 组装结果
 * 
 * 将来可以接入的 OCR 服务：
 * - Azure Computer Vision: 在 googleVision.ts 中添加对应的 normalizeAzureResponse()
 * - AWS Textract: 在 googleVision.ts 中添加对应的 normalizeAwsTextractResponse()
 * - PaddleOCR: 可以创建 paddleOcr.ts，然后在此处切换
 */

import { runOcrOnImage } from '../ocr/googleVision';
// import { normalizeGoogleVisionResponse } from './layout';
import { normalizeGoogleVisionResponseV2 } from './layoutV2';
// import { groupBlocksIntoColumns } from './columnGrouping';
import { groupWordsIntoColumns, mergeCloseColumns } from './columnGroupingV2';
import { mergeVerticalWords } from './verticalMerger';
import { parseMenuLine } from './lineToMenuItem';
import { classifyColumns, separateNameAndPriceColumns } from './columnClassifier';
// import { matchMultipleColumns } from './matchNameAndPrice';
import { matchMultipleColumnsV2 } from './matchNameAndPriceV2';
import { filterNoiseBlocks, isTitleBlock } from './noiseFilter';
import type { OcrInput, DetectedMenuItem, ParseMenuOptions } from '../types/ocr';

/**
 * 解析菜单图片，生成候选菜单项
 * 
 * @param input - 图片输入（Buffer / base64 / URL）
 * @param options - 解析选项
 * @returns 检测到的菜单项列表（按列排序）
 * 
 * @example
 * ```typescript
 * // 从本地文件读取
 * import fs from 'fs';
 * const imageBuffer = fs.readFileSync('./menu.jpg');
 * const items = await parseMenuImageToItems(
 *   { type: 'buffer', data: imageBuffer },
 *   { languageHints: ['ja'], maxColumns: 4 }
 * );
 * 
 * // 从 URL 读取
 * const items = await parseMenuImageToItems(
 *   { type: 'url', data: 'https://example.com/menu.jpg' }
 * );
 * ```
 */
export async function parseMenuImageToItems(
  input: OcrInput,
  options: ParseMenuOptions = {}
): Promise<DetectedMenuItem[]> {
  const {
    languageHints = ['ja'],
    maxColumns = 10,
    maxColumnGap: _maxColumnGap = 8, // 保留以备将来使用
  } = options;

  try {
    // 第1步：调用 OCR
    const ocrResponse = await runOcrOnImage(input, languageHints);

    // 第2步：规范化 OCR 结果（使用 Word 级别的解析）
    const ocrPage = normalizeGoogleVisionResponseV2(ocrResponse);
    
    if (!ocrPage || ocrPage.blocks.length === 0) {
      console.warn('No blocks detected in OCR response');
      return [];
    }

    // 第2.3步：合并竖排的 words（关键步骤！）
    const mergedBlocks = mergeVerticalWords(ocrPage.blocks);

    // 第2.5步：过滤噪音块（说明文字等）
    const filteredBlocks = filterNoiseBlocks(mergedBlocks);
    
    if (filteredBlocks.length === 0) {
      console.warn('No valid blocks after filtering noise');
      return [];
    }

    // 第3步：按列分组（使用 V2 算法，针对 word 级别优化）
    let columns = groupWordsIntoColumns(filteredBlocks, {
      pageWidth: ocrPage.width,
    });

    // 合并过于靠近的列
    columns = mergeCloseColumns(columns, 30);

    // 限制列数
    if (columns.length > maxColumns) {
      console.warn(`Detected ${columns.length} columns, limiting to ${maxColumns}`);
      columns.splice(maxColumns);
    }

    // 第4步：判断使用哪种解析策略
    // 如果只有一列，或者列数很少且没有明显的价格列，使用旧逻辑（横排/一行内有价格）
    if (columns.length <= 1) {
      console.log('Single column detected, using inline parsing');
      return parseSingleColumnMenu(columns);
    }

    // 第4.5步：对列进行分类（菜名列 vs 价格列）
    classifyColumns(columns);
    const { nameColumns, priceColumns } = separateNameAndPriceColumns(columns);

    console.log(`Detected ${nameColumns.length} name columns and ${priceColumns.length} price columns`);

    // 第5步：选择解析策略
    let allItems: DetectedMenuItem[] = [];

    if (nameColumns.length > 0 && priceColumns.length > 0) {
      // 策略 A：竖排多列菜单（菜名列 + 价格列分开）
      console.log('Using vertical multi-column parsing (name + price columns)');
      // 使用优化的匹配算法 V2（增大阈值 + 智能评分）
      allItems = matchMultipleColumnsV2(nameColumns, priceColumns, ocrPage.height);
    } else {
      // 策略 B：横排或混合（一行内有菜名+价格）
      console.log('Using inline parsing (name + price in same row)');
      allItems = parseSingleColumnMenu(columns);
    }

    // 第6步：标记标题块
    for (const item of allItems) {
      if (isTitleBlock(item.rawText)) {
        item.needsReview = true;
        item.note = '可能是标题或分类';
      }
    }

    // 第7步：排序（按列、按 Y 坐标、需要审核的放后面）
    const reviewed = allItems.filter(item => !item.needsReview);
    const needReview = allItems.filter(item => item.needsReview);

    reviewed.sort((a, b) => {
      if (a.sourceColumn !== b.sourceColumn) {
        return (a.sourceColumn ?? 0) - (b.sourceColumn ?? 0);
      }
      return (a.bbox?.y ?? 0) - (b.bbox?.y ?? 0);
    });

    needReview.sort((a, b) => {
      if (a.sourceColumn !== b.sourceColumn) {
        return (a.sourceColumn ?? 0) - (b.sourceColumn ?? 0);
      }
      return (a.bbox?.y ?? 0) - (b.bbox?.y ?? 0);
    });

    return [...reviewed, ...needReview];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Menu image parsing failed: ${errorMessage}`);
  }
}

/**
 * 解析单列或横排菜单（旧逻辑）
 * 一行内包含菜名+价格
 */
function parseSingleColumnMenu(columns: any[]): DetectedMenuItem[] {
  const allItems: DetectedMenuItem[] = [];

  for (const column of columns) {
    for (const block of column.blocks) {
      const parsed = parseMenuLine(block.text);

      const item: DetectedMenuItem = {
        name: parsed.name,
        price: parsed.price,
        rawText: block.text,
        bbox: block.bbox,
        sourceColumn: column.columnIndex,
        confidence: parsed.confidence,
        needsReview: parsed.needsReview,
      };

      allItems.push(item);
    }
  }

  return allItems;
}

// 导出所有类型和工具函数
export type { OcrInput, DetectedMenuItem, ParseMenuOptions } from '../types/ocr';
export { parseMenuLine } from './lineToMenuItem';
export { groupBlocksIntoColumns } from './columnGrouping';

