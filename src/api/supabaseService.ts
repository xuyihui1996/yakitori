/**
 * Supabase API 服务
 * 提供真实的数据持久化，支持多人协作
 * 
 * 使用方法：
 * 1. 创建 Supabase 项目
 * 2. 执行 SQL 创建表（见 接入Supabase指南.md）
 * 3. 配置环境变量（.env.local）
 * 4. 在 groupStore.ts 中切换导入：
 *    import * as api from '@/api/supabaseService';
 */

import { supabase } from './supabaseClient';

// 辅助函数：确保 supabase 客户端已配置
function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  return supabase;
}
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
import { generateShortId, generateUniqueId } from '@/utils/format';
import { aggregateItemsByName } from '@/utils/export';
import { calculateTotal } from '@/utils/money';
import { normalizeDishName } from '@/utils/nameNormalize';
import { getUserOwedYenForRoundItem } from '@/utils/split';
import { getDefaultLocale } from '@/i18n';
import { translate } from '@/i18n/global';

// ============ 用户相关 ============

/**
 * 创建用户
 */
export async function createUser(name: string): Promise<User> {
  const createUserClient = ensureSupabase();

  // 检查 localStorage 中是否已有用户ID，如果有就复用（保持用户身份一致）
  let userId = localStorage.getItem('ordered_user_id');

  if (userId) {
    // 尝试从数据库获取现有用户
    const { data: existingUser, error: fetchError } = await createUserClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (existingUser && !fetchError) {
      // 用户已存在，更新用户名（可能用户改了名字）
      const { error: updateError } = await createUserClient
        .from('users')
        .update({ name })
        .eq('id', userId);

      if (updateError) {
        console.warn('Failed to update user name:', updateError);
        // 不抛出错误，继续使用旧名字
      }

      return {
        id: existingUser.id,
        name: existingUser.name,
      };
    }
  } else {
    // 没有保存的用户ID，生成新用户ID
    userId = generateUniqueId('U');
  }

  // 插入时使用数据库字段名（snake_case）
  const { error } = await createUserClient.from('users').insert([{
    id: userId,
    name: name,
  }]);

  if (error) {
    // 如果是因为用户已存在（可能是并发创建），尝试获取现有用户
    if (error.code === '23505' || error.message.includes('duplicate')) {
      const { data: existingUser } = await createUserClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingUser) {
        return {
          id: existingUser.id,
          name: existingUser.name,
        };
      }
    }

    console.error('Failed to create user:', error);
    throw new Error('创建用户失败: ' + error.message);
  }

  return {
    id: userId,
    name,
  };
}

/**
 * 获取用户信息
 */
export async function getUser(userId: string): Promise<User | undefined> {
  const getUserClient = ensureSupabase();
  const { data, error } = await getUserClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return undefined;
  return data as User;
}

/**
 * 获取多个用户信息
 */
export async function getUsers(userIds: string[]): Promise<User[]> {
  if (userIds.length === 0) return [];

  const getUsersClient = ensureSupabase();
  const { data, error } = await getUsersClient
    .from('users')
    .select('*')
    .in('id', userIds);

  if (error) return [];
  return data as User[];
}

// ============ 组相关 ============

/**
 * 创建组
 */
export async function createGroup(ownerName: string): Promise<{ group: Group; user: User }> {
  // 1. 创建用户
  const user = await createUser(ownerName);

  // 2. 创建组
  const now = new Date().toISOString();
  const groupId = 'G' + generateShortId();

  // 插入时使用数据库字段名（snake_case）
  const { error: groupError } = await ensureSupabase().from('groups').insert([{
    id: groupId,
    owner_id: user.id,
    created_at: now,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    settled: false,
    members: [user.id],
  }]);

  // 创建 TypeScript 对象
  const group: Group = {
    id: groupId,
    ownerId: user.id,
    createdAt: now,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    settled: false,
    members: [user.id],
  };
  if (groupError) {
    console.error('Failed to create group:', groupError);
    throw new Error('创建组失败: ' + groupError.message);
  }

  // 验证组是否创建成功
  const verifyClient = ensureSupabase();
  const { data: verifyGroup } = await verifyClient
    .from('groups')
    .select('id')
    .eq('id', group.id)
    .single();

  if (!verifyGroup) {
    throw new Error('组创建后验证失败');
  }

  // 3. 自动创建第一轮（为每个组生成唯一的轮次ID）
  const firstRoundId = `${group.id}_R1`; // 使用组ID+轮次编号作为唯一ID

  // 先检查是否已存在该轮次
  const roundClient = ensureSupabase();
  const { data: existingRound } = await roundClient
    .from('rounds')
    .select('id')
    .eq('id', firstRoundId)
    .single();

  if (!existingRound) {
    // 如果不存在，创建新轮次
    const { error: roundError } = await ensureSupabase().from('rounds').insert([{
      id: firstRoundId,
      group_id: group.id,
      status: 'open',
      created_by: user.id,
      created_at: now,
    }]);

    if (roundError) {
      console.error('Failed to create first round:', roundError);
      // 尝试清理已创建的组和用户
      try {
        await ensureSupabase().from('groups').delete().eq('id', group.id);
        await ensureSupabase().from('users').delete().eq('id', user.id);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      throw new Error(`创建第一轮失败: ${roundError.message || roundError.code || '未知错误'}`);
    }
  }

  return { group, user };
}

/**
 * 加入组
 */
export async function joinGroup(
  groupId: string,
  userName: string
): Promise<{ group: Group; user: User }> {
  // 1. 获取组信息
  const groupClient = ensureSupabase();
  const { data: groupData, error: groupError } = await groupClient
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (groupError || !groupData) {
    throw new Error('组不存在');
  }

  // 转换数据库字段名为 TypeScript 格式
  const group: Group = {
    id: (groupData as any).id,
    ownerId: (groupData as any).owner_id,
    createdAt: (groupData as any).created_at,
    expiresAt: (groupData as any).expires_at,
    settled: (groupData as any).settled,
    members: (groupData as any).members || [],
    checkoutConfirming: (groupData as any).checkout_confirming || false,
    memberConfirmations: (groupData as any).member_confirmations || {},
  };

  if (group.settled) {
    throw new Error('该桌已结账，无法加入');
  }

  // 2. 创建用户
  const user = await createUser(userName);

  // 3. 更新组成员列表
  const updatedMembers = [...group.members, user.id];
  const updateClient = ensureSupabase();
  const { error: updateError } = await updateClient
    .from('groups')
    .update({ members: updatedMembers }) // members 字段不需要转换，数据库已经是数组
    .eq('id', groupId);

  if (updateError) {
    console.error('Failed to update group members:', updateError);
    throw new Error('加入组失败');
  }

  group.members = updatedMembers;
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
  const getGroupClient = ensureSupabase();
  const { data: groupData, error: groupError } = await getGroupClient
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (groupError || !groupData) {
    throw new Error('组不存在');
  }

  // 转换数据库字段名为 TypeScript 格式
  const group: Group = {
    id: (groupData as any).id,
    ownerId: (groupData as any).owner_id,
    createdAt: (groupData as any).created_at,
    expiresAt: (groupData as any).expires_at,
    settled: (groupData as any).settled,
    members: (groupData as any).members || [],
    checkoutConfirming: (groupData as any).checkout_confirming || false,
    memberConfirmations: (groupData as any).member_confirmations || {},
  };

  // 获取成员信息
  const membersClient = ensureSupabase();
  const { data: membersData } = await membersClient
    .from('users')
    .select('*')
    .in('id', group.members);

  const members = (membersData || []) as User[];

  // 获取当前轮次
  const roundsClient = ensureSupabase();
  const { data: roundData } = await roundsClient
    .from('rounds')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'open')
    .maybeSingle();

  const currentRound = roundData ? {
    id: roundData.id,
    groupId: roundData.group_id,
    status: roundData.status,
    createdBy: roundData.created_by,
    createdAt: roundData.created_at,
    closedAt: roundData.closed_at,
    memberConfirmations: roundData.member_confirmations || {},
  } as Round : undefined;

  return {
    group,
    members,
    currentRound
  };
}

