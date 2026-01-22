/**
 * Mock API服务
 * 使用内存存储模拟后端API，便于前端开发
 * 后续可替换为真实的Supabase/Firebase/REST API
 */

import {
  User,
  Group,
  GroupMenuItem,
  Round,
  RoundItem,
  GroupBill,
  UserBill,
  RoundSummary,
  RestaurantMenu,
  RestaurantMenuItem,
  UserRestaurantMenuLink
} from '@/types';
import {
  mockUsers,
  mockGroup,
  mockMenu,
  mockRounds,
  mockRoundItems
} from './mockData';
import { generateShortId, generateUniqueId } from '@/utils/format';
import { aggregateItemsByName } from '@/utils/export';
import { calculateTotal } from '@/utils/money';
import { normalizeDishName } from '@/utils/nameNormalize';
import { getUserOwedYenForRoundItem } from '@/utils/split';
import { getDefaultLocale } from '@/i18n';
import { translate } from '@/i18n/global';

// 内存存储
let groups: Group[] = [mockGroup];
let menus: GroupMenuItem[] = [...mockMenu];
let rounds: Round[] = [...mockRounds];
let roundItems: RoundItem[] = [...mockRoundItems];
let users: User[] = [...mockUsers];

// 店铺历史菜单相关存储（从 localStorage 恢复）
const STORAGE_KEY_MENUS = 'ordered_restaurant_menus';
const STORAGE_KEY_MENU_ITEMS = 'ordered_restaurant_menu_items';
const STORAGE_KEY_MENU_LINKS = 'ordered_restaurant_menu_links';

// 从 localStorage 恢复数据
function loadRestaurantMenusFromStorage(): RestaurantMenu[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MENUS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function loadRestaurantMenuItemsFromStorage(): RestaurantMenuItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MENU_ITEMS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function loadUserRestaurantMenuLinksFromStorage(): UserRestaurantMenuLink[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MENU_LINKS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// 保存到 localStorage
function saveRestaurantMenusToStorage(menus: RestaurantMenu[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MENUS, JSON.stringify(menus));
  } catch (error) {
    console.error('Failed to save restaurant menus to storage:', error);
  }
}

function saveRestaurantMenuItemsToStorage(items: RestaurantMenuItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MENU_ITEMS, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save restaurant menu items to storage:', error);
  }
}

function saveUserRestaurantMenuLinksToStorage(links: UserRestaurantMenuLink[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MENU_LINKS, JSON.stringify(links));
  } catch (error) {
    console.error('Failed to save user restaurant menu links to storage:', error);
  }
}

// 初始化：从 localStorage 恢复
let restaurantMenus: RestaurantMenu[] = loadRestaurantMenusFromStorage();
let restaurantMenuItems: RestaurantMenuItem[] = loadRestaurantMenuItemsFromStorage();
let userRestaurantMenuLinks: UserRestaurantMenuLink[] = loadUserRestaurantMenuLinksFromStorage();

// 模拟网络延迟
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 创建新组
 */
export async function createGroup(ownerName: string): Promise<{ group: Group; user: User }> {
  await delay();

  // 检查 localStorage 中是否已有用户ID，如果有就复用（保持用户身份一致）
  let userId = localStorage.getItem('ordered_user_id');
  let user: User | undefined;

  if (userId) {
    // 尝试从现有用户列表中找到该用户
    user = users.find(u => u.id === userId);
    if (user) {
      // 更新用户名（可能用户改了名字）
      user.name = ownerName;
    } else {
      // 用户不存在，创建新用户
      user = {
        id: userId,
        name: ownerName
      };
      users.push(user);
    }
  } else {
    // 没有保存的用户ID，创建新用户
    userId = generateUniqueId('U');
    user = {
      id: userId,
      name: ownerName
    };
    users.push(user);
  }

  const now = new Date().toISOString();
  const group: Group = {
    id: 'G' + generateShortId(),
    ownerId: userId,
    createdAt: now,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    settled: false,
    members: [userId]
  };
  groups.push(group);

  // 自动创建第一轮
  const firstRound: Round = {
    id: 'R1',
    groupId: group.id,
    status: 'open',
    createdBy: userId,
    createdAt: now
  };
  rounds.push(firstRound);

  return { group, user };
}

