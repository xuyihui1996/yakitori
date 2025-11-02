// 价格识别和清洗
export function normalizePriceText(raw: string): string {
  return raw.replace(/[\s　・･…\.]/g, '');
}

function japaneseNumToArabic(s: string): number | null {
  const map: Record<string, string> = {
    '〇': '0', '零': '0', '一': '1', '二': '2', '三': '3', '四': '4',
    '五': '5', '六': '6', '七': '7', '八': '8', '九': '9'
  };
  const hasUnit = /[十百千]/.test(s);
  if (!hasUnit) {
    let result = '';
    for (const ch of s) result += map[ch] ?? '';
    const num = parseInt(result, 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

function fullWidthToHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - '０'.charCodeAt(0)));
}

export function parsePriceFromRaw(raw: string): number | undefined {
  const cleaned = normalizePriceText(raw);
  let m = cleaned.match(/([0-9０-９]+)円?$/);
  if (m) {
    const normalized = fullWidthToHalfWidth(m[1]);
    const price = Number(normalized);
    return isNaN(price) ? undefined : price;
  }
  m = cleaned.match(/([一二三四五六七八九〇零]+)円?$/);
  if (m) {
    const n = japaneseNumToArabic(m[1]);
    if (n !== null) return n;
  }
  m = cleaned.match(/([一二三四五六七八九〇零]+)([0-9０-９]+)円?$/);
  if (m) {
    const head = japaneseNumToArabic(m[1]) ?? 0;
    const tail = fullWidthToHalfWidth(m[2]);
    const price = Number(`${head}${tail}`);
    return isNaN(price) ? undefined : price;
  }
  return undefined;
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').replace(/^[・･\-]+/, '').replace(/[・･\-]+$/, '');
}