/**
 * 获取所有组 (Merchant)
 */
export async function loadAllGroups(): Promise<Group[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('groups')
    .select('*')
    .eq('settled', false) // Only fetch active groups
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load all groups:', error);
    return [];
  }

  return (data || []).map((g: any) => ({
    id: g.id,
    ownerId: g.owner_id,
    createdAt: g.created_at,
    expiresAt: g.expires_at,
    settled: g.settled,
    members: g.members || [],
    tableNo: g.table_no, // Ensure tableNo is mapped if exists in DB schema, otherwise generated or ignored
    checkoutConfirming: g.checkout_confirming || false,
    memberConfirmations: g.member_confirmations || {},
  })) as Group[];
}

// ============ 菜单相关 ============

/**
 * 获取菜单
 */
export async function getMenu(groupId: string): Promise<GroupMenuItem[]> {
  const menuClient = ensureSupabase();
  const { data, error } = await menuClient
    .from('group_menu_items')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get menu:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    ...item,
    groupId: item.group_id,
    nameDisplay: item.name_display,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    updatedBy: item.updated_by
  })) as GroupMenuItem[];
}

/**
 * 添加菜单项（增强查重：同组内active状态菜名唯一）
 */
export async function addMenuItem(
  item: Omit<GroupMenuItem, 'id' | 'createdAt'>
): Promise<GroupMenuItem> {
  const normalizedName = normalizeDishName(item.nameDisplay);

  // 检查同组内是否已存在同名active菜品
  const checkClient = ensureSupabase();
  const { data: existingItems } = await checkClient
    .from('group_menu_items')
    .select('*')
    .eq('group_id', item.groupId)
    .eq('status', 'active')
    .ilike('name_display', normalizedName);

  if (existingItems && existingItems.length > 0) {
    const existing = existingItems[0];
    const error: any = new Error('菜名已存在');
    error.status = 409;
    error.existingItem = {
      id: existing.id,
      groupId: existing.group_id,
      nameDisplay: existing.name_display,
      price: existing.price,
      note: existing.note,
      status: existing.status,
      createdBy: existing.created_by,
      createdAt: existing.created_at,
    } as GroupMenuItem;
    throw error;
  }

  const newItem = {
    id: generateUniqueId('MI'),
    group_id: item.groupId,
    name_display: normalizedName,
    price: item.price,
    note: item.note,
    status: item.status,
    created_by: item.createdBy,
    created_at: new Date().toISOString(),
  };

  const addMenuClient = ensureSupabase();
  const { data, error } = await addMenuClient
    .from('group_menu_items')
    .insert([newItem])
    .select()
    .single();

  if (error) {
    // 如果是唯一约束冲突（数据库层面）
    if (error.code === '23505') {
      const errorWithStatus: any = new Error('菜名已存在');
      errorWithStatus.status = 409;
      throw errorWithStatus;
    }
    console.error('Failed to add menu item:', error);
    throw new Error('添加菜品失败');
  }

  return {
    id: data.id,
    groupId: data.group_id,
    nameDisplay: data.name_display,
    price: data.price,
    note: data.note,
    status: data.status,
    createdBy: data.created_by,
    createdAt: data.created_at,
  } as GroupMenuItem;
}

/**
 * 更新菜单项（价格、状态等，不包括名称）
 */
export async function updateMenuItem(
  itemId: string,
  updates: Partial<GroupMenuItem>
): Promise<GroupMenuItem> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.price !== undefined) updateData.price = updates.price;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.updatedBy !== undefined) updateData.updated_by = updates.updatedBy;

  const updateMenuClient = ensureSupabase();
  const { data, error } = await updateMenuClient
    .from('group_menu_items')
    .update(updateData)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update menu item:', error);
    throw new Error('更新菜品失败');
  }

  return {
    id: data.id,
    groupId: data.group_id,
    nameDisplay: data.name_display,
    price: data.price,
    note: data.note,
    status: data.status,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  } as GroupMenuItem;
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
  const client = ensureSupabase();

  // 1. 校验组是否已结账
  const { data: groupData, error: groupError } = await client
    .from('groups')
    .select('settled')
    .eq('id', groupId)
    .single();

  if (groupError || !groupData) {
    throw new Error('组不存在');
  }

  if (groupData.settled) {
    const error: any = new Error('该桌已结账，无法修改菜名');
    error.status = 403;
    throw error;
  }

  // 2. 规范化新名称
  const normalizedName = normalizeDishName(newName);

  // 3. 检查冲突：同组内是否已有active的新名称（排除自己）
  const { data: conflictItems } = await client
    .from('group_menu_items')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .ilike('name_display', normalizedName)
    .neq('id', menuItemId);

  if (conflictItems && conflictItems.length > 0) {
    const existing = conflictItems[0];
    const error: any = new Error('菜名已存在，请重新命名');
    error.status = 409;
    error.existingItem = {
      id: existing.id,
      groupId: existing.group_id,
      nameDisplay: existing.name_display,
      price: existing.price,
      note: existing.note,
      status: existing.status,
      createdBy: existing.created_by,
      createdAt: existing.created_at,
    } as GroupMenuItem;
    throw error;
  }

  // 4. 更新菜单项名称
  const now = new Date().toISOString();
  const { data: updatedMenuItem, error: updateError } = await client
    .from('group_menu_items')
    .update({
      name_display: normalizedName,
      updated_at: now,
      updated_by: userId
    })
    .eq('id', menuItemId)
    .select()
    .single();

  if (updateError) {
    // 如果是唯一约束冲突（数据库层面）
    if (updateError.code === '23505') {
      const errorWithStatus: any = new Error('菜名已存在，请重新命名');
      errorWithStatus.status = 409;
      throw errorWithStatus;
    }
    // 如果是触发器拦截（已结账）
    if (updateError.message?.includes('settled')) {
      const errorWithStatus: any = new Error('该桌已结账，无法修改菜名');
      errorWithStatus.status = 403;
      throw errorWithStatus;
    }
    console.error('Failed to update menu item name:', updateError);
    throw new Error('更新菜名失败');
  }

  // 5. 统一回写该组内所有轮的订单项名称（未结账期间允许）
  // 直接更新所有关联的订单项
  const { error: updateItemsError } = await client
    .from('round_items')
    .update({
      name_display: normalizedName,
      updated_at: now,
      updated_by: userId
    })
    .eq('group_id', groupId)
    .eq('menu_item_id', menuItemId);

  if (updateItemsError) {
    console.warn('Failed to update round items name:', updateItemsError);
    // 不抛出错误，因为菜单项名称已更新成功
    // RLS策略可能阻止更新，但菜单项本身已更新
  }

  return {
    id: updatedMenuItem.id,
    groupId: updatedMenuItem.group_id,
    nameDisplay: updatedMenuItem.name_display,
    price: updatedMenuItem.price,
    note: updatedMenuItem.note,
    status: updatedMenuItem.status,
    createdBy: updatedMenuItem.created_by,
    createdAt: updatedMenuItem.created_at,
    updatedAt: updatedMenuItem.updated_at,
    updatedBy: updatedMenuItem.updated_by,
  } as GroupMenuItem;
}

