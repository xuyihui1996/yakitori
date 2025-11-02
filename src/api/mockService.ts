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
  RoundSummary
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

// 内存存储
let groups: Group[] = [mockGroup];
let menus: GroupMenuItem[] = [...mockMenu];
let rounds: Round[] = [...mockRounds];
let roundItems: RoundItem[] = [...mockRoundItems];
let users: User[] = [...mockUsers];

// 模拟网络延迟
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 创建新组
 */
export async function createGroup(ownerName: string): Promise<{ group: Group; user: User }> {
  await delay();
  
  const userId = generateUniqueId('U');
  const user: User = {
    id: userId,
    name: ownerName
  };
  users.push(user);

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
 * 添加菜单项
 */
export async function addMenuItem(item: Omit<GroupMenuItem, 'id' | 'createdAt'>): Promise<GroupMenuItem> {
  await delay();
  
  const newItem: GroupMenuItem = {
    ...item,
    id: generateUniqueId('MI'),
    createdAt: new Date().toISOString()
  };
  menus.push(newItem);
  return newItem;
}

/**
 * 更新菜单项
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
export async function createRound(groupId: string, createdBy: string): Promise<Round> {
  await delay();
  
  const group = groups.find(g => g.id === groupId);
  if (!group) {
    throw new Error('组不存在');
  }

  if (group.ownerId !== createdBy) {
    throw new Error('只有管理员可以开启新轮次');
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
export async function closeRound(roundId: string, userId: string): Promise<Round> {
  await delay();
  
  const round = rounds.find(r => r.id === roundId);
  if (!round) {
    throw new Error('轮次不存在');
  }

  const group = groups.find(g => g.id === round.groupId);
  if (!group || group.ownerId !== userId) {
    throw new Error('只有管理员可以关闭轮次');
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
  return roundItems.filter(item => item.roundId === roundId && !item.deleted);
}

/**
 * 添加订单项
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

  const newItem: RoundItem = {
    ...item,
    id: generateUniqueId('RI'),
    createdAt: new Date().toISOString()
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
 * 结账
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

  const groupRounds = rounds.filter(r => r.groupId === groupId);
  const userItems = roundItems.filter(
    item => item.groupId === groupId && item.userId === userId && !item.deleted
  );

  const roundBills = groupRounds.map(round => {
    const items = userItems.filter(item => item.roundId === round.id);
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
export async function finalizeCheckout(groupId: string, userId: string): Promise<void> {
  await delay();
  
  const group = groups.find(g => g.id === groupId);
  if (!group || group.ownerId !== userId) {
    throw new Error('只有管理员可以最终确认结账');
  }

  if (!group.checkoutConfirming) {
    throw new Error('当前不在结账确认流程中');
  }

  // 检查所有成员是否都已确认
  const memberConfirmations = group.memberConfirmations || {};
  const allConfirmed = group.members.every(memberId => memberConfirmations[memberId] === true);

  if (!allConfirmed) {
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