/**
 * 加入组
 */
export async function joinGroup(groupId: string, userName: string): Promise<{ group: Group; user: User }> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group) {
    throw new Error('组不存在');
  }

  if (group.settled) {
    throw new Error('该桌已结账，无法加入');
  }

  const userId = generateUniqueId('U');
  const user: User = {
    id: userId,
    name: userName
  };
  users.push(user);

  if (!group.members.includes(userId)) {
    group.members.push(userId);
  }

  return { group, user };
}

/**
 * 获取组信息
 */
export async function getGroup(groupId: string): Promise<{
  group: Group;
  members: User[];
  currentRound?: Round;
}> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group) {
    throw new Error('组不存在');
  }

  const members = users.filter(u => group.members.includes(u.id));
  const currentRound = rounds.find(r => r.groupId === groupId && r.status === 'open');

  return { group, members, currentRound };
}

/**
 * 获取菜单
 */
export async function getMenu(groupId: string): Promise<GroupMenuItem[]> {
  await delay();
  return menus.filter(m => m.groupId === groupId);
}

/**
 * 添加菜单项（增强查重：同组内active状态菜名唯一）
 */
export async function addMenuItem(item: Omit<GroupMenuItem, 'id' | 'createdAt'>): Promise<GroupMenuItem> {
  await delay();

  const normalizedName = normalizeDishName(item.nameDisplay);

  // 检查同组内是否已存在同名active菜品
  const existingItem = menus.find(
    m => m.groupId === item.groupId &&
      m.status === 'active' &&
      normalizeDishName(m.nameDisplay).toLowerCase() === normalizedName.toLowerCase()
  );

  if (existingItem) {
    const error: any = new Error('菜名已存在');
    error.status = 409;
    error.existingItem = existingItem;
    throw error;
  }

  const newItem: GroupMenuItem = {
    ...item,
    nameDisplay: normalizedName,
    id: generateUniqueId('MI'),
    createdAt: new Date().toISOString()
  };
  menus.push(newItem);
  return newItem;
}

/**
 * 更新菜单项（价格、状态等，不包括名称）
 */
