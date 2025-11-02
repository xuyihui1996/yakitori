/**
 * 导出文本工具函数
 * 用于生成给店家看的合并清单和给群里分享的文本
 */

import { Round, RoundItem } from '@/types';
import { formatMoney, calculateTotal } from './money';
import { getRoundDisplayId } from './format';

/**
 * 按菜名聚合订单项
 * @param items 订单项列表
 * @returns 聚合后的结果
 */
export function aggregateItemsByName(items: RoundItem[]): Array<{
  nameDisplay: string;
  price: number;
  totalQty: number;
  note?: string;
}> {
  const map = new Map<string, {
    nameDisplay: string;
    price: number;
    totalQty: number;
    note?: string;
  }>();

  items.forEach((item) => {
    if (item.deleted) return;

    const key = `${item.nameDisplay}:${item.price}`;
    const existing = map.get(key);

    if (existing) {
      existing.totalQty += item.qty;
    } else {
      map.set(key, {
        nameDisplay: item.nameDisplay,
        price: item.price,
        totalQty: item.qty,
        note: item.note
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => 
    a.nameDisplay.localeCompare(b.nameDisplay, 'ja')
  );
}

/**
 * 生成单轮的导出文本
 * @param round 轮次信息
 * @param items 该轮的所有订单项
 * @returns 文本字符串
 */
export function generateRoundExportText(
  round: Round,
  items: RoundItem[]
): string {
  const aggregated = aggregateItemsByName(items);
  const total = items
    .filter(item => !item.deleted)
    .reduce((sum, item) => sum + item.price * item.qty, 0);

  const roundNum = getRoundDisplayId(round.id).replace('R', '');
  let text = `【第${roundNum}轮】\n`;
  
  aggregated.forEach((item) => {
    const notePart = item.note ? ` (${item.note})` : '';
    text += `${item.nameDisplay}${notePart} ${formatMoney(item.price)} × ${item.totalQty}\n`;
  });

  text += `小计: ${formatMoney(total)}\n`;

  return text;
}

/**
 * 生成全部轮次的导出文本
 * @param rounds 所有轮次
 * @param allItems 所有订单项
 * @param groupId 桌号
 * @returns 完整的导出文本
 */
export function generateFullExportText(
  rounds: Round[],
  allItems: RoundItem[],
  groupId: string
): string {
  let text = `━━━━━━━━━━━━━━━━\n`;
  text += `📋 点单汇总 - 桌号: ${groupId}\n`;
  text += `━━━━━━━━━━━━━━━━\n\n`;

  // 按轮次排序
  const sortedRounds = [...rounds].sort((a, b) => 
    a.createdAt.localeCompare(b.createdAt)
  );

  let grandTotal = 0;

  // 每轮的明细
  sortedRounds.forEach((round) => {
    const roundItems = allItems.filter(item => item.roundId === round.id);
    if (roundItems.length > 0) {
      text += generateRoundExportText(round, roundItems);
      text += '\n';
      
      const roundTotal = roundItems
        .filter(item => !item.deleted)
        .reduce((sum, item) => sum + item.price * item.qty, 0);
      grandTotal += roundTotal;
    }
  });

  // 全部汇总
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `【全部】\n`;
  
  const allAggregated = aggregateItemsByName(allItems);
  allAggregated.forEach((item) => {
    const notePart = item.note ? ` (${item.note})` : '';
    text += `${item.nameDisplay}${notePart} ${formatMoney(item.price)} × ${item.totalQty}\n`;
  });

  text += `\n合计: ${formatMoney(grandTotal)}\n`;
  text += `━━━━━━━━━━━━━━━━\n`;

  return text;
}

/**
 * 生成个人账单文本
 * @param userName 用户名
 * @param rounds 轮次列表
 * @param userItems 用户的所有订单项
 * @returns 个人账单文本
 */
export function generateUserBillText(
  userName: string,
  rounds: Round[],
  userItems: RoundItem[]
): string {
  let text = `━━━━━━━━━━━━━━━━\n`;
  text += `💰 ${userName} 的账单\n`;
  text += `━━━━━━━━━━━━━━━━\n\n`;

  const sortedRounds = [...rounds].sort((a, b) => 
    a.createdAt.localeCompare(b.createdAt)
  );

  let grandTotal = 0;

  sortedRounds.forEach((round) => {
    const roundItems = userItems.filter(
      item => item.roundId === round.id && !item.deleted
    );
    
    if (roundItems.length > 0) {
      const roundNum = getRoundDisplayId(round.id).replace('R', '');
      text += `【第${roundNum}轮】\n`;
      
      roundItems.forEach((item) => {
        const notePart = item.note ? ` (${item.note})` : '';
        const itemTotal = item.price * item.qty;
        text += `${item.nameDisplay}${notePart} ${formatMoney(item.price)} × ${item.qty} = ${formatMoney(itemTotal)}\n`;
        grandTotal += itemTotal;
      });
      
      const roundTotal = calculateTotal(roundItems);
      text += `轮次小计: ${formatMoney(roundTotal)}\n\n`;
    }
  });

  text += `━━━━━━━━━━━━━━━━\n`;
  text += `总计: ${formatMoney(grandTotal)}\n`;
  text += `━━━━━━━━━━━━━━━━\n`;

  return text;
}

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        textArea.remove();
        return true;
      } catch (error) {
        console.error('Fallback: Could not copy text', error);
        textArea.remove();
        return false;
      }
    }
  } catch (error) {
    console.error('Failed to copy text', error);
    return false;
  }
}