// ============ 轮次相关 ============

/**
 * 获取所有轮次
 */
export async function getRounds(groupId: string): Promise<Round[]> {
  const roundsClient = ensureSupabase();
  const { data, error } = await roundsClient
    .from('rounds')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to get rounds:', error);
    return [];
  }

  return (data || []).map((round: any) => ({
    id: round.id,
    groupId: round.group_id,
    status: round.status,
    createdBy: round.created_by,
    createdAt: round.created_at,
    closedAt: round.closed_at,
    memberConfirmations: round.member_confirmations || {},
  })) as Round[];
}

/**
 * 获取所有轮次 (Merchant)
 */
export async function loadAllRounds(): Promise<Round[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load all rounds:', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    groupId: r.group_id,
    status: r.status,
    reviewStatus: r.review_status || 'pending', // Default to pending if column exists
    createdBy: r.created_by,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    memberConfirmations: r.member_confirmations || {},
    merchantConfirmedAt: r.merchant_confirmed_at
  })) as Round[];
}

/**
 * Review round (Merchant)
 */
export async function reviewRound(roundId: string, action: 'confirm' | 'reject'): Promise<void> {
  const client = ensureSupabase();
  const updateData: any = {
    review_status: action === 'confirm' ? 'confirmed' : 'rejected'
  };

  if (action === 'confirm') {
    updateData.status = 'closed';
    updateData.merchant_confirmed_at = new Date().toISOString();
  }

  const { error } = await client
    .from('rounds')
    .update(updateData)
    .eq('id', roundId);

  if (error) {
    console.error('Failed to review round:', error);
    throw new Error('Review round failed');
  }
}



/**
 * Merchant: Settle group by ID
 */
export async function settleGroupById(groupId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client
    .from('groups')
    .update({ settled: true })
    .eq('id', groupId);

  if (error) {
    console.error('Failed to settle group:', error);
    throw new Error('Settle group failed');
  }
}

/**
 * 创建新轮次
 */
export async function createRound(
  groupId: string,
  createdBy: string,
  options?: { allowMember?: boolean }
): Promise<Round> {
  // 检查权限
  const checkOwnerClient = ensureSupabase();
  const { data: groupData } = await checkOwnerClient
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .single();

  if (!groupData || (!options?.allowMember && groupData.owner_id !== createdBy)) {
    throw new Error('只有管理员可以开启新轮次');
  }
  if (options?.allowMember && !((groupData as any).members || []).includes(createdBy)) {
    throw new Error('只有本桌成员可以开启新轮次');
  }

  // 幂等：如果已经存在 open 的“正常轮次”，直接返回它（避免慢网/重复点击导致并发创建）
  const checkRoundsClient = ensureSupabase();
  const { data: openRounds, error: openRoundsError } = await checkRoundsClient
    .from('rounds')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'open');

  if (openRoundsError) {
    console.error('Failed to check open rounds:', openRoundsError);
    throw new Error('检查轮次状态失败');
  }

  const openNormalRound = (openRounds || []).find((r: any) => /_R(\d+)$/.test(r.id));
  if (openNormalRound) {
    return {
      id: openNormalRound.id,
      groupId: openNormalRound.group_id,
      status: openNormalRound.status,
      createdBy: openNormalRound.created_by,
      createdAt: openNormalRound.created_at,
      closedAt: openNormalRound.closed_at,
    } as Round;
  }

  // 计算下一个轮次编号（使用唯一ID格式：{groupId}_R{num}）
  // 只统计形如 _R\d+ 的轮次，过滤掉 _Extra 等特殊轮次
  const allRoundsClient = ensureSupabase();
  const { data: allRounds } = await allRoundsClient
    .from('rounds')
    .select('id')
    .eq('group_id', groupId);

  // 过滤出正常轮次（匹配 _R 后跟数字的模式），排除 _Extra 轮次
  const normalRounds = (allRounds || []).filter(round => {
    const match = round.id.match(/_R(\d+)$/);
    return match !== null; // 只保留形如 _R1, _R2 等格式
  });

  // 从正常轮次中提取最大编号
  const maxRoundNum = normalRounds.reduce((max, round) => {
    const match = round.id.match(/_R(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      return Math.max(max, num);
    }
    return max;
  }, 0);

  const nextRoundNum = maxRoundNum + 1;
  const roundId = `${groupId}_R${nextRoundNum}`;

  // 二次确认：在写入前再查一次 open 轮次，避免并发窗口内出现“双开”
  const recheckClient = ensureSupabase();
  const { data: recheckOpenRounds } = await recheckClient
    .from('rounds')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'open');
  const recheckOpenNormal = (recheckOpenRounds || []).find((r: any) => /_R(\d+)$/.test(r.id));
  if (recheckOpenNormal) {
    return {
      id: recheckOpenNormal.id,
      groupId: recheckOpenNormal.group_id,
      status: recheckOpenNormal.status,
      createdBy: recheckOpenNormal.created_by,
      createdAt: recheckOpenNormal.created_at,
      closedAt: recheckOpenNormal.closed_at,
    } as Round;
  }

  const newRound = {
    id: roundId,
    group_id: groupId,
    status: 'open',
    created_by: createdBy,
    created_at: new Date().toISOString(),
  };

  const createRoundClient = ensureSupabase();
  const { data, error: roundError } = await createRoundClient
    .from('rounds')
    .insert([newRound])
    .select()
    .single();

  if (roundError) {
    // 并发情况下：如果数据库已存在 open 轮次（唯一约束触发），回退为读取并返回现有 open 轮次
    if (roundError.code === '23505') {
      const fallbackClient = ensureSupabase();
      const { data: fallbackOpenRounds } = await fallbackClient
        .from('rounds')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'open');
      const fallbackOpenNormal = (fallbackOpenRounds || []).find((r: any) => /_R(\d+)$/.test(r.id));
      if (fallbackOpenNormal) {
        return {
          id: fallbackOpenNormal.id,
          groupId: fallbackOpenNormal.group_id,
          status: fallbackOpenNormal.status,
          createdBy: fallbackOpenNormal.created_by,
          createdAt: fallbackOpenNormal.created_at,
          closedAt: fallbackOpenNormal.closed_at,
        } as Round;
      }
    }
    console.error('Failed to create round:', roundError);
    throw new Error('创建轮次失败: ' + roundError.message);
  }

  return {
    id: data.id,
    groupId: data.group_id,
    status: data.status,
    createdBy: data.created_by,
    createdAt: data.created_at,
  } as Round;
}