export async function updateMenuItem(
  itemId: string,
  updates: Partial<GroupMenuItem>
): Promise<GroupMenuItem> {
  await delay();

  const index = menus.findIndex(m => m.id === itemId);
  if (index === -1) {
    throw new Error('菜单项不存在');
  }

  menus[index] = {
    ...menus[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  return menus[index];
}

/**
 * 更新菜单项名称（全员可改，统一更新该组所有订单项名称）
 */
export async function updateMenuItemName(
  groupId: string,
  menuItemId: string,
  newName: string,
  userId: string
): Promise<GroupMenuItem> {
  await delay();

  // 1. 校验组是否已结账
  const group = groups.find(g => g.id === groupId);
  if (!group) {
    throw new Error('组不存在');
  }

  if (group.settled) {
    const error: any = new Error('该桌已结账，无法修改菜名');
    error.status = 403;
    throw error;
  }

  // 2. 规范化新名称
  const normalizedName = normalizeDishName(newName);

  // 3. 检查冲突：同组内是否已有active的新名称（排除自己）
  const conflictItem = menus.find(
    m => m.groupId === groupId &&
      m.status === 'active' &&
      m.id !== menuItemId &&
      normalizeDishName(m.nameDisplay).toLowerCase() === normalizedName.toLowerCase()
  );

  if (conflictItem) {
    const error: any = new Error('菜名已存在，请重新命名');
    error.status = 409;
    error.existingItem = conflictItem;
    throw error;
  }

  // 4. 更新菜单项名称
  const menuIndex = menus.findIndex(m => m.id === menuItemId);
  if (menuIndex === -1) {
    throw new Error('菜单项不存在');
  }

  const now = new Date().toISOString();
  menus[menuIndex] = {
    ...menus[menuIndex],
    nameDisplay: normalizedName,
    updatedAt: now,
    updatedBy: userId
  };

  // 5. 统一回写该组内所有轮的订单项名称（未结账期间允许）
  const updatedMenuItem = menus[menuIndex];
  roundItems.forEach(item => {
    if (item.groupId === groupId && !item.deleted) {
      // 如果订单项关联了该菜单项（通过menuItemId或名称+价格匹配），更新名称
      if (item.menuItemId === menuItemId ||
        (item.nameDisplay === updatedMenuItem.nameDisplay &&
          item.price === updatedMenuItem.price)) {
        item.nameDisplay = normalizedName;
        item.updatedAt = now;
        item.updatedBy = userId;
        // 如果还没有menuItemId，设置它
        if (!item.menuItemId) {
          item.menuItemId = menuItemId;
        }
      }
    }
  });

  return menus[menuIndex];
}

/**
 * 获取所有轮次
 */
export async function getRounds(groupId: string): Promise<Round[]> {
  await delay();
  return rounds
    .filter(r => r.groupId === groupId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * 创建新轮次
 */
export async function createRound(
  groupId: string,
  createdBy: string,
  options?: { allowMember?: boolean }
): Promise<Round> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group) {
    throw new Error('组不存在');
  }

  if (!options?.allowMember && group.ownerId !== createdBy) {
    throw new Error('只有管理员可以开启新轮次');
  }
  if (options?.allowMember && !group.members.includes(createdBy)) {
    throw new Error('只有本桌成员可以开启新轮次');
  }

  // 检查是否有未关闭的轮次
  const openRound = rounds.find(r => r.groupId === groupId && r.status === 'open');
  if (openRound) {
    throw new Error('请先关闭当前轮次');
  }

  const groupRounds = rounds.filter(r => r.groupId === groupId);
  const nextRoundNum = groupRounds.length + 1;

  const newRound: Round = {
    id: `R${nextRoundNum}`,
    groupId,
    status: 'open',
    createdBy,
    createdAt: new Date().toISOString()
  };

  rounds.push(newRound);
  return newRound;
}

/**
 * 关闭轮次
 */
export async function closeRound(
  roundId: string,
  userId: string,
  options?: { allowMember?: boolean }
): Promise<Round> {
  await delay();

  const round = rounds.find(r => r.id === roundId);
  if (!round) {
    throw new Error('轮次不存在');
  }

  const group = groups.find(g => g.id === round.groupId);
  if (!group) {
    throw new Error('组不存在');
  }
  if (!options?.allowMember && group.ownerId !== userId) {
    throw new Error('只有管理员可以关闭轮次');
  }
  if (options?.allowMember && !group.members.includes(userId)) {
    throw new Error('仅限本桌成员操作');
  }

  round.status = 'closed';
  round.closedAt = new Date().toISOString();

  return round;
}

/**
 * 获取轮次的所有订单项
 */
export async function getRoundItems(roundId: string): Promise<RoundItem[]> {
  await delay();
  return roundItems
    .filter(item => item.roundId === roundId && !item.deleted)
    .map(item => ({
      ...item,
      menuItemId: item.menuItemId,
      userNameSnapshot: item.userNameSnapshot,
      updatedBy: item.updatedBy,
    }));
}

/**
 * 添加订单项（自动关联menuItemId）
 */
export async function addRoundItem(item: Omit<RoundItem, 'id' | 'createdAt'>): Promise<RoundItem> {
  await delay();

  const round = rounds.find(r => r.id === item.roundId);
  if (!round) {
    throw new Error('轮次不存在');
  }

  if (round.status !== 'open') {
    throw new Error('该轮次已关闭，无法添加订单');
  }

  // 尝试找到对应的菜单项（通过名称和价格匹配）
  const matchingMenuItem = menus.find(
    m => m.groupId === item.groupId &&
      m.status === 'active' &&
      normalizeDishName(m.nameDisplay).toLowerCase() === normalizeDishName(item.nameDisplay).toLowerCase() &&
      m.price === item.price
  );

  const newItem: RoundItem = {
    ...item,
    id: generateUniqueId('RI'),
    createdAt: new Date().toISOString(),
    menuItemId: matchingMenuItem?.id,
  };

  roundItems.push(newItem);
  return newItem;
}

/**
 * 更新订单项
 */
export async function updateRoundItem(
  itemId: string,
  userId: string,
  updates: Partial<RoundItem>
): Promise<RoundItem> {
  await delay();

  const index = roundItems.findIndex(item => item.id === itemId);
  if (index === -1) {
    throw new Error('订单项不存在');
  }

  const item = roundItems[index];

  // 检查权限：只能修改自己的订单，或者是管理员
  const group = groups.find(g => g.id === item.groupId);
  if (item.userId !== userId && group?.ownerId !== userId) {
    throw new Error('无权修改此订单');
  }

  roundItems[index] = {
    ...item,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  return roundItems[index];
}

/**
 * 删除订单项
 */
export async function deleteRoundItem(itemId: string, userId: string): Promise<void> {
  await delay();

  const item = roundItems.find(item => item.id === itemId);
  if (!item) {
    throw new Error('订单项不存在');
  }

  // 检查权限
  const group = groups.find(g => g.id === item.groupId);
  if (item.userId !== userId && group?.ownerId !== userId) {
    throw new Error('无权删除此订单');
  }

  item.deleted = true;
  item.deletedBy = userId;
}

/**
 * 结账（添加昵称快照）
 */
export async function settleGroup(groupId: string, userId: string): Promise<void> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group) {
    throw new Error('组不存在');
  }

  if (group.ownerId !== userId) {
    throw new Error('只有管理员可以结账');
  }

  // 结账前：1. 昵称快照（从users表获取当前昵称）
  group.members.forEach(memberId => {
    const user = users.find(u => u.id === memberId);
    const userName = user?.name || memberId;

    // 更新该成员所有订单项的昵称快照
    roundItems.forEach(item => {
      if (item.groupId === groupId && item.userId === memberId && !item.userNameSnapshot) {
        item.userNameSnapshot = userName;
      }
    });
  });

  // 结账前：2. 名称快照统一（确保此时订单名与最新菜单名一致）
  const groupMenuItems = menus.filter(m => m.groupId === groupId && m.status === 'active');
  groupMenuItems.forEach(menuItem => {
    roundItems.forEach(item => {
      if (item.groupId === groupId &&
        item.menuItemId === menuItem.id &&
        item.nameDisplay !== menuItem.nameDisplay) {
        item.nameDisplay = menuItem.nameDisplay;
      }
    });
  });

  // 关闭所有未关闭的轮次
  rounds
    .filter(r => r.groupId === groupId && r.status === 'open')
    .forEach(r => {
      r.status = 'closed';
      r.closedAt = new Date().toISOString();
    });

  group.settled = true;
}

/**
 * 获取用户账单
 */
export async function getUserBill(groupId: string, userId: string): Promise<UserBill> {
  await delay();

  const user = users.find(u => u.id === userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  const locale = getDefaultLocale();
  const sharedSuffix = translate(locale, 'bill.sharedSuffix');

  const groupRounds = rounds.filter(r => r.groupId === groupId);
  const groupItems = roundItems.filter(item => item.groupId === groupId && !item.deleted);

  const roundBills = groupRounds.map(round => {
    const itemsInRound = groupItems.filter(item => item.roundId === round.id);
    const normalItems = itemsInRound.filter(item => !item.isShared && item.userId === userId);
    const sharedItems = itemsInRound.filter(item => item.isShared && (item.shares || []).some(s => s.userId === userId));

    const sharedVirtualItems: RoundItem[] = sharedItems
      .map((it) => {
        const amountYen = getUserOwedYenForRoundItem(it, userId);
        if (!amountYen) return null;
        return {
          id: `${it.id}_share_${userId}`,
          groupId: it.groupId,
          roundId: it.roundId,
          userId,
          nameDisplay: `${it.nameDisplay}${sharedSuffix}`,
          price: amountYen,
          qty: 1,
          note: it.note,
          createdAt: it.createdAt,
        } as RoundItem;
      })
      .filter(Boolean) as RoundItem[];

    const items = [...normalItems, ...sharedVirtualItems];
    return {
      roundId: round.id,
      items,
      roundTotal: calculateTotal(items)
    };
  });

  const grandTotal = roundBills.reduce((sum, rb) => sum + rb.roundTotal, 0);

  return {
    userId,
    userName: user.name,
    rounds: roundBills,
    grandTotal
  };
}

/**
 * 获取整桌账单（Owner视图）
 */
export async function getGroupBill(groupId: string): Promise<GroupBill> {
  await delay();

  const groupRounds = rounds.filter(r => r.groupId === groupId);
  const allItems = roundItems.filter(item => item.groupId === groupId && !item.deleted);

  const roundSummaries: RoundSummary[] = groupRounds.map(round => {
    const items = allItems.filter(item => item.roundId === round.id);
    const aggregated = aggregateItemsByName(items);

    return {
      roundId: round.id,
      items,
      totalAmount: calculateTotal(items),
      aggregatedItems: aggregated
    };
  });

  const group = groups.find(g => g.id === groupId);
  const memberBills = await Promise.all(
    (group?.members || []).map(memberId => getUserBill(groupId, memberId))
  );

  const grandTotal = roundSummaries.reduce((sum, rs) => sum + rs.totalAmount, 0);

  return {
    groupId,
    rounds: roundSummaries,
    grandTotal,
    memberBills
  };
}

/**
 * 获取用户信息
 */
export async function getUser(userId: string): Promise<User | undefined> {
  await delay(100);
  return users.find(u => u.id === userId);
}

/**
 * 获取多个用户信息
 */
export async function getUsers(userIds: string[]): Promise<User[]> {
  await delay(100);
  return users.filter(u => userIds.includes(u.id));
}

// ============ 结账确认相关（Mock实现） ============

/**
 * 开始结账确认流程（Owner点击结账时）
 */
export async function startCheckoutConfirmation(groupId: string, userId: string): Promise<void> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group || group.ownerId !== userId) {
    throw new Error('只有管理员可以结账');
  }

  // 初始化成员确认状态
  const memberConfirmations: Record<string, boolean> = {};
  group.members.forEach(memberId => {
    memberConfirmations[memberId] = false;
  });

  // 创建Extra round（用于调整数量）
  const extraRoundId = `${groupId}_Extra`;
  const extraRound: Round = {
    id: extraRoundId,
    groupId: groupId,
    status: 'open',
    createdBy: userId,
    createdAt: new Date().toISOString()
  };
  rounds.push(extraRound);

  // 标记组为结账确认中
  group.checkoutConfirming = true;
  group.memberConfirmations = memberConfirmations;
}

