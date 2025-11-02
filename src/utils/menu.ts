/**
 * 菜单相关工具函数
 * 核心：菜单去重逻辑，按 (nameDisplay, price) 作为唯一key
 */

import { GroupMenuItem, MenuConflict } from '@/types';

/**
 * 生成菜单项的唯一key
 * @param nameDisplay 菜名
 * @param price 价格
 * @returns 唯一标识符
 */
export function getMenuItemKey(nameDisplay: string, price: number): string {
  return `${nameDisplay.trim()}:${price}`;
}

/**
 * 检查菜单项是否冲突
 * @param existingMenu 现有菜单列表
 * @param newItem 新增的菜单项
 * @returns 冲突信息
 */
export function checkMenuConflict(
  existingMenu: GroupMenuItem[],
  newItem: { nameDisplay: string; price: number }
): MenuConflict {
  // 查找同名菜品
  const sameNameItems = existingMenu.filter(
    (item) => item.nameDisplay.trim() === newItem.nameDisplay.trim() && item.status === 'active'
  );

  if (sameNameItems.length === 0) {
    return { exists: false };
  }

  // 检查是否有同名同价的
  const exactMatch = sameNameItems.find((item) => item.price === newItem.price);
  if (exactMatch) {
    return {
      exists: true,
      existingItem: exactMatch,
      message: '该菜品已存在于菜单中'
    };
  }

  // 同名不同价 - 这是冲突
  // 如果有多个同名不同价的项，返回第一个
  const existingItem = sameNameItems[0];
  return {
    exists: true,
    existingItem,
    conflictType: 'price_mismatch',
    message: `本菜已由他人录入，价格为 ¥${existingItem.price}，与您输入的 ¥${newItem.price} 不同。\n\n请确认后选择：\n1. 使用现有价格 ¥${existingItem.price}\n2. 更新为新价格 ¥${newItem.price}`
  };
}

/**
 * 插入或更新菜单项（去重逻辑）
 * @param menu 现有菜单
 * @param newItem 新菜单项
 * @param userId 当前用户ID
 * @returns 更新后的菜单和操作结果
 */
export function upsertMenuItem(
  menu: GroupMenuItem[],
  newItem: Omit<GroupMenuItem, 'id' | 'createdAt' | 'createdBy'>,
  userId: string
): {
  menu: GroupMenuItem[];
  conflict: MenuConflict;
  action: 'created' | 'updated' | 'duplicate';
} {
  const conflict = checkMenuConflict(menu, newItem);

  // 如果完全匹配（同名同价），返回原菜单
  if (conflict.exists && !conflict.conflictType) {
    return {
      menu,
      conflict,
      action: 'duplicate'
    };
  }

  // 如果是价格冲突，需要用户确认才能更新
  if (conflict.exists && conflict.conflictType === 'price_mismatch') {
    return {
      menu,
      conflict,
      action: 'duplicate'
    };
  }

  // 不存在冲突，直接添加
  const now = new Date().toISOString();
  const newMenuItem: GroupMenuItem = {
    ...newItem,
    id: `MI_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdBy: userId,
    createdAt: now
  };

  return {
    menu: [...menu, newMenuItem],
    conflict: { exists: false },
    action: 'created'
  };
}

/**
 * 强制更新菜单项价格（用户确认冲突后）
 * @param menu 现有菜单
 * @param nameDisplay 菜名
 * @param newPrice 新价格
 * @param userId 操作用户
 * @returns 更新后的菜单
 */
export function forceUpdateMenuItemPrice(
  menu: GroupMenuItem[],
  nameDisplay: string,
  newPrice: number,
  userId: string
): GroupMenuItem[] {
  return menu.map((item) => {
    if (item.nameDisplay.trim() === nameDisplay.trim() && item.status === 'active') {
      return {
        ...item,
        price: newPrice,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      };
    }
    return item;
  });
}

/**
 * 停用菜单项
 * @param menu 现有菜单
 * @param itemId 菜单项ID
 * @returns 更新后的菜单
 */
export function disableMenuItem(menu: GroupMenuItem[], itemId: string): GroupMenuItem[] {
  return menu.map((item) => {
    if (item.id === itemId) {
      return {
        ...item,
        status: 'disabled' as const,
        updatedAt: new Date().toISOString()
      };
    }
    return item;
  });
}

