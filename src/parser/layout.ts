/**
 * OCR 版面解析
 * 将 Google Vision API 的响应转换为统一的内部结构
 */

import type { OcrBlock, OcrPage, BoundingBox, OcrWord } from '../types/ocr';
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
 * 将 Google Vision 的响应转换为统一的内部结构
 * 
 * @param response - Google Vision API 的响应
 * @returns 统一后的 OCR 页面结构
 */
export function normalizeGoogleVisionResponse(
  response: GoogleVisionResponse
): OcrPage | null {
  const fullText = response.fullTextAnnotation;
  if (!fullText || !fullText.pages || fullText.pages.length === 0) {
    console.warn('No pages detected in OCR response');
    return null;
  }

  // 取第一页（如果有多页，可以扩展）
  const page = fullText.pages[0];
  const pageWidth = page.width || 0;
  const pageHeight = page.height || 0;

  const blocks: OcrBlock[] = [];

  // 遍历所有块（block）
  if (page.blocks) {
    for (const block of page.blocks) {
      if (!block.boundingBox || !block.boundingBox.vertices) {
        continue;
      }

      const blockBbox = verticesToBbox(block.boundingBox.vertices);
      const words: OcrWord[] = [];

      // 遍历该块的所有段落（paragraph）
      if (block.paragraphs) {
        for (const paragraph of block.paragraphs) {
          if (!paragraph.boundingBox || !paragraph.boundingBox.vertices) {
            continue;
          }

          // 遍历段落中的所有词（word）
          if (paragraph.words) {
            for (const word of paragraph.words) {
              if (!word.boundingBox || !word.boundingBox.vertices) {
                continue;
              }

              const wordBbox = verticesToBbox(word.boundingBox.vertices);
              
              // 从符号（symbol）中提取文本
              let wordText = '';
              if (word.symbols) {
                wordText = word.symbols
                  .map(s => s.text || '')
                  .join('');
              }

              if (wordText) {
                words.push({
                  text: wordText,
                  bbox: wordBbox,
                });
              }
            }
          }
        }
      }

      // 从该块的所有词中组合成块的文本
      const blockText = words.map(w => w.text).join(' ');

      if (blockText.trim()) {
        blocks.push({
          text: blockText.trim(),
          bbox: blockBbox,
          words,
        });
      }
    }
  }

  return {
    width: pageWidth,
    height: pageHeight,
    blocks,
  };
}

/**
 * 按 Y 坐标排序块（从上到下）
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