/**
 * 成员确认订单
 */
export async function confirmMemberOrder(groupId: string, userId: string): Promise<void> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group || !group.checkoutConfirming) {
    throw new Error('当前不在结账确认流程中');
  }

  const memberConfirmations = group.memberConfirmations || {};
  memberConfirmations[userId] = true;
  group.memberConfirmations = memberConfirmations;
}

/**
 * 最终确认结账（所有成员确认后，Owner调用）
 */
export async function finalizeCheckout(
  groupId: string,
  userId: string,
  options?: { force?: boolean }
): Promise<void> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group || group.ownerId !== userId) {
    throw new Error('只有管理员可以最终确认结账');
  }

  if (!group.checkoutConfirming && !options?.force) {
    throw new Error('当前不在结账确认流程中');
  }

  // 检查所有成员是否都已确认
  const memberConfirmations = group.memberConfirmations || {};
  const allConfirmed = group.members.every(memberId => memberConfirmations[memberId] === true);

  if (!allConfirmed && !options?.force) {
    const unconfirmedMembers = group.members.filter(memberId => !memberConfirmations[memberId]);
    throw new Error(`还有 ${unconfirmedMembers.length} 位成员未确认订单`);
  }

  // 关闭所有open的轮次（包括Extra round）
  rounds
    .filter(r => r.groupId === groupId && r.status === 'open')
    .forEach(r => {
      r.status = 'closed';
      r.closedAt = new Date().toISOString();
    });

  // 标记组为已结账
  group.settled = true;
  group.checkoutConfirming = false;
}

