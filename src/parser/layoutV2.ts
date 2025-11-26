/**
 * OCR 版面解析 V2
 * 使用 Word 级别的解析，更适合竖排日文菜单
 */

import type { OcrBlock, OcrPage, BoundingBox } from '../types/ocr';
import type { GoogleVisionResponse } from '../ocr/googleVision';

/**
 * 从 Google Vision 的顶点数组计算边界框
 */
function verticesToBbox(vertices: Array<{ x: number; y: number }>): BoundingBox {
  if (vertices.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const xs = vertices.map(v => v.x || 0);
  const ys = vertices.map(v => v.y || 0);

  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;

  return { x, y, width, height };
}

/**
 * 将 Google Vision 的响应转换为 Word 级别的结构
 * **关键改进**：不再使用 block 级别，直接提取所有 words
 * 
 * @param response - Google Vision API 的响应
 * @returns 统一后的 OCR 页面结构（每个 word 是一个独立的 block）
 */
export function normalizeGoogleVisionResponseV2(
  response: GoogleVisionResponse
): OcrPage | null {
  const fullText = response.fullTextAnnotation;
  if (!fullText || !fullText.pages || fullText.pages.length === 0) {
    console.warn('No pages detected in OCR response');
    return null;
  }

  // 取第一页
  const page = fullText.pages[0];
  const pageWidth = page.width || 0;
  const pageHeight = page.height || 0;

  const wordBlocks: OcrBlock[] = [];

  // 遍历所有块
  if (page.blocks) {
    for (const block of page.blocks) {
      // 遍历该块的所有段落
      if (block.paragraphs) {
        for (const paragraph of block.paragraphs) {
          // 遍历段落中的所有词
          if (paragraph.words) {
            for (const word of paragraph.words) {
              if (!word.boundingBox || !word.boundingBox.vertices) {
                continue;
              }

              const wordBbox = verticesToBbox(word.boundingBox.vertices);
              
              // 从符号中提取文本
              let wordText = '';
              let confidence = 0;
              let symbolCount = 0;

              if (word.symbols) {
                for (const symbol of word.symbols) {
                  wordText += symbol.text || '';
                  if (symbol.confidence !== undefined) {
                    confidence += symbol.confidence;
                    symbolCount++;
                  }
                }
              }

              // 计算平均置信度
              const avgConfidence = symbolCount > 0 ? confidence / symbolCount : 0.9;

              if (wordText.trim()) {
                // **关键**：把每个 word 当作一个独立的 block
                wordBlocks.push({
                  text: wordText.trim(),
                  bbox: wordBbox,
                  words: [], // word 级别不需要再嵌套
                  confidence: avgConfidence,
                });
              }
            }
          }
        }
      }
    }
  }

  console.log(`📊 提取了 ${wordBlocks.length} 个 words`);

  return {
    width: pageWidth,
    height: pageHeight,
    blocks: wordBlocks, // 这里的 blocks 实际上是 words
  };
}

/**
 * 按 Y 坐标排序块
 */
export function sortBlocksByY(blocks: OcrBlock[]): OcrBlock[] {
  return [...blocks].sort((a, b) => a.bbox.y - b.bbox.y);
}

/**
 * 计算块的中心点
 */
export function getBlockCenterX(block: OcrBlock): number {
  return block.bbox.x + block.bbox.width / 2;
}

/**
 * 计算块的中心 Y 坐标
 */
export function getBlockCenterY(block: OcrBlock): number {
  return block.bbox.y + block.bbox.height / 2;
}


