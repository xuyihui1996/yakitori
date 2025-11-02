/**
 * 噪音过滤器
 * 过滤掉明显不是菜品的块（说明文字、标题等）
 */

import type { OcrBlock } from '../types/ocr';

/**
 * 非菜单项的正则模式
 * 匹配说明文字、标题栏等
 */
const NON_MENU_PATTERNS = [
  /消費税/,
  /税込/,
  /※/,
  /表示価格/,
  /です。?$/,
  /お品書/,
  /メニュー/,
  /menu/i,
  /価格/,
  /料金/,
  /串焼/,
  /揚物/,
  /飯物/,
  /一品物/,
  /鉄板物?焼物?/,
  /焼物/,
  /^品$/,  // 单独的"品"字
];

/**
 * 标题栏关键词
 * 这些通常是菜单分类标题
 */
const TITLE_KEYWORDS = [
  '串焼',
  '揚物',
  '飯物',
  '一品物',
  '鉄板焼物',
  '焼物',
  '品物',
  'メニュー',
  'お品書き',
];

/**
 * 判断是否为噪音块（不是菜品的块）
 * 
 * @param text - 块的文本
 * @returns true 表示是噪音，应该过滤掉
 */
export function isNoiseBlock(text: string): boolean {
  // 去掉所有空格后再判断
  const t = text.replace(/\s+/g, '');

  // 空文本
  if (!t) return true;

  // 匹配非菜单项模式
  if (NON_MENU_PATTERNS.some(r => r.test(t))) {
    return true;
  }

  // 只有一个字符（可能是分隔符或装饰）
  if (t.length === 1) {
    return true;
  }

  // 只包含符号和数字（没有文字）
  if (/^[・･\-…\s0-9０-９]+$/.test(t)) {
    return true;
  }

  return false;
}

/**
 * 判断是否为标题块
 * 标题块可以保留，但标记为 needsReview
 * 
 * @param text - 块的文本
 * @returns true 表示是标题
 */
export function isTitleBlock(text: string): boolean {
  const t = text.replace(/\s+/g, '');

  // 匹配标题关键词
  return TITLE_KEYWORDS.some(keyword => t.includes(keyword));
}

/**
 * 过滤噪音块
 * 
 * @param blocks - OCR 识别的所有块
 * @returns 过滤后的块
 */
export function filterNoiseBlocks(blocks: OcrBlock[]): OcrBlock[] {
  return blocks.filter(b => !isNoiseBlock(b.text));
}