// 设置本轮确认状态（Mock 简化）
export async function setRoundConfirmation(
  groupId: string,
  roundId: string,
  userId: string,
  confirmed: boolean
): Promise<{ allConfirmed: boolean }> {
  await delay();
  const group = groups.find(g => g.id === groupId);
  if (!group) {
    throw new Error('组不存在');
  }
  if (!group.members.includes(userId)) {
    throw new Error('仅限本桌成员操作');
  }
  if (group.settled) {
    throw new Error('该桌已结账');
  }

  const round = rounds.find(r => r.id === roundId);
  if (!round) {
    throw new Error('轮次不存在');
  }
  if (round.status !== 'open') {
    throw new Error('当前轮已结束');
  }

  const confirmations = (round.memberConfirmations || {}) as Record<string, boolean>;
  confirmations[userId] = confirmed;
  round.memberConfirmations = confirmations;

  const allConfirmed = group.members.every(memberId => confirmations[memberId] === true);
  return { allConfirmed };
}

// 成员确认本轮点单
export async function confirmRoundSubmission(
  groupId: string,
  roundId: string,
  userId: string
): Promise<{ allConfirmed: boolean }> {
  return setRoundConfirmation(groupId, roundId, userId, true);
}

// ============ 成员管理 ============

/**
 * 删除成员（Owner权限）
 */
