/**
 * 行文本解析
 * 将一行文本解析成"菜名 + 价格"
 * 
 * 支持的价格格式：
 * - 450円
 * - ４５0円（全角+半角混合）
 * - 三五〇円 / 五〇〇円 / 八〇〇円（日式汉数字）
 * - 500（没有円）
 * - ５００（全角）
 */

/**
 * 全角数字到半角数字的映射
 */
const FULL_WIDTH_DIGIT_MAP: Record<string, string> = {
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
};

/**
 * 日式汉数字到阿拉伯数字的映射
 */
const KANSUJI_MAP: Record<string, number> = {
  '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  '十': 10, '百': 100, '千': 1000,
  // 全角版本
  '０': 0, '１': 1, '２': 2, '３': 3, '４': 4,
  '５': 5, '６': 6, '７': 7, '８': 8, '９': 9,
  '零': 0, '壱': 1, '弐': 2, '参': 3,
};

/**
 * 将全角数字转换为半角
 */
function normalizeFullWidthDigits(text: string): string {
  return text
    .split('')
    .map(char => FULL_WIDTH_DIGIT_MAP[char] || char)
    .join('');
}

/**
 * 将日式汉数字转换为阿拉伯数字
 * 
 * 支持的格式：
 * - 三五〇 → 350（逐位转换）
 * - 五〇〇 → 500
 * - 八〇〇 → 800
 * - 一〇〇 → 100
 * - 二五 → 25
 * - 四五〇 → 450
 * 
 * 算法：检测两种模式
 * 1. 逐位转换模式：三五〇 → "350" → 350
 * 2. 带单位模式：三百五十 → 350
 */
function convertKansujiToNumber(kansuji: string): number | null {
  if (!kansuji) return null;

  const chars = kansuji.split('');
  
  // 检查是否包含单位（十/百/千）
  const hasUnit = chars.some(ch => {
    const digit = KANSUJI_MAP[ch];
    return digit === 10 || digit === 100 || digit === 1000;
  });

  if (!hasUnit) {
    // 逐位转换模式：三五〇 → "350"
    let resultStr = '';
    for (const char of chars) {
      const digit = KANSUJI_MAP[char];
      if (digit === undefined || digit >= 10) {
        return null; // 包含未知字符或单位
      }
      resultStr += digit.toString();
    }
    const result = parseInt(resultStr, 10);
    return isNaN(result) ? null : result;
  }

  // 带单位模式：三百五十 → 350
  let result = 0;
  let current = 0;

  for (const char of chars) {
    const digit = KANSUJI_MAP[char];

    if (digit === undefined) {
      return null;
    }

    if (digit < 10) {
      current = current * 10 + digit;
    } else if (digit === 10) {
      result += (current || 1) * 10;
      current = 0;
    } else if (digit === 100) {
      result += (current || 1) * 100;
      current = 0;
    } else if (digit === 1000) {
      result += (current || 1) * 1000;
      current = 0;
    }
  }

  return result + current;
}

/**
 * 从文本右侧提取价格
 * 
 * 匹配规则（按优先级）：
 * 1. 汉数字 + 円/えん/ｴﾝ：三五〇円
 * 2. 阿拉伯数字（全角/半角）+ 円/えん/ｴﾝ：450円、４５0円
 * 3. 阿拉伯数字（全角/半角）：500、５００
 */
function extractPriceFromText(text: string): { price: number; matchLength: number } | null {
  // 正则1：汉数字 + 円
  const kansujiPattern = /([〇一二三四五六七八九十百千万]+)\s*(円|えん|ｴﾝ)?$/;
  let match = text.match(kansujiPattern);
  
  if (match) {
    const kansuji = match[1];
    const price = convertKansujiToNumber(kansuji);
    if (price !== null) {
      return {
        price,
        matchLength: match[0].length,
      };
    }
  }

  // 正则2：阿拉伯数字（全角/半角）+ 円
  const digitYenPattern = /([0-9０-９]+)\s*(円|えん|ｴﾝ)?$/;
  match = text.match(digitYenPattern);
  
  if (match) {
    const digitStr = normalizeFullWidthDigits(match[1]);
    const price = parseInt(digitStr, 10);
    if (!isNaN(price) && price > 0) {
      return {
        price,
        matchLength: match[0].length,
      };
    }
  }

  // 正则3：纯数字（没有円）
  const digitOnlyPattern = /([0-9０-９]+)$/;
  match = text.match(digitOnlyPattern);
  
  if (match) {
    const digitStr = normalizeFullWidthDigits(match[1]);
    const price = parseInt(digitStr, 10);
    if (!isNaN(price) && price > 0) {
      return {
        price,
        matchLength: match[0].length,
      };
    }
  }

  return null;
}

/**
 * 解析一行文本，提取菜名和价格
 * 
 * @param raw - 原始文本行
 * @returns 解析结果
 */
export function parseMenuLine(raw: string): {
  name: string;
  price?: number;
  needsReview: boolean;
  confidence: number;
} {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      name: '',
      needsReview: true,
      confidence: 0,
    };
  }

  // 尝试提取价格
  const priceResult = extractPriceFromText(trimmed);

  if (priceResult) {
    // 找到了价格，提取菜名（去掉价格部分）
    const name = trimmed.slice(0, -priceResult.matchLength).trim();
    
    // 如果菜名为空，或者很短（可能是识别错误），标记需要审核
    const needsReview = name.length === 0 || name.length < 2;
    
    return {
      name: name || trimmed, // 如果提取不到菜名，保留原文
      price: priceResult.price,
      needsReview,
      confidence: needsReview ? 0.5 : 0.9, // 如果能提取价格，置信度较高
    };
  }

  // 没有找到价格，标记需要人工审核
  return {
    name: trimmed,
    needsReview: true,
    confidence: 0.3, // 无法提取价格，置信度较低
  };
}

