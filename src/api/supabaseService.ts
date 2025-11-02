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

// ============ 用户相关 ============

/**
 * 创建用户
 */
export async function createUser(name: string): Promise<User> {
  const createUserClient = ensureSupabase();
  const userId = generateUniqueId('U');
  
  // 插入时使用数据库字段名（snake_case）
  const { error } = await createUserClient.from('users').insert([{
    id: userId,
    name: name,
  }]);
  
  if (error) {
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
  } as Round : undefined;

  return {
    group,
    members,
    currentRound
  };
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
 * 添加菜单项
 */
export async function addMenuItem(
  item: Omit<GroupMenuItem, 'id' | 'createdAt'>
): Promise<GroupMenuItem> {
  const newItem = {
    id: generateUniqueId('MI'),
    group_id: item.groupId,
    name_display: item.nameDisplay,
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
 * 更新菜单项
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
  })) as Round[];
}

/**
 * 创建新轮次
 */
export async function createRound(groupId: string, createdBy: string): Promise<Round> {
  // 检查权限
  const checkOwnerClient = ensureSupabase();
  const { data: groupData } = await checkOwnerClient
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .single();

  if (!groupData || groupData.owner_id !== createdBy) {
    throw new Error('只有管理员可以开启新轮次');
  }

  // 检查是否有未关闭的轮次
  const checkRoundsClient = ensureSupabase();
  const { data: openRounds } = await checkRoundsClient
    .from('rounds')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'open');

  if (openRounds && openRounds.length > 0) {
    throw new Error('请先关闭当前轮次');
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
export async function closeRound(roundId: string, userId: string): Promise<Round> {
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
    .select('owner_id')
    .eq('id', roundData.group_id)
    .single();

  if (!groupData || groupData.owner_id !== userId) {
    throw new Error('只有管理员可以关闭轮次');
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

  const newItem = {
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
    .select('user_id, group_id')
    .eq('id', itemId)
    .single();

  if (!itemData) {
    throw new Error('订单项不存在');
  }

  // 检查是否是owner或本人
  const groupClient = ensureSupabase();
  const { data: groupData } = await groupClient
    .from('groups')
    .select('owner_id')
    .eq('id', itemData.group_id)
    .single();

  if (itemData.user_id !== userId && groupData?.owner_id !== userId) {
    throw new Error('无权修改此订单');
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.qty !== undefined) updateData.qty = updates.qty;
  if (updates.price !== undefined) updateData.price = updates.price;

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
    .select('owner_id, members')
    .eq('id', groupId)
    .single();

  if (!groupData || groupData.owner_id !== userId) {
    throw new Error('只有管理员可以结账');
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
export async function finalizeCheckout(groupId: string, userId: string): Promise<void> {
  // 检查权限
  const checkOwnerClient = ensureSupabase();
  const { data: groupData } = await checkOwnerClient
    .from('groups')
    .select('owner_id, member_confirmations, checkout_confirming, members')
    .eq('id', groupId)
    .single();

  if (!groupData || groupData.owner_id !== userId) {
    throw new Error('只有管理员可以最终确认结账');
  }

  if (!groupData.checkout_confirming) {
    throw new Error('当前不在结账确认流程中');
  }

  // 检查所有成员是否都已确认
  const memberConfirmations = (groupData.member_confirmations as Record<string, boolean>) || {};
  const allConfirmed = groupData.members.every((memberId: string) => memberConfirmations[memberId] === true);

  if (!allConfirmed) {
    const unconfirmedMembers = groupData.members.filter(
      (memberId: string) => !memberConfirmations[memberId]
    );
    throw new Error(`还有 ${unconfirmedMembers.length} 位成员未确认订单`);
  }

  // 关闭所有open的轮次（包括Extra round）
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
  const finalizeClient = ensureSupabase();
  const { error } = await finalizeClient
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

/**
 * 获取用户账单
 */
export async function getUserBill(groupId: string, userId: string): Promise<UserBill> {
  const user = await getUser(userId);
  if (!user) throw new Error('用户不存在');

  const rounds = await getRounds(groupId);
  const allItems = await Promise.all(rounds.map(r => getRoundItems(r.id)));
  const userItems = allItems.flat().filter(item => item.userId === userId);

  const roundBills = rounds.map(round => {
    const items = userItems.filter(item => item.roundId === round.id);
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

