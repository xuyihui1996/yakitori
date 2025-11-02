/**
 * 金额相关工具函数
 */

/**
 * 格式化金额（日元）
 * @param amount 金额
 * @returns 格式化后的字符串，例如 "¥1,234"
 */
export function formatMoney(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/**
 * 格式化金额（人民币）
 * @param amount 金额
 * @returns 格式化后的字符串，例如 "¥1,234"
 */
export function formatMoneyCNY(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * 计算总金额
 * @param items 包含price和qty的项目列表
 * @returns 总金额
 */
export function calculateTotal(items: Array<{ price: number; qty: number }>): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/**
 * 安全的金额运算（避免浮点数精度问题）
 * @param a 金额1
 * @param b 金额2
 * @param operation 运算类型
 * @returns 运算结果
 */
export function safeMoneyOperation(
  a: number,
  b: number,
  operation: 'add' | 'subtract' | 'multiply' | 'divide'
): number {
  // 转换为整数运算避免浮点数问题
  const factor = 100; // 假设最多2位小数
  const aInt = Math.round(a * factor);
  const bInt = Math.round(b * factor);

  let result: number;
  switch (operation) {
    case 'add':
      result = (aInt + bInt) / factor;
      break;
    case 'subtract':
      result = (aInt - bInt) / factor;
      break;
    case 'multiply':
      result = (aInt * bInt) / (factor * factor);
      break;
    case 'divide':
      result = aInt / bInt;
      break;
  }

  return Math.round(result * 100) / 100; // 保留2位小数
}