/**
 * 关闭轮次
 */
export async function closeRound(
  roundId: string,
  userId: string,
  options?: { allowMember?: boolean }
): Promise<Round> {
  // 检查权限
  const roundClient = ensureSupabase();
  const { data: roundData } = await roundClient
    .from('rounds')
    .select('group_id')
    .eq('id', roundId)
    .single();

  if (!roundData) {
    throw new Error('轮次不存在');
  }

  const groupClient = ensureSupabase();
  const { data: groupData } = await groupClient
    .from('groups')
    .select('owner_id, members')
    .eq('id', roundData.group_id)
    .single();

  if (!groupData) {
    throw new Error('组不存在');
  }
  if (!options?.allowMember && groupData.owner_id !== userId) {
    throw new Error('只有管理员可以关闭轮次');
  }
  if (options?.allowMember) {
    const members = (groupData as any).members || [];
    if (!members.includes(userId)) {
      throw new Error('仅限本桌成员操作');
    }
  }

  const updateRoundClient = ensureSupabase();
  const { data, error } = await updateRoundClient
    .from('rounds')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', roundId)
    .select()
    .single();

  if (error) {
    console.error('Failed to close round:', error);
    throw new Error('关闭轮次失败');
  }

  return {
    id: data.id,
    groupId: data.group_id,
    status: data.status,
    createdBy: data.created_by,
    createdAt: data.created_at,
    closedAt: data.closed_at,
  } as Round;
}

/**
 * 成员确认本轮点单，全部确认后自动关轮
 */
export async function confirmRoundSubmission(
  groupId: string,
  roundId: string,
  userId: string
): Promise<{ allConfirmed: boolean }> {
  return setRoundConfirmation(groupId, roundId, userId, true);
}

/**
 * 设置本轮确认状态
 */
export async function setRoundConfirmation(
  groupId: string,
  roundId: string,
  userId: string,
  confirmed: boolean
): Promise<{ allConfirmed: boolean }> {
  const client = ensureSupabase();

  const { data: groupData, error: groupError } = await client
    .from('groups')
    .select('members, settled')
    .eq('id', groupId)
    .single();

  if (groupError || !groupData) {
    throw new Error('组不存在');
  }
  if (groupData.settled) {
    throw new Error('该桌已结账');
  }
  const members: string[] = (groupData.members as string[]) || [];
  if (!members.includes(userId)) {
    throw new Error('仅限本桌成员操作');
  }

  const { data: roundData, error: roundError } = await client
    .from('rounds')
    .select('member_confirmations, status')
    .eq('id', roundId)
    .single();

  if (roundError || !roundData) {
    throw new Error('轮次不存在');
  }
  if (roundData.status !== 'open') {
    throw new Error('当前轮已结束');
  }

  const confirmations = { ...(roundData.member_confirmations || {}) } as Record<string, boolean>;
  confirmations[userId] = confirmed;
  const allConfirmed = members.every((m) => confirmations[m]);

  const { error: updateError } = await client
    .from('rounds')
    .update({
      member_confirmations: confirmations
    })
    .eq('id', roundId);

  if (updateError) {
    throw new Error('确认失败: ' + updateError.message);
  }

  return { allConfirmed };
}

// ============ 订单相关 ============

/**
 * 获取轮次的所有订单项
 */
export async function getRoundItems(roundId: string): Promise<RoundItem[]> {
  const itemsClient = ensureSupabase();
  const { data, error } = await itemsClient
    .from('round_items')
    .select('*')
    .eq('round_id', roundId)
    .eq('deleted', false);

  if (error) {
    console.error('Failed to get round items:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    groupId: item.group_id,
    roundId: item.round_id,
    userId: item.user_id,
    nameDisplay: item.name_display,
    price: item.price,
    qty: item.qty,
    note: item.note,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    deleted: item.deleted,
    deletedBy: item.deleted_by,
    menuItemId: item.menu_item_id,
    userNameSnapshot: item.user_name_snapshot,
    updatedBy: item.updated_by,
    isShared: item.is_shared ?? undefined,
    shareMode: item.share_mode ?? undefined,
    shares: item.shares ?? undefined,
    status: item.share_status ?? undefined,
    allowSelfJoin: item.allow_self_join ?? undefined,
    allowClaimUnits: item.allow_claim_units ?? undefined,
  })) as RoundItem[];
}

/**
 * 添加订单项
 */
export async function addRoundItem(
  item: Omit<RoundItem, 'id' | 'createdAt'>
): Promise<RoundItem> {
  // 检查轮次是否open
  const checkRoundClient = ensureSupabase();
  const { data: roundStatusData } = await checkRoundClient
    .from('rounds')
    .select('status')
    .eq('id', item.roundId)
    .single();

  if (!roundStatusData || roundStatusData.status !== 'open') {
    throw new Error('该轮次已关闭，无法添加订单');
  }

  const newItem: any = {
    id: generateUniqueId('RI'),
    group_id: item.groupId,
    round_id: item.roundId,
    user_id: item.userId,
    name_display: item.nameDisplay,
    price: item.price,
    qty: item.qty,
    note: item.note,
    created_at: new Date().toISOString(),
    deleted: false,
  };

  if (item.isShared !== undefined) newItem.is_shared = item.isShared;
  if (item.shareMode !== undefined) newItem.share_mode = item.shareMode;
  if (item.shares !== undefined) newItem.shares = item.shares;
  if (item.status !== undefined) newItem.share_status = item.status;
  if (item.allowSelfJoin !== undefined) newItem.allow_self_join = item.allowSelfJoin;
  if (item.allowClaimUnits !== undefined) newItem.allow_claim_units = item.allowClaimUnits;

  const addItemClient = ensureSupabase();
  const { data, error } = await addItemClient
    .from('round_items')
    .insert([newItem])
    .select()
    .single();

  if (error) {
    console.error('Failed to add round item:', error);
    throw new Error('添加订单失败');
  }

  return {
    id: data.id,
    groupId: data.group_id,
    roundId: data.round_id,
    userId: data.user_id,
    nameDisplay: data.name_display,
    price: data.price,
    qty: data.qty,
    note: data.note,
    createdAt: data.created_at,
    isShared: data.is_shared ?? undefined,
    shareMode: data.share_mode ?? undefined,
    shares: data.shares ?? undefined,
    status: data.share_status ?? undefined,
    allowSelfJoin: data.allow_self_join ?? undefined,
    allowClaimUnits: data.allow_claim_units ?? undefined,
  } as RoundItem;
}

