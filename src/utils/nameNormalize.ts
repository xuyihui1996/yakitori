/**
 * 菜品名称规范化工具
 * 统一处理全半角、空白、分隔符等，确保前后端一致
 */

/**
 * 规范化菜品名称
 * @param raw 原始名称
 * @returns 规范化后的名称
 */
export function normalizeDishName(raw: string): string {
  if (!raw) return '';
  
  return raw
    .normalize('NFKC')        // 全半角等归一（如全角空格转为半角）
    .replace(/\s+/g, ' ')     // 压缩多个空白字符为单个空格
    .replace(/[·\/]/g, '・')  // 统一分隔符（·和/都转为・）
    .trim();                  // 去除首尾空白
}

/**
 * 比较两个菜品名称是否相同（规范化后）
 * @param name1 名称1
 * @param name2 名称2
 * @returns 是否相同
 */
export function compareDishNames(name1: string, name2: string): boolean {
  return normalizeDishName(name1).toLowerCase() === normalizeDishName(name2).toLowerCase();
}