export async function removeMember(
  groupId: string,
  ownerId: string,
  memberIdToRemove: string
): Promise<void> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group || group.ownerId !== ownerId) {
    throw new Error('只有管理员可以删除成员');
  }

  if (group.settled) {
    throw new Error('已结账的组不能删除成员');
  }

  if (!group.members.includes(memberIdToRemove)) {
    throw new Error('该用户不是组成员');
  }

  if (group.ownerId === memberIdToRemove) {
    throw new Error('不能删除自己（Owner）');
  }

  // 删除该成员的所有订单项（标记为deleted）
  roundItems
    .filter(item => item.groupId === groupId && item.userId === memberIdToRemove && !item.deleted)
    .forEach(item => {
      item.deleted = true;
      item.deletedBy = ownerId;
      item.updatedAt = new Date().toISOString();
    });

  // 不删除该成员创建的菜单项（保留菜单项）

  // 从组成员列表中移除
  group.members = group.members.filter(id => id !== memberIdToRemove);

  // 从确认状态中移除（如果存在）
  if (group.memberConfirmations) {
    delete group.memberConfirmations[memberIdToRemove];
  }
}

// ============ 店铺历史菜单相关 ============

/**
 * 在结账后，把本次 group 的所有去重过的菜品，保存为一个 restaurant_menu，
 * 并把该菜单关联到当前用户（如果用户选择保存）。
 */