/**
 * 更新订单项
 */
export async function updateRoundItem(
  itemId: string,
  userId: string,
  updates: Partial<RoundItem>
): Promise<RoundItem> {
  // 检查权限
  const itemClient = ensureSupabase();
  const { data: itemData } = await itemClient
    .from('round_items')
    .select('user_id, group_id, is_shared')
    .eq('id', itemId)
    .single();

  if (!itemData) {
    throw new Error('订单项不存在');
  }

  // 检查是否是owner或本人
  const groupClient = ensureSupabase();
  const { data: groupData } = await groupClient
    .from('groups')
    .select('owner_id, members')
    .eq('id', itemData.group_id)
    .single();

  const isOwner = groupData?.owner_id === userId;
  const isCreator = itemData.user_id === userId;
  const isGroupMember = Array.isArray(groupData?.members) && groupData!.members.includes(userId);

  const isSharedUpdate =
    updates.isShared !== undefined ||
    updates.shareMode !== undefined ||
    updates.status !== undefined ||
    updates.shares !== undefined ||
    updates.allowSelfJoin !== undefined ||
    updates.allowClaimUnits !== undefined;

  const touchesNonSharedFields =
    updates.qty !== undefined ||
    updates.price !== undefined ||
    updates.note !== undefined ||
    updates.nameDisplay !== undefined ||
    updates.menuItemId !== undefined ||
    updates.userNameSnapshot !== undefined ||
    updates.deleted !== undefined ||
    updates.deletedBy !== undefined;

  // 共享条目允许组内成员写入 shares/status（用于自助加入/认领）
  if (!isOwner && !isCreator) {
    const canEditSharedAsMember = !!itemData.is_shared && isGroupMember && isSharedUpdate && !touchesNonSharedFields;
    if (!canEditSharedAsMember) {
      throw new Error('无权修改此订单');
    }
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.qty !== undefined) updateData.qty = updates.qty;
  if (updates.price !== undefined) updateData.price = updates.price;
  if (updates.note !== undefined) updateData.note = updates.note;
  if (updates.nameDisplay !== undefined) updateData.name_display = updates.nameDisplay;
  if (updates.isShared !== undefined) updateData.is_shared = updates.isShared;
  if (updates.shareMode !== undefined) updateData.share_mode = updates.shareMode;
  if (updates.shares !== undefined) updateData.shares = updates.shares;
  if (updates.status !== undefined) updateData.share_status = updates.status;
  if (updates.allowSelfJoin !== undefined) updateData.allow_self_join = updates.allowSelfJoin;
  if (updates.allowClaimUnits !== undefined) updateData.allow_claim_units = updates.allowClaimUnits;

  const updateItemClient = ensureSupabase();
  const { data, error } = await updateItemClient
    .from('round_items')
    .update(updateData)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update round item:', error);
    throw new Error('更新订单失败');
  }

  return {
    id: data.id,
    groupId: data.group_id,
    roundId: data.round_id,
    userId: data.user_id,
    nameDisplay: data.name_display,
    price: data.price,
    qty: data.qty,
    note: data.note,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    isShared: data.is_shared ?? undefined,
    shareMode: data.share_mode ?? undefined,
    shares: data.shares ?? undefined,
    status: data.share_status ?? undefined,
    allowSelfJoin: data.allow_self_join ?? undefined,
    allowClaimUnits: data.allow_claim_units ?? undefined,
  } as RoundItem;
}

/**
 * 删除订单项
 */
export async function deleteRoundItem(itemId: string, userId: string): Promise<void> {
  // 检查权限（同updateRoundItem）
  const itemClient = ensureSupabase();
  const { data: itemData } = await itemClient
    .from('round_items')
    .select('user_id, group_id')
    .eq('id', itemId)
    .single();

  if (!itemData) {
    throw new Error('订单项不存在');
  }

  const groupClient = ensureSupabase();
  const { data: groupData } = await groupClient
    .from('groups')
    .select('owner_id')
    .eq('id', itemData.group_id)
    .single();

  if (itemData.user_id !== userId && groupData?.owner_id !== userId) {
    throw new Error('无权删除此订单');
  }

  const deleteClient = ensureSupabase();
  const { error: deleteError } = await deleteClient
    .from('round_items')
    .update({
      deleted: true,
      deleted_by: userId,
    })
    .eq('id', itemId);

  if (deleteError) {
    console.error('Failed to delete round item:', deleteError);
    throw new Error('删除订单失败');
  }
}

// ============ 成员管理 ============

/**
 * 删除成员（Owner权限）
 * 删除成员的订单项（标记为deleted），从成员列表中移除，但保留该成员创建的菜单项
 */
export async function removeMember(
  groupId: string,
  ownerId: string,
  memberIdToRemove: string
): Promise<void> {
  // 检查权限（必须是Owner）
  const checkOwnerClient = ensureSupabase();
  const { data: groupData } = await checkOwnerClient
    .from('groups')
    .select('owner_id, members, settled')
    .eq('id', groupId)
    .single();

  if (!groupData || groupData.owner_id !== ownerId) {
    throw new Error('只有管理员可以删除成员');
  }

  if (groupData.settled) {
    throw new Error('已结账的组不能删除成员');
  }

  if (!groupData.members.includes(memberIdToRemove)) {
    throw new Error('该用户不是组成员');
  }

  if (groupData.owner_id === memberIdToRemove) {
    throw new Error('不能删除自己（Owner）');
  }

  // 1. 删除该成员的所有订单项（标记为deleted）
  // 注意：只标记为deleted，不从数据库中删除，这样金额会自动减少
  const removeClient = ensureSupabase();
  const { error: itemsError } = await removeClient
    .from('round_items')
    .update({
      deleted: true,
      deleted_by: ownerId,
      updated_at: new Date().toISOString()
    })
    .eq('group_id', groupId)
    .eq('user_id', memberIdToRemove)
    .eq('deleted', false);

  if (itemsError) {
    console.error('Failed to delete member order items:', itemsError);
    throw new Error('删除成员订单项失败');
  }

  // 2. 不删除该成员创建的菜单项（保留菜单项，只删除订单）

  // 3. 从组成员列表中移除
  const updatedMembers = (groupData.members as string[]).filter(
    (id: string) => id !== memberIdToRemove
  );

  // 4. 从确认状态中移除（如果存在）
  const confirmClient = ensureSupabase();
  const { data: groupDataWithConfirmations } = await confirmClient
    .from('groups')
    .select('member_confirmations')
    .eq('id', groupId)
    .single();

  const memberConfirmations = (groupDataWithConfirmations?.member_confirmations as Record<string, boolean>) || {};
  delete memberConfirmations[memberIdToRemove];

  // 5. 更新组成员列表和确认状态
  const updateMemberClient = ensureSupabase();
  const { error: updateError } = await updateMemberClient
    .from('groups')
    .update({
      members: updatedMembers,
      member_confirmations: memberConfirmations
    })
    .eq('id', groupId);

  if (updateError) {
    console.error('Failed to remove member from group:', updateError);
    throw new Error('删除成员失败');
  }
}

