/**
 * 导出文本工具函数
 * 用于生成给店家看的合并清单和给群里分享的文本
 */

import { Round, RoundItem } from '@/types';
import { merchantMenu } from '@/data/merchantMenu';
import { formatMoney, calculateTotal } from './money';
import { getRoundDisplayId } from './format';
import type { Locale } from '@/i18n/messages';
import { translate } from '@/i18n/global';
import { getDefaultLocale } from '@/i18n';

/**
 * 按菜名聚合订单项
 * @param items 订单项列表
 * @returns 聚合后的结果
 */
export function aggregateItemsByName(items: RoundItem[], targetLocale?: Locale): Array<{
  nameDisplay: string;
  price: number;
  totalQty: number;
  note?: string;
}> {
  // Build lookup map for normalization (lazy init or just rebuild here, it's small)
  const menuMap = new Map<string, typeof merchantMenu[0]>();
  merchantMenu.forEach(m => {
    menuMap.set(m.nameJa, m);
    menuMap.set(m.nameZh, m);
  });

  const map = new Map<string, {
    nameDisplay: string;
    price: number;
    totalQty: number;
    note?: string;
    isNormalized?: boolean;
  }>();

  items.forEach((item) => {
    if (item.deleted) return;

    // Try to find the canonical item
    const menuItem = menuMap.get(item.nameDisplay);

    // Group Key: use NameJa if found, otherwise original name
    const groupName = menuItem ? menuItem.nameJa : item.nameDisplay;
    const key = `${groupName}:${item.price}`;

    const existing = map.get(key);

    // Determine display name based on target locale
    let displayName = item.nameDisplay;
    if (menuItem && targetLocale) {
      displayName = targetLocale === 'zh' ? menuItem.nameZh : menuItem.nameJa;
    } else if (menuItem && !targetLocale) {
      // If no locale specified, maybe prefer the current item's name? 
      // Or default to Ja? Let's keep existing behavior if no locale: use item's name.
      // BUT, if we are merging "Tori"(Ja) and "Chicken"(Zh), we must pick ONE display name.
      // Usually we want the viewer's language.
      // If targetLocale is undefined, we might get mixed results if we don't pick one.
      // Let's default to the *first* item's name encountered if no locale, OR prefer Ja.
      // Let's prefer Ja if we normalized it, unless we have a specific reason.
      displayName = menuItem.nameJa;
    }

    if (existing) {
      existing.totalQty += item.qty;
      // If we found a normalized name now but didn't before (unlikely order-wise effectively), update it?
      // Actually, if we are merging, we should stick to the targetLocale name.
    } else {
      map.set(key, {
        nameDisplay: displayName,
        price: item.price,
        totalQty: item.qty,
        note: item.note, // Note: naive merging of notes
        isNormalized: !!menuItem
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
  items: RoundItem[],
  locale: Locale = getDefaultLocale()
): string {
  const t = (key: any, params?: any) => translate(locale, key, params);
  const aggregated = aggregateItemsByName(items, locale);
  const total = items
    .filter(item => !item.deleted)
    .reduce((sum, item) => sum + item.price * item.qty, 0);

  const roundDisplay = getRoundDisplayId(round.id);
  const roundNum = roundDisplay.match(/\d+/)?.[0] ?? roundDisplay;
  let text = `【${t('export.round', { n: roundNum })}】\n`;

  aggregated.forEach((item) => {
    const notePart = item.note ? ` (${item.note})` : '';
    text += `${item.nameDisplay}${notePart} ${formatMoney(item.price)} × ${item.totalQty}\n`;
  });

  text += `${t('export.subtotal')}: ${formatMoney(total)}\n`;

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
  groupId: string,
  locale: Locale = getDefaultLocale()
): string {
  const t = (key: any, params?: any) => translate(locale, key, params);
  let text = `━━━━━━━━━━━━━━━━\n`;
  text += `📋 ${t('export.full.title', { groupId })}\n`;
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
      text += generateRoundExportText(round, roundItems, locale);
      text += '\n';

      const roundTotal = roundItems
        .filter(item => !item.deleted)
        .reduce((sum, item) => sum + item.price * item.qty, 0);
      grandTotal += roundTotal;
    }
  });

  // 全部汇总
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `【${t('roundTabs.all')}】\n`;

  const allAggregated = aggregateItemsByName(allItems, locale);
  allAggregated.forEach((item) => {
    const notePart = item.note ? ` (${item.note})` : '';
    text += `${item.nameDisplay}${notePart} ${formatMoney(item.price)} × ${item.totalQty}\n`;
  });

  text += `\n${t('export.total')}: ${formatMoney(grandTotal)}\n`;
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
  userItems: RoundItem[],
  locale: Locale = getDefaultLocale()
): string {
  const t = (key: any, params?: any) => translate(locale, key, params);
  let text = `━━━━━━━━━━━━━━━━\n`;
  text += `💰 ${t('export.user.title', { userName })}\n`;
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
      const roundDisplay = getRoundDisplayId(round.id);
      const roundNum = roundDisplay.match(/\d+/)?.[0] ?? roundDisplay;
      text += `【${t('export.round', { n: roundNum })}】\n`;

      roundItems.forEach((item) => {
        const notePart = item.note ? ` (${item.note})` : '';
        const itemTotal = item.price * item.qty;
        text += `${item.nameDisplay}${notePart} ${formatMoney(item.price)} × ${item.qty} = ${formatMoney(itemTotal)}\n`;
        grandTotal += itemTotal;
      });

      const roundTotal = calculateTotal(roundItems);
      text += `${t('export.subtotal')}: ${formatMoney(roundTotal)}\n\n`;
    }
  });

  text += `━━━━━━━━━━━━━━━━\n`;
  text += `${t('export.total')}: ${formatMoney(grandTotal)}\n`;
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