export async function saveGroupAsRestaurantMenu(
  groupId: string,
  userId: string,
  displayName: string
): Promise<void> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group) {
    throw new Error('组不存在');
  }

  // 1. 收集本次聚餐的所有点单条目
  const allGroupItems = roundItems.filter(
    item => item.groupId === groupId && !item.deleted
  );

  if (allGroupItems.length === 0) {
    // 极端情况：没有任何 item，直接返回
    return;
  }

  // 2. 对 item 按 (nameDisplay, price, note) 去重
  const uniqueItemsMap = new Map<string, RoundItem>();
  allGroupItems.forEach(item => {
    const key = `${item.nameDisplay.trim()}:${item.price}:${item.note || ''}`;
    if (!uniqueItemsMap.has(key)) {
      uniqueItemsMap.set(key, item);
    }
  });
  const uniqueItems = Array.from(uniqueItemsMap.values());

  // 3. 创建新的 RestaurantMenu
  const now = new Date().toISOString();
  const restaurantMenuId = 'rm_' + generateShortId();
  const newRestaurantMenu: RestaurantMenu = {
    id: restaurantMenuId,
    createdFromGroupId: groupId,
    createdAt: now
  };
  restaurantMenus.push(newRestaurantMenu);
  saveRestaurantMenusToStorage(restaurantMenus);

  // 4. 保存对应的 RestaurantMenuItem[]
  const newMenuItems: RestaurantMenuItem[] = uniqueItems.map(item => ({
    id: generateUniqueId('RMI'),
    restaurantMenuId,
    nameDisplay: item.nameDisplay,
    price: item.price,
    note: item.note
  }));
  restaurantMenuItems.push(...newMenuItems);
  saveRestaurantMenuItemsToStorage(restaurantMenuItems);

  // 5. 建立 UserRestaurantMenuLink，带上"最多 2 个 + LRU"逻辑
  const userLinks = userRestaurantMenuLinks.filter(link => link.userId === userId);

  if (userLinks.length < 2) {
    // 直接插入新 link
    const newLink: UserRestaurantMenuLink = {
      userId,
      restaurantMenuId,
      displayName,
      createdAt: now,
      lastUsedAt: now
    };
    userRestaurantMenuLinks.push(newLink);
    saveUserRestaurantMenuLinksToStorage(userRestaurantMenuLinks);
  } else {
    // 找出 lastUsedAt 最早的那一条 link（或按 createdAt 近似）
    const sortedLinks = [...userLinks].sort((a, b) => {
      const aTime = a.lastUsedAt || a.createdAt;
      const bTime = b.lastUsedAt || b.createdAt;
      return aTime.localeCompare(bTime);
    });
    const oldestLink = sortedLinks[0];

    // 删除这条 link
    userRestaurantMenuLinks = userRestaurantMenuLinks.filter(
      link => !(link.userId === oldestLink.userId && link.restaurantMenuId === oldestLink.restaurantMenuId)
    );
    saveUserRestaurantMenuLinksToStorage(userRestaurantMenuLinks);

    // 检查这个 restaurantMenuId 是否还被其他用户使用
    const otherUserLinks = userRestaurantMenuLinks.filter(
      link => link.restaurantMenuId === oldestLink.restaurantMenuId
    );

    if (otherUserLinks.length === 0) {
      // 没有其他用户使用，删除这个 RestaurantMenu 及其 RestaurantMenuItem[]
      restaurantMenus = restaurantMenus.filter(rm => rm.id !== oldestLink.restaurantMenuId);
      restaurantMenuItems = restaurantMenuItems.filter(
        rmi => rmi.restaurantMenuId !== oldestLink.restaurantMenuId
      );
      saveRestaurantMenusToStorage(restaurantMenus);
      saveRestaurantMenuItemsToStorage(restaurantMenuItems);
    }

    // 插入当前用户指向新 RestaurantMenu 的 link
    const newLink: UserRestaurantMenuLink = {
      userId,
      restaurantMenuId,
      displayName,
      createdAt: now,
      lastUsedAt: now
    };
    userRestaurantMenuLinks.push(newLink);
    saveUserRestaurantMenuLinksToStorage(userRestaurantMenuLinks);
  }

  // 6. 清理孤儿菜单（确保没有 link 的菜单被删除）
  cleanupOrphanMenus();
}

/**
 * 清理没有用户关联的 restaurant_menu
 */