// ============ 结账相关 ============

/**
 * 开始结账确认流程（Owner点击结账时）
 */
export async function startCheckoutConfirmation(groupId: string, userId: string): Promise<void> {
  // 检查权限
  const checkOwnerClient = ensureSupabase();
  const { data: groupData } = await checkOwnerClient
    .from('groups')
    .select('owner_id, members, checkout_confirming')
    .eq('id', groupId)
    .single();

  if (!groupData || groupData.owner_id !== userId) {
    throw new Error('只有管理员可以结账');
  }

  // 幂等：已在确认流程中则直接返回（避免重复点击触发多次状态写入）
  if (groupData.checkout_confirming) {
    return;
  }

  // 初始化成员确认状态（所有成员都未确认）
  const memberConfirmations: Record<string, boolean> = {};
  groupData.members.forEach((memberId: string) => {
    memberConfirmations[memberId] = false;
  });

  // 创建Extra round（用于调整数量）
  const extraRoundId = `${groupId}_Extra`;

  // 检查Extra round是否已存在
  const checkRoundClient = ensureSupabase();
  const { data: existingRound } = await checkRoundClient
    .from('rounds')
    .select('id')
    .eq('id', extraRoundId)
    .single();

  if (!existingRound) {
    // 创建Extra round
    const { error: roundError } = await ensureSupabase().from('rounds').insert([{
      id: extraRoundId,
      group_id: groupId,
      status: 'open', // Extra round保持open状态
      created_by: userId,
      created_at: new Date().toISOString()
    }]);

    if (roundError) {
      console.error('Failed to create extra round:', roundError);
      // 如果创建失败，仍然可以继续确认流程
    }
  }

  // 标记组为结账确认中
  const confirmClient = ensureSupabase();
  const { error } = await confirmClient
    .from('groups')
    .update({
      checkout_confirming: true,
      member_confirmations: memberConfirmations
    })
    .eq('id', groupId);

  if (error) {
    console.error('Failed to start checkout confirmation:', error);
    throw new Error('启动结账确认失败');
  }
}

/**
 * 成员确认订单
 */
export async function confirmMemberOrder(groupId: string, userId: string): Promise<void> {
  // 获取组信息
  const getGroupClient = ensureSupabase();
  const { data: groupData, error: groupError } = await getGroupClient
    .from('groups')
    .select('member_confirmations, checkout_confirming')
    .eq('id', groupId)
    .single();

  if (groupError || !groupData) {
    throw new Error('无法获取组信息');
  }

  if (!groupData.checkout_confirming) {
    throw new Error('当前不在结账确认流程中');
  }

  const memberConfirmations = (groupData.member_confirmations as Record<string, boolean>) || {};
  memberConfirmations[userId] = true;

  // 更新成员确认状态
  const updateConfirmClient = ensureSupabase();
  const { error } = await updateConfirmClient
    .from('groups')
    .update({ member_confirmations: memberConfirmations })
    .eq('id', groupId);

  if (error) {
    console.error('Failed to confirm member order:', error);
    throw new Error('确认订单失败');
  }
}

/**
 * 最终确认结账（所有成员确认后，Owner调用）
 */
export async function finalizeCheckout(
  groupId: string,
  userId: string,
  options?: { force?: boolean }
): Promise<void> {
  const client = ensureSupabase();

  // 检查权限
  const { data: groupData } = await client
    .from('groups')
    .select('owner_id, member_confirmations, checkout_confirming, members')
    .eq('id', groupId)
    .single();

  if (!groupData || groupData.owner_id !== userId) {
    throw new Error('只有管理员可以最终确认结账');
  }

  if (!groupData.checkout_confirming && !options?.force) {
    throw new Error('当前不在结账确认流程中');
  }

  // 检查所有成员是否都已确认
  const memberConfirmations = (groupData.member_confirmations as Record<string, boolean>) || {};
  const allConfirmed = groupData.members.every((memberId: string) => memberConfirmations[memberId] === true);

  if (!allConfirmed && !options?.force) {
    const unconfirmedMembers = groupData.members.filter(
      (memberId: string) => !memberConfirmations[memberId]
    );
    throw new Error(`还有 ${unconfirmedMembers.length} 位成员未确认订单`);
  }

  // 结账前：1. 昵称快照（从users表获取当前昵称）
  const { data: membersData } = await client
    .from('users')
    .select('id, name')
    .in('id', groupData.members);

  const memberNameMap = new Map<string, string>();
  (membersData || []).forEach((user: any) => {
    memberNameMap.set(user.id, user.name);
  });

  // 更新所有订单项的昵称快照
  for (const memberId of groupData.members) {
    const userName = memberNameMap.get(memberId) || memberId;
    await client
      .from('round_items')
      .update({ user_name_snapshot: userName })
      .eq('group_id', groupId)
      .eq('user_id', memberId)
      .is('user_name_snapshot', null); // 只更新未设置快照的
  }

  // 结账前：2. 名称快照统一（确保此时订单名与最新菜单名一致）
  // 获取所有菜单项
  const { data: menuItems } = await client
    .from('group_menu_items')
    .select('id, name_display')
    .eq('group_id', groupId)
    .eq('status', 'active');

  // 更新所有关联订单项的名称快照
  for (const menuItem of (menuItems || [])) {
    await client
      .from('round_items')
      .update({ name_display: menuItem.name_display })
      .eq('group_id', groupId)
      .eq('menu_item_id', menuItem.id);
  }

  // 关闭所有open的轮次（包括Extra round）
  await client
    .from('rounds')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('group_id', groupId)
    .eq('status', 'open');

  // 标记组为已结账
  const { error } = await client
    .from('groups')
    .update({
      settled: true,
      checkout_confirming: false
    })
    .eq('id', groupId);

  if (error) {
    console.error('Failed to finalize checkout:', error);
    throw new Error('结账失败');
  }
}

/**
 * 结账（兼容旧接口，如果不在确认流程中，直接结账）
 */
export async function settleGroup(groupId: string, userId: string): Promise<void> {
  // 检查是否在确认流程中
  const checkStatusClient = ensureSupabase();
  const { data: groupData } = await checkStatusClient
    .from('groups')
    .select('checkout_confirming')
    .eq('id', groupId)
    .single();

  if (groupData?.checkout_confirming) {
    // 如果在确认流程中，调用最终确认
    await finalizeCheckout(groupId, userId);
    return;
  }

  // 否则直接结账（旧流程）
  const checkOwnerClient = ensureSupabase();
  const { data: ownerData } = await checkOwnerClient
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .single();

  if (!ownerData || ownerData.owner_id !== userId) {
    throw new Error('只有管理员可以结账');
  }

  // 关闭所有open的轮次
  const closeRoundsClient = ensureSupabase();
  await closeRoundsClient
    .from('rounds')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('group_id', groupId)
    .eq('status', 'open');

  // 标记组为已结账
  const settleClient = ensureSupabase();
  const { error: settleError } = await settleClient
    .from('groups')
    .update({ settled: true })
    .eq('id', groupId);

  if (settleError) {
    console.error('Failed to settle group:', settleError);
    throw new Error('结账失败');
  }
}

// ============ 店铺历史菜单相关 ============

/**
 * 在结账后，把本次 group 的所有去重过的菜品，保存为一个 restaurant_menu
 */
export async function saveGroupAsRestaurantMenu(
  groupId: string,
  userId: string,
  displayName: string
): Promise<void> {
  const client = ensureSupabase();

  // 1. 收集本次聚餐的所有点单条目
  const { data: allGroupItems, error: itemsError } = await client
    .from('round_items')
    .select('*')
    .eq('group_id', groupId)
    .eq('deleted', false);

  if (itemsError) {
    console.error('Failed to fetch round items:', itemsError);
    throw new Error('获取订单项失败');
  }

  if (!allGroupItems || allGroupItems.length === 0) {
    // 极端情况：没有任何 item，直接返回
    return;
  }

  // 2. 对 item 按 (nameDisplay, price, note) 去重
  const uniqueItemsMap = new Map<string, typeof allGroupItems[0]>();
  allGroupItems.forEach(item => {
    const key = `${item.name_display.trim()}:${item.price}:${item.note || ''}`;
    if (!uniqueItemsMap.has(key)) {
      uniqueItemsMap.set(key, item);
    }
  });
  const uniqueItems = Array.from(uniqueItemsMap.values());

  // 3. 创建新的 RestaurantMenu
  const now = new Date().toISOString();
  const restaurantMenuId = 'rm_' + generateShortId();

  const { error: menuError } = await client
    .from('restaurant_menus')
    .insert([{
      id: restaurantMenuId,
      created_from_group_id: groupId,
      created_at: now
    }]);

  if (menuError) {
    console.error('Failed to create restaurant menu:', menuError);
    throw new Error('创建店铺菜单失败: ' + menuError.message);
  }

  // 4. 保存对应的 RestaurantMenuItem[]
  if (uniqueItems.length > 0) {
    const menuItemsToInsert = uniqueItems.map(item => ({
      id: generateUniqueId('RMI'),
      restaurant_menu_id: restaurantMenuId,
      name_display: item.name_display,
      price: item.price,
      note: item.note || null,
      created_at: now
    }));

    const { error: itemsInsertError } = await client
      .from('restaurant_menu_items')
      .insert(menuItemsToInsert);

    if (itemsInsertError) {
      console.error('Failed to insert menu items:', itemsInsertError);
      // 回滚：删除已创建的菜单
      await client.from('restaurant_menus').delete().eq('id', restaurantMenuId);
      throw new Error('保存菜单项失败');
    }
  }

  // 5. 建立 UserRestaurantMenuLink，带上"最多 2 个 + LRU"逻辑
  const { data: userLinks, error: linksError } = await client
    .from('user_restaurant_menu_links')
    .select('*')
    .eq('user_id', userId);

  if (linksError) {
    console.error('Failed to fetch user links:', linksError);
    throw new Error('获取用户关联失败');
  }

  if (!userLinks || userLinks.length < 2) {
    // 直接插入新 link
    const { error: linkInsertError } = await client
      .from('user_restaurant_menu_links')
      .insert([{
        user_id: userId,
        restaurant_menu_id: restaurantMenuId,
        display_name: displayName,
        created_at: now,
        last_used_at: now
      }]);

    if (linkInsertError) {
      console.error('Failed to create user link:', linkInsertError);
      throw new Error('创建用户关联失败: ' + linkInsertError.message);
    }
  } else {
    // 找出 lastUsedAt 最早的那一条 link
    const sortedLinks = [...userLinks].sort((a, b) => {
      const aTime = a.last_used_at || a.created_at;
      const bTime = b.last_used_at || b.created_at;
      return aTime.localeCompare(bTime);
    });
    const oldestLink = sortedLinks[0];

    // 检查这个 restaurantMenuId 是否还被其他用户使用
    const { data: otherUserLinks, error: otherLinksError } = await client
      .from('user_restaurant_menu_links')
      .select('*')
      .eq('restaurant_menu_id', oldestLink.restaurant_menu_id)
      .neq('user_id', userId);

    if (otherLinksError) {
      console.error('Failed to check other user links:', otherLinksError);
      throw new Error('检查其他用户关联失败');
    }

    // 删除旧的 link
    const { error: deleteLinkError } = await client
      .from('user_restaurant_menu_links')
      .delete()
      .eq('user_id', oldestLink.user_id)
      .eq('restaurant_menu_id', oldestLink.restaurant_menu_id);

    if (deleteLinkError) {
      console.error('Failed to delete old link:', deleteLinkError);
      throw new Error('删除旧关联失败');
    }

    // 如果没有其他用户使用，删除这个 RestaurantMenu 及其 RestaurantMenuItem[]
    if (!otherUserLinks || otherUserLinks.length === 0) {
      await client
        .from('restaurant_menu_items')
        .delete()
        .eq('restaurant_menu_id', oldestLink.restaurant_menu_id);

      await client
        .from('restaurant_menus')
        .delete()
        .eq('id', oldestLink.restaurant_menu_id);
    }

    // 插入当前用户指向新 RestaurantMenu 的 link
    const { error: linkInsertError } = await client
      .from('user_restaurant_menu_links')
      .insert([{
        user_id: userId,
        restaurant_menu_id: restaurantMenuId,
        display_name: displayName,
        created_at: now,
        last_used_at: now
      }]);

    if (linkInsertError) {
      console.error('Failed to create user link:', linkInsertError);
      throw new Error('创建用户关联失败');
    }
  }

  // 6. 清理孤儿菜单（确保没有 link 的菜单被删除）
  // 使用 SQL 查询找出没有关联的菜单并删除
  const { data: allMenus, error: allMenusError } = await client
    .from('restaurant_menus')
    .select('id');

  if (!allMenusError && allMenus) {
    const { data: allLinks, error: allLinksError } = await client
      .from('user_restaurant_menu_links')
      .select('restaurant_menu_id');

    if (!allLinksError && allLinks) {
      const menuIdsWithLinks = new Set(allLinks.map(l => l.restaurant_menu_id));
      const orphanMenuIds = allMenus
        .map(m => m.id)
        .filter(id => !menuIdsWithLinks.has(id));

      if (orphanMenuIds.length > 0) {
        // 删除孤儿菜单的 items
        await client
          .from('restaurant_menu_items')
          .delete()
          .in('restaurant_menu_id', orphanMenuIds);

        // 删除孤儿菜单
        await client
          .from('restaurant_menus')
          .delete()
          .in('id', orphanMenuIds);
      }
    }
  }
}