function cleanupOrphanMenus(): void {
  const menuIdsWithLinks = new Set(
    userRestaurantMenuLinks.map(link => link.restaurantMenuId)
  );

  // 找出没有 link 的菜单
  const orphanMenus = restaurantMenus.filter(rm => !menuIdsWithLinks.has(rm.id));

  // 删除这些菜单及其 items
  orphanMenus.forEach(orphan => {
    restaurantMenus = restaurantMenus.filter(rm => rm.id !== orphan.id);
    restaurantMenuItems = restaurantMenuItems.filter(
      rmi => rmi.restaurantMenuId !== orphan.id
    );
  });

  // 保存到 localStorage
  saveRestaurantMenusToStorage(restaurantMenus);
  saveRestaurantMenuItemsToStorage(restaurantMenuItems);
}

/**
 * 获取当前用户收藏过的所有店铺菜单（带上 displayName）
 */
export async function getUserRestaurantMenus(
  userId: string
): Promise<Array<{
  link: UserRestaurantMenuLink;
  menu: RestaurantMenu;
  items: RestaurantMenuItem[];
}>> {
  await delay();

  // 找到该用户的所有 link
  const userLinks = userRestaurantMenuLinks.filter(link => link.userId === userId);

  // 为每个 link 找到对应的 menu 和 items
  const result = userLinks.map(link => {
    const menu = restaurantMenus.find(rm => rm.id === link.restaurantMenuId);
    if (!menu) {
      // 数据不一致，跳过
      return null;
    }

    const items = restaurantMenuItems.filter(rmi => rmi.restaurantMenuId === link.restaurantMenuId);

    return {
      link,
      menu,
      items
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return result;
}

/**
 * 导入历史菜单到当前组
 */
export async function importRestaurantMenuToGroup(
  groupId: string,
  restaurantMenuId: string,
  userId: string
): Promise<{
  imported: number;
  conflicts: Array<{ nameDisplay: string; price: number; note?: string }>;
}> {
  await delay();

  const group = groups.find(g => g.id === groupId);
  if (!group) {
    throw new Error('组不存在');
  }

  // 获取要导入的菜单项
  const menuItemsToImport = restaurantMenuItems.filter(
    rmi => rmi.restaurantMenuId === restaurantMenuId
  );

  if (menuItemsToImport.length === 0) {
    throw new Error('菜单为空');
  }

  // 获取当前组的菜单
  const currentMenu = menus.filter(m => m.groupId === groupId && m.status === 'active');

  // 使用现有的菜单去重逻辑导入
  let importedCount = 0;
  const conflicts: Array<{ nameDisplay: string; price: number; note?: string }> = [];

  for (const menuItem of menuItemsToImport) {
    // 检查是否冲突（同名不同价）
    const conflict = currentMenu.find(
      item =>
        item.nameDisplay.trim() === menuItem.nameDisplay.trim() &&
        item.price !== menuItem.price &&
        item.status === 'active'
    );

    if (conflict) {
      // 跳过冲突项
      conflicts.push({
        nameDisplay: menuItem.nameDisplay,
        price: menuItem.price,
        note: menuItem.note
      });
      continue;
    }

    // 检查是否已存在同名同价
    const exists = currentMenu.find(
      item =>
        item.nameDisplay.trim() === menuItem.nameDisplay.trim() &&
        item.price === menuItem.price &&
        item.status === 'active'
    );

    if (!exists) {
      // 添加新菜单项
      const newMenuItem: GroupMenuItem = {
        id: generateUniqueId('MI'),
        groupId,
        nameDisplay: menuItem.nameDisplay,
        price: menuItem.price,
        note: menuItem.note,
        status: 'active',
        createdBy: userId,
        createdAt: new Date().toISOString()
      };
      menus.push(newMenuItem);
      importedCount++;
    }
  }

  // 更新当前用户的 UserRestaurantMenuLink.lastUsedAt
  const userLink = userRestaurantMenuLinks.find(
    link => link.userId === userId && link.restaurantMenuId === restaurantMenuId
  );
  if (userLink) {
    userLink.lastUsedAt = new Date().toISOString();
    saveUserRestaurantMenuLinksToStorage(userRestaurantMenuLinks);
  }

  return {
    imported: importedCount,
    conflicts
  };
}