/**
 * 获取当前用户收藏过的所有店铺菜单
 */
export async function getUserRestaurantMenus(
  userId: string
): Promise<Array<{
  link: import('@/types').UserRestaurantMenuLink;
  menu: import('@/types').RestaurantMenu;
  items: import('@/types').RestaurantMenuItem[];
}>> {
  const client = ensureSupabase();

  // 找到该用户的所有 link
  const { data: userLinks, error: linksError } = await client
    .from('user_restaurant_menu_links')
    .select('*')
    .eq('user_id', userId);

  if (linksError) {
    console.error('Failed to fetch user links:', linksError);
    throw new Error('获取用户关联失败: ' + linksError.message);
  }

  if (!userLinks || userLinks.length === 0) {
    return [];
  }

  // 为每个 link 找到对应的 menu 和 items
  const result = await Promise.all(
    userLinks.map(async (link) => {
      const { data: menu, error: menuError } = await client
        .from('restaurant_menus')
        .select('*')
        .eq('id', link.restaurant_menu_id)
        .single();

      if (menuError || !menu) {
        // 数据不一致，跳过
        return null;
      }

      const { data: items, error: itemsError } = await client
        .from('restaurant_menu_items')
        .select('*')
        .eq('restaurant_menu_id', link.restaurant_menu_id);

      if (itemsError) {
        console.error('Failed to fetch menu items:', itemsError);
        return null;
      }

      return {
        link: {
          userId: link.user_id,
          restaurantMenuId: link.restaurant_menu_id,
          displayName: link.display_name,
          createdAt: link.created_at,
          lastUsedAt: link.last_used_at
        },
        menu: {
          id: menu.id,
          createdFromGroupId: menu.created_from_group_id,
          createdAt: menu.created_at
        },
        items: (items || []).map(item => ({
          id: item.id,
          restaurantMenuId: item.restaurant_menu_id,
          nameDisplay: item.name_display,
          price: item.price,
          note: item.note || undefined
        }))
      };
    })
  );

  return result.filter((item): item is NonNullable<typeof item> => item !== null);
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
  const client = ensureSupabase();

  // 验证组是否存在
  const { data: group, error: groupError } = await client
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    throw new Error('组不存在');
  }

  // 获取要导入的菜单项
  const { data: menuItemsToImport, error: itemsError } = await client
    .from('restaurant_menu_items')
    .select('*')
    .eq('restaurant_menu_id', restaurantMenuId);

  if (itemsError) {
    console.error('Failed to fetch menu items:', itemsError);
    throw new Error('获取菜单项失败');
  }

  if (!menuItemsToImport || menuItemsToImport.length === 0) {
    throw new Error('菜单为空');
  }

  // 获取当前组的菜单
  const { data: currentMenu, error: menuError } = await client
    .from('group_menu_items')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'active');

  if (menuError) {
    console.error('Failed to fetch current menu:', menuError);
    throw new Error('获取当前菜单失败');
  }

  // 使用现有的菜单去重逻辑导入
  let importedCount = 0;
  const conflicts: Array<{ nameDisplay: string; price: number; note?: string }> = [];
  const itemsToInsert: Array<{
    id: string;
    group_id: string;
    name_display: string;
    price: number;
    note: string | null;
    status: string;
    created_by: string;
    created_at: string;
  }> = [];

  for (const menuItem of menuItemsToImport) {
    // 检查是否冲突（同名不同价）
    const conflict = currentMenu?.find(
      item =>
        item.name_display.trim() === menuItem.name_display.trim() &&
        item.price !== menuItem.price &&
        item.status === 'active'
    );

    if (conflict) {
      // 跳过冲突项
      conflicts.push({
        nameDisplay: menuItem.name_display,
        price: menuItem.price,
        note: menuItem.note || undefined
      });
      continue;
    }

    // 检查是否已存在同名同价
    const exists = currentMenu?.find(
      item =>
        item.name_display.trim() === menuItem.name_display.trim() &&
        item.price === menuItem.price &&
        item.status === 'active'
    );

    if (!exists) {
      // 准备插入新菜单项
      itemsToInsert.push({
        id: generateUniqueId('MI'),
        group_id: groupId,
        name_display: menuItem.name_display,
        price: menuItem.price,
        note: menuItem.note || null,
        status: 'active',
        created_by: userId,
        created_at: new Date().toISOString()
      });
      importedCount++;
    }
  }

  // 批量插入新菜单项
  if (itemsToInsert.length > 0) {
    const { error: insertError } = await client
      .from('group_menu_items')
      .insert(itemsToInsert);

    if (insertError) {
      console.error('Failed to insert menu items:', insertError);
      throw new Error('导入菜单项失败');
    }
  }

  // 更新当前用户的 UserRestaurantMenuLink.lastUsedAt
  const { error: updateError } = await client
    .from('user_restaurant_menu_links')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('restaurant_menu_id', restaurantMenuId);

  if (updateError) {
    console.error('Failed to update last_used_at:', updateError);
    // 不抛出错误，因为导入已经成功
  }

  return {
    imported: importedCount,
    conflicts
  };
}

/**
 * 获取用户账单
 */
export async function getUserBill(groupId: string, userId: string): Promise<UserBill> {
  const user = await getUser(userId);
  if (!user) throw new Error('用户不存在');

  const locale = getDefaultLocale();
  const sharedSuffix = translate(locale, 'bill.sharedSuffix');

  const rounds = await getRounds(groupId);
  const allItems = await Promise.all(rounds.map(r => getRoundItems(r.id)));
  const groupItems = allItems.flat().filter(item => !item.deleted);

  const roundBills = rounds.map(round => {
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
      roundTotal: calculateTotal(items),
    };
  });

  const grandTotal = roundBills.reduce((sum, rb) => sum + rb.roundTotal, 0);

  return {
    userId,
    userName: user.name,
    rounds: roundBills,
    grandTotal,
  };
}

/**
 * 获取整桌账单
 */
export async function getGroupBill(groupId: string): Promise<GroupBill> {
  const rounds = await getRounds(groupId);
  const allItems = await Promise.all(rounds.map(r => getRoundItems(r.id)));

  const roundSummaries: RoundSummary[] = rounds.map((round, index) => {
    const items = allItems[index];
    const aggregated = aggregateItemsByName(items);

    return {
      roundId: round.id,
      items,
      totalAmount: calculateTotal(items),
      aggregatedItems: aggregated,
    };
  });

  const getGroupClient = ensureSupabase();
  const { data: groupData } = await getGroupClient
    .from('groups')
    .select('members')
    .eq('id', groupId)
    .single();

  const memberIds = groupData?.members || [];
  const memberBills = await Promise.all(
    memberIds.map((memberId: string) => getUserBill(groupId, memberId))
  );

  const grandTotal = roundSummaries.reduce((sum, rs) => sum + rs.totalAmount, 0);

  return {
    groupId,
    rounds: roundSummaries,
    grandTotal,
    memberBills,
  };
}
