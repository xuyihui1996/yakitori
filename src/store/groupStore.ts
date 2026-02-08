/**
 * 组状态管理
 * 使用Zustand管理当前组的所有状态
 */

import { create } from 'zustand';
import {
  Group,
  User,
  GroupMenuItem,
  Round,
  RoundItem,
  MenuConflict
} from '@/types';
// 根据 Supabase 配置状态选择使用哪个服务
import { isSupabaseConfigured } from '@/api/supabaseClient';
import * as supabaseApi from '@/api/supabaseService';
import * as mockApi from '@/api/mockService';

// 如果 Supabase 已配置，使用 Supabase 服务；否则使用 Mock 服务
const api = isSupabaseConfigured ? supabaseApi : mockApi;
import { checkMenuConflict } from '@/utils/menu';
import { computeSharedAllocations, getSharedUnitsRemaining } from '@/utils/split';
import { tGlobal } from '@/i18n/global';

interface GroupState {
  // 当前状态
  currentUser: User | null;
  currentGroup: Group | null;
  members: User[];
  menu: GroupMenuItem[];
  rounds: Round[];
  currentRound: Round | null;
  roundItems: RoundItem[]; // 当前轮的订单项
  allRoundItems: RoundItem[]; // 所有轮的订单项

  // 加载状态
  loading: boolean;
  error: string | null;
  actionLoading: Partial<Record<
    'createNewRound' |
    'closeCurrentRound' |
    'startCheckoutConfirmation' |
    'finalizeCheckout' |
    'confirmRound',
    boolean
  >>;

  // Actions
  setCurrentUser: (user: User) => void;
  createGroup: (ownerName: string, tableNo?: string) => Promise<{ group: Group; user: User }>;
  joinGroup: (groupId: string, userName: string) => Promise<void>;
  loadGroup: (groupId: string) => Promise<void>;
  loadMenu: () => Promise<void>;
  loadRounds: () => Promise<void>;
  loadRoundItems: (roundId: string) => Promise<void>;
  loadAllRoundItems: () => Promise<void>;

  // 菜单操作
  addMenuItem: (item: Omit<GroupMenuItem, 'id' | 'createdAt' | 'createdBy' | 'groupId'>) => Promise<{ success: boolean; conflict?: MenuConflict }>;
  updateMenuItemPrice: (nameDisplay: string, newPrice: number) => Promise<void>;
  updateMenuItemName: (menuItemId: string, newName: string) => Promise<void>;
  disableMenuItem: (itemId: string) => Promise<void>;

  // 轮次操作
  createNewRound: () => Promise<void>;
  closeCurrentRound: () => Promise<void>;
  confirmCurrentRound: () => Promise<void>;
  clearCurrentRoundConfirmationIfNeeded: () => Promise<void>;

  // 订单操作
  addOrderItem: (item: Omit<RoundItem, 'id' | 'createdAt' | 'groupId' | 'roundId' | 'userId'>) => Promise<void>;
  updateOrderItem: (itemId: string, qty: number) => Promise<void>;
  deleteOrderItem: (itemId: string) => Promise<void>;

  // RoundItem（通用）
  addRoundItem: (item: Omit<RoundItem, 'id' | 'createdAt' | 'groupId' | 'roundId' | 'userId'>) => Promise<RoundItem>;
  updateRoundItem: (itemId: string, updates: Partial<RoundItem>) => Promise<void>;

  // 共享条目
  createSharedItem: (item: {
    nameDisplay: string;
    price: number;
    qty: number;
    note?: string;
    shareMode: import('@/types').ShareMode;
    shares?: import('@/types').RoundItemShare[];
    allowSelfJoin?: boolean;
    allowClaimUnits?: boolean;
  }) => Promise<void>;
  joinSharedItem: (itemId: string, options?: { weight?: number; units?: number }) => Promise<void>;
  addParticipantsToSharedItem: (itemId: string, userIds: string[]) => Promise<void>;
  removeParticipantFromSharedItem: (itemId: string, userId: string) => Promise<void>;
  lockRoundItem: (itemId: string, options?: { force?: boolean }) => Promise<void>;

  // 结账
  startCheckoutConfirmation: () => Promise<void>;
  confirmMemberOrder: () => Promise<void>;
  finalizeCheckout: (options?: { force?: boolean }) => Promise<void>;
  settleGroup: () => Promise<void>;

  // Merchant View
  groups: Group[];
  allRounds: Round[];
  loadAllGroups: () => Promise<void>;
  loadAllRounds: () => Promise<void>;
  reviewRound: (roundId: string, action: 'confirm' | 'reject') => Promise<void>;
  settleGroupById: (groupId: string) => Promise<void>;

  // 成员管理
  removeMember: (memberId: string) => Promise<void>;

  // 店铺历史菜单
  saveGroupAsRestaurantMenu: (displayName: string) => Promise<void>;
  getUserRestaurantMenus: () => Promise<Array<{
    link: import('@/types').UserRestaurantMenuLink;
    menu: import('@/types').RestaurantMenu;
    items: import('@/types').RestaurantMenuItem[];
  }>>;
  importRestaurantMenuToGroup: (restaurantMenuId: string) => Promise<{
    imported: number;
    conflicts: Array<{ nameDisplay: string; price: number; note?: string }>;
  }>;

  // 清空状态
  reset: () => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  // 初始状态
  currentUser: null,
  currentGroup: null,
  members: [],
  menu: [],
  rounds: [],
  currentRound: null,
  roundItems: [],
  allRoundItems: [],
  loading: false,
  error: null,
  actionLoading: {},

  setCurrentUser: (user) => {
    set({ currentUser: user });
  },

  groups: [],
  allRounds: [],

  loadAllGroups: async () => {
    set({ loading: true, error: null });
    try {
      const groups = await api.loadAllGroups();
      set({ groups, loading: false });
    } catch (error) {
      console.error('Failed to load all groups', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadAllRounds: async () => {
    try {
      const allRounds = await api.loadAllRounds();
      set({ allRounds });
    } catch (error) {
      console.error('Failed to load all rounds', error);
    }
  },

  reviewRound: async (roundId: string, action: 'confirm' | 'reject') => {
    try {
      await api.reviewRound(roundId, action);
      // Refresh
      await get().loadAllRounds();
      await get().loadAllGroups();
    } catch (error) {
      console.error('Failed to review round', error);
      throw error;
    }
  },

  settleGroupById: async (groupId: string) => {
    try {
      await api.settleGroupById(groupId);
      await get().loadAllGroups();
    } catch (error) {
      console.error('Failed to settle group', error);
      throw error; // Let UI handle error
    }
  },

  createGroup: async (ownerName: string, tableNo?: string) => {
    set({ loading: true, error: null });
    try {
      const { group, user } = await api.createGroup(ownerName, tableNo);
      localStorage.setItem('ordered_user_id', user.id);
      localStorage.setItem('ordered_group_id', group.id);

      set({
        currentUser: user,
        currentGroup: group,
        members: [user],
        loading: false
      });

      // 加载其他数据
      await get().loadRounds();
      await get().loadMenu();

      return { group, user };
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  joinGroup: async (groupId: string, userName: string) => {
    set({ loading: true, error: null });
    try {
      const { group, user } = await api.joinGroup(groupId, userName);
      localStorage.setItem('ordered_user_id', user.id);
      localStorage.setItem('ordered_group_id', group.id);

      set({
        currentUser: user,
        currentGroup: group,
        loading: false
      });

      // 加载其他数据
      await get().loadGroup(groupId);
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  loadGroup: async (groupId: string) => {
    set({ loading: true, error: null });
    try {
      const { group, members, currentRound } = await api.getGroup(groupId);

      set({
        currentGroup: group,
        members,
        currentRound: currentRound || null,
        loading: false
      });

      // 加载关联数据
      await Promise.all([
        get().loadMenu(),
        get().loadRounds(),
      ]);

      if (currentRound) {
        await get().loadRoundItems(currentRound.id);
      }
      await get().loadAllRoundItems();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  loadMenu: async () => {
    const { currentGroup } = get();
    if (!currentGroup) return;

    try {
      const menu = await api.getMenu(currentGroup.id);
      set({ menu });
    } catch (error) {
      console.error('Failed to load menu:', error);
    }
  },

  loadRounds: async () => {
    const { currentGroup } = get();
    if (!currentGroup) return;

    try {
      const rounds = await api.getRounds(currentGroup.id);
      const currentRound = rounds.find(r => r.status === 'open') || null;
      set({ rounds, currentRound });
    } catch (error) {
      console.error('Failed to load rounds:', error);
    }
  },

  loadRoundItems: async (roundId: string) => {
    try {
      const items = await api.getRoundItems(roundId);
      set({ roundItems: items });
    } catch (error) {
      console.error('Failed to load round items:', error);
    }
  },

  loadAllRoundItems: async () => {
    const { currentGroup, rounds } = get();
    if (!currentGroup) return;

    try {
      const allItems = await Promise.all(
        rounds.map(r => api.getRoundItems(r.id))
      );
      set({ allRoundItems: allItems.flat() });
    } catch (error) {
      console.error('Failed to load all round items:', error);
    }
  },

  addMenuItem: async (item) => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) {
      throw new Error('未登录或未加入组');
    }

    // 重新加载菜单以确保使用最新数据
    await get().loadMenu();
    const latestMenu = get().menu;

    // 检查冲突（使用最新菜单）
    const conflict = checkMenuConflict(latestMenu, item);

    if (conflict.exists && conflict.conflictType === 'price_mismatch') {
      // 返回冲突信息，让UI处理
      return { success: false, conflict };
    }

    if (conflict.exists && !conflict.conflictType) {
      // 完全相同的菜品已存在，不添加新项
      return { success: false, conflict };
    }

    // 添加到菜单（只有在没有冲突时才添加）
    try {
      await api.addMenuItem({
        ...item,
        groupId: currentGroup.id,
        createdBy: currentUser.id
      });

      // 重新加载菜单以同步
      await get().loadMenu();
      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  updateMenuItemPrice: async (nameDisplay: string, newPrice: number) => {
    const { currentGroup, currentUser, menu, allRoundItems } = get();
    if (!currentGroup || !currentUser) return;

    // 找到所有同名同组的菜单项
    const sameNameItems = menu.filter(
      item => item.nameDisplay.trim() === nameDisplay.trim() &&
        item.groupId === currentGroup.id &&
        item.status === 'active'
    );

    // 更新所有同名菜单项的价格（并行处理）
    await Promise.all(
      sameNameItems.map(item =>
        api.updateMenuItem(item.id, {
          price: newPrice,
          updatedBy: currentUser.id
        }).catch(error => {
          console.error(`Failed to update menu item ${item.id}:`, error);
        })
      )
    );

    // 使用本地缓存的 allRoundItems，找到所有同名的订单项
    // 这样避免为每个轮次串行请求数据
    const sameNameOrderItems = allRoundItems.filter(
      orderItem =>
        orderItem.nameDisplay.trim() === nameDisplay.trim() &&
        orderItem.groupId === currentGroup.id &&
        !orderItem.deleted
    );

    // 检查权限并批量更新订单项价格（并行处理）
    const isOwner = currentGroup.ownerId === currentUser.id;
    const updatePromises = sameNameOrderItems.map(async (orderItem) => {
      const canUpdate = isOwner || orderItem.userId === currentUser.id;

      if (canUpdate) {
        try {
          await api.updateRoundItem(orderItem.id, currentUser.id, {
            price: newPrice, // 统一更新为新价格
            qty: orderItem.qty // 保持数量不变
          });
        } catch (error) {
          console.error(`Failed to update round item ${orderItem.id}:`, error);
        }
      } else {
        console.warn(`Cannot update round item ${orderItem.id}: permission denied`);
      }
    });

    // 并行执行所有更新
    await Promise.all(updatePromises);

    // 重新加载数据以同步
    await Promise.all([
      get().loadMenu(),
      get().loadRounds(),
      get().loadAllRoundItems() // 重新加载所有订单项以更新本地缓存
    ]);

    // 重新加载当前轮的订单项（如果存在）
    const currentRound = get().currentRound;
    if (currentRound) {
      await get().loadRoundItems(currentRound.id);
    }
  },

  updateMenuItemName: async (menuItemId: string, newName: string) => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) {
      throw new Error('未登录或未加入组');
    }

    try {
      await api.updateMenuItemName(currentGroup.id, menuItemId, newName, currentUser.id);
      // 重新加载菜单和所有订单项
      await Promise.all([
        get().loadMenu(),
        get().loadAllRoundItems(),
        get().loadRounds()
      ]);
    } catch (error: any) {
      // 409冲突错误直接抛出，让前端处理
      if (error.status === 409 || error.status === 403) {
        throw error;
      }
      throw new Error('修改菜名失败: ' + (error.message || '未知错误'));
    }
  },

  disableMenuItem: async (itemId: string) => {
    try {
      await api.updateMenuItem(itemId, { status: 'disabled' });
      await get().loadMenu();
    } catch (error) {
      console.error('Failed to disable menu item:', error);
    }
  },

  createNewRound: async () => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) return;
    if (get().actionLoading.createNewRound) return;

    set({ actionLoading: { ...get().actionLoading, createNewRound: true } });
    try {
      const newRound = await api.createRound(currentGroup.id, currentUser.id);
      await get().loadRounds();
      set({ currentRound: newRound, roundItems: [] });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ actionLoading: { ...get().actionLoading, createNewRound: false } });
    }
  },

  closeCurrentRound: async () => {
    const { currentRound, currentUser } = get();
    if (!currentRound || !currentUser) return;
    if (get().actionLoading.closeCurrentRound) return;

    set({ actionLoading: { ...get().actionLoading, closeCurrentRound: true } });
    try {
      // 关轮前：自动锁定本轮所有未锁定的共享条目
      const roundId = currentRound.id;
      const sharedInRound = get().allRoundItems.filter(
        (it) => it.roundId === roundId && !it.deleted && it.isShared && it.status !== 'locked'
      );
      for (const it of sharedInRound) {
        try {
          await get().lockRoundItem(it.id, { force: true });
        } catch (e) {
          console.warn('Failed to auto-lock shared item before closing round:', it.id, e);
        }
      }

      await api.closeRound(currentRound.id, currentUser.id);
      await get().loadRounds();
      await get().loadAllRoundItems();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ actionLoading: { ...get().actionLoading, closeCurrentRound: false } });
    }
  },

  addOrderItem: async (item) => {
    await get().addRoundItem(item);
  },

  addRoundItem: async (item) => {
    const { currentGroup, currentRound, currentUser } = get();
    if (!currentGroup || !currentRound || !currentUser) {
      throw new Error('无法添加订单');
    }

    const newItem = await api.addRoundItem({
      ...item,
      groupId: currentGroup.id,
      roundId: currentRound.id,
      userId: currentUser.id
    });

    set({ roundItems: [...get().roundItems, newItem] });
    await get().loadAllRoundItems();
    await get().clearCurrentRoundConfirmationIfNeeded();
    return newItem;
  },

  updateRoundItem: async (itemId: string, updates: Partial<RoundItem>) => {
    const { currentUser, currentRound, allRoundItems } = get();
    if (!currentUser) return;

    await api.updateRoundItem(itemId, currentUser.id, updates);

    const updatedItem = allRoundItems.find((it) => it.id === itemId);
    if (updatedItem && currentRound && updatedItem.roundId === currentRound.id) {
      await get().loadRoundItems(currentRound.id);
    }
    await get().loadAllRoundItems();
  },

  updateOrderItem: async (itemId: string, qty: number) => {
    try {
      await get().updateRoundItem(itemId, { qty });
      await get().clearCurrentRoundConfirmationIfNeeded();
    } catch (error) {
      console.error('Failed to update order item:', error);
      throw error;
    }
  },

  deleteOrderItem: async (itemId: string) => {
    const { currentUser } = get();
    if (!currentUser) return;

    try {
      await api.deleteRoundItem(itemId, currentUser.id);
      if (get().currentRound?.id) {
        await get().loadRoundItems(get().currentRound!.id);
      }
      await get().loadAllRoundItems();
      await get().clearCurrentRoundConfirmationIfNeeded();
    } catch (error) {
      console.error('Failed to delete order item:', error);
      throw error;
    }
  },

  createSharedItem: async (item) => {
    await get().addRoundItem({
      nameDisplay: item.nameDisplay,
      price: item.price,
      qty: item.qty,
      note: item.note,
      isShared: true,
      shareMode: item.shareMode,
      shares: item.shares ?? [],
      status: (item.shares?.length ?? 0) > 0 ? 'active' : 'pending',
      allowSelfJoin: item.allowSelfJoin ?? true,
      allowClaimUnits: item.allowClaimUnits ?? true
    });
  },

  joinSharedItem: async (itemId, options) => {
    const { currentUser, currentGroup, allRoundItems } = get();
    if (!currentUser || !currentGroup) throw new Error('未登录或未加入组');

    const item = allRoundItems.find((it) => it.id === itemId);
    if (!item || !item.isShared) throw new Error('共享条目不存在');
    if (item.status === 'locked') throw new Error('已锁定，无法修改');

    const isOwner = currentGroup.ownerId === currentUser.id;
    const isCreator = item.userId === currentUser.id;

    if (!isOwner && !isCreator) {
      if (item.shareMode === 'units') {
        if (item.allowClaimUnits === false) throw new Error('创建人未开放认领');
      } else {
        if (item.allowSelfJoin === false) throw new Error('创建人未开放自助加入');
      }
    }

    const shares = Array.isArray(item.shares) ? [...item.shares] : [];
    const existingIdx = shares.findIndex((s) => s.userId === currentUser.id);

    const upsert = (next: import('@/types').RoundItemShare | null) => {
      const nextShares = shares.filter((s) => s.userId !== currentUser.id);
      if (next) nextShares.push(next);
      return nextShares;
    };

    let nextShares = shares;
    if (item.shareMode === 'ratio') {
      const weight = Math.max(1, Math.floor(options?.weight ?? 1));
      const existing = existingIdx >= 0 ? shares[existingIdx] : undefined;
      nextShares = existing
        ? shares.map((s) => (s.userId === currentUser.id ? { ...s, weight } : s))
        : [...shares, { userId: currentUser.id, weight }];
    } else if (item.shareMode === 'units') {
      const totalUnits = Math.max(0, Math.floor(item.qty));
      const currentUnits = existingIdx >= 0 ? Math.max(0, Math.floor(shares[existingIdx].units ?? 0)) : 0;
      const requestUnits = Math.max(0, Math.floor(options?.units ?? 0));

      const used = shares.reduce((sum, s) => sum + Math.max(0, Math.floor(s.units ?? 0)), 0);
      const usedWithoutMe = used - currentUnits;
      if (requestUnits + usedWithoutMe > totalUnits) {
        const remaining = getSharedUnitsRemaining(item) ?? 0;
        throw new Error(tGlobal('shared.error.unitsInsufficient', { remaining }));
      }

      if (requestUnits === 0) {
        nextShares = upsert(null);
      } else {
        nextShares = upsert({ userId: currentUser.id, units: requestUnits });
      }
    } else {
      // equal
      if (existingIdx >= 0) return;
      nextShares = [...shares, { userId: currentUser.id }];
    }

    const nextStatus =
      nextShares.length === 0 ? 'pending' : (item.status === 'pending' || !item.status ? 'active' : item.status);

    await get().updateRoundItem(itemId, { shares: nextShares, status: nextStatus });
    await get().clearCurrentRoundConfirmationIfNeeded();
  },

  addParticipantsToSharedItem: async (itemId, userIds) => {
    const { currentUser, currentGroup, allRoundItems } = get();
    if (!currentUser || !currentGroup) throw new Error('未登录或未加入组');

    const item = allRoundItems.find((it) => it.id === itemId);
    if (!item || !item.isShared) throw new Error('共享条目不存在');
    if (item.status === 'locked') throw new Error('已锁定，无法修改');

    const canManage = currentGroup.ownerId === currentUser.id || item.userId === currentUser.id;
    if (!canManage) throw new Error('无权操作');

    if (item.shareMode === 'units') {
      throw new Error('按份数模式请由成员自行认领');
    }

    const shares = Array.isArray(item.shares) ? [...item.shares] : [];
    const existing = new Set(shares.map((s) => s.userId));
    const additions = userIds
      .filter((uid) => uid && !existing.has(uid))
      .map((uid) => (item.shareMode === 'ratio' ? { userId: uid, weight: 1 } : { userId: uid }));

    const nextShares = [...shares, ...additions];
    const nextStatus =
      nextShares.length === 0 ? 'pending' : (item.status === 'pending' || !item.status ? 'active' : item.status);

    await get().updateRoundItem(itemId, { shares: nextShares, status: nextStatus });
  },

  removeParticipantFromSharedItem: async (itemId, userId) => {
    const { currentUser, currentGroup, allRoundItems } = get();
    if (!currentUser || !currentGroup) throw new Error('未登录或未加入组');

    const item = allRoundItems.find((it) => it.id === itemId);
    if (!item || !item.isShared) throw new Error('共享条目不存在');
    if (item.status === 'locked') throw new Error('已锁定，无法修改');

    const canManage = currentGroup.ownerId === currentUser.id || item.userId === currentUser.id;
    if (!canManage) throw new Error('无权操作');

    const shares = Array.isArray(item.shares) ? item.shares : [];
    const nextShares = shares.filter((s) => s.userId !== userId);
    const nextStatus = nextShares.length === 0 ? 'pending' : (item.status === 'pending' || !item.status ? 'active' : item.status);
    await get().updateRoundItem(itemId, { shares: nextShares, status: nextStatus });
  },

  lockRoundItem: async (itemId, options) => {
    const { currentUser, currentGroup, allRoundItems } = get();
    if (!currentUser || !currentGroup) throw new Error('未登录或未加入组');

    const item = allRoundItems.find((it) => it.id === itemId);
    if (!item || !item.isShared) throw new Error('共享条目不存在');
    if (item.status === 'locked') return;

    const canManage = currentGroup.ownerId === currentUser.id || item.userId === currentUser.id;
    if (!canManage) throw new Error('无权操作');

    let nextShares = Array.isArray(item.shares) ? [...item.shares] : [];

    if (options?.force) {
      if (nextShares.length === 0) {
        nextShares = item.shareMode === 'units'
          ? [{ userId: item.userId, units: Math.max(0, Math.floor(item.qty)) }]
          : [{ userId: item.userId, weight: 1 }];
      }

      if (item.shareMode === 'units') {
        const remaining = getSharedUnitsRemaining({ ...item, shares: nextShares } as RoundItem);
        if (remaining && remaining > 0) {
          const idx = nextShares.findIndex((s) => s.userId === item.userId);
          if (idx >= 0) {
            nextShares[idx] = {
              ...nextShares[idx],
              units: Math.max(0, Math.floor(nextShares[idx].units ?? 0)) + remaining,
            };
          } else {
            nextShares.push({ userId: item.userId, units: remaining });
          }
        }
      }
    }

    let allocations: Array<{ userId: string; amountYen: number }>;
    try {
      allocations = computeSharedAllocations({ ...item, shares: nextShares }, { allowPartialUnits: false });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'UNITS_NOT_FULLY_CLAIMED') {
        throw new Error(tGlobal('shared.error.unitsNotFullyClaimed'));
      }
      throw e;
    }

    const amountMap = new Map(allocations.map((a) => [a.userId, a.amountYen]));
    nextShares = nextShares.map((s) => ({
      ...s,
      amountYen: amountMap.get(s.userId),
    }));

    await get().updateRoundItem(itemId, { shares: nextShares, status: 'locked' });
  },

  startCheckoutConfirmation: async () => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) return;
    if (get().actionLoading.startCheckoutConfirmation) return;

    set({ actionLoading: { ...get().actionLoading, startCheckoutConfirmation: true } });
    try {
      await api.startCheckoutConfirmation(currentGroup.id, currentUser.id);
      await get().loadGroup(currentGroup.id);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ actionLoading: { ...get().actionLoading, startCheckoutConfirmation: false } });
    }
  },

  confirmMemberOrder: async () => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) return;

    try {
      await api.confirmMemberOrder(currentGroup.id, currentUser.id);
      await get().loadGroup(currentGroup.id);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  finalizeCheckout: async (options) => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) return;
    if (get().actionLoading.finalizeCheckout) return;

    set({ actionLoading: { ...get().actionLoading, finalizeCheckout: true } });
    try {
      // 结账前：自动锁定所有未锁定共享条目（避免账单仍记在创建者名下/试算不稳定）
      const sharedToLock = get().allRoundItems.filter((it) => it.isShared && !it.deleted && it.status !== 'locked');
      for (const it of sharedToLock) {
        try {
          await get().lockRoundItem(it.id, { force: true });
        } catch (e) {
          console.warn('Failed to auto-lock shared item before checkout:', it.id, e);
        }
      }

      await api.finalizeCheckout(currentGroup.id, currentUser.id, options);
      await get().loadGroup(currentGroup.id);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ actionLoading: { ...get().actionLoading, finalizeCheckout: false } });
    }
  },

  confirmCurrentRound: async () => {
    const { currentGroup, currentRound, currentUser } = get();
    if (!currentGroup || !currentRound || !currentUser) return;
    if (get().actionLoading.confirmRound) return;

    set({ actionLoading: { ...get().actionLoading, confirmRound: true } });
    try {
      const { allConfirmed } = await api.confirmRoundSubmission(
        currentGroup.id,
        currentRound.id,
        currentUser.id
      );
      await get().loadGroup(currentGroup.id);

      if (allConfirmed) {
        // 锁定本轮共享条目
        const sharedToLock = get().allRoundItems.filter(
          (it) =>
            it.roundId === currentRound.id &&
            !it.deleted &&
            it.isShared &&
            it.status !== 'locked'
        );
        for (const it of sharedToLock) {
          try {
            await get().lockRoundItem(it.id, { force: true });
          } catch (e) {
            console.warn('Failed to auto-lock shared item before auto close:', it.id, e);
          }
        }

        // 自动关轮（允许成员触发）
        try {
          await api.closeRound(currentRound.id, currentUser.id, { allowMember: true });
        } catch (e) {
          console.warn('Failed to auto-close round:', e);
        }

        // 自动开启下一轮（允许成员触发）
        try {
          await api.createRound(currentGroup.id, currentUser.id, { allowMember: true });
        } catch (e) {
          console.warn('Failed to auto-create next round:', e);
        }

        await get().loadRounds();
        await get().loadAllRoundItems();
        await get().loadGroup(currentGroup.id);
      }
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ actionLoading: { ...get().actionLoading, confirmRound: false } });
    }
  },

  clearCurrentRoundConfirmationIfNeeded: async () => {
    const { currentGroup, currentRound, currentUser } = get();
    if (!currentGroup || !currentRound || !currentUser) return;

    const confirmations = currentRound.memberConfirmations || {};
    if (!confirmations[currentUser.id]) return;

    const members = currentGroup.members || [];
    const allConfirmed = members.length > 0 && members.every((m) => confirmations[m]);
    if (allConfirmed) return;

    try {
      await api.setRoundConfirmation(currentGroup.id, currentRound.id, currentUser.id, false);
      await get().loadRounds();
    } catch (error) {
      console.warn('Failed to clear round confirmation:', error);
    }
  },

  settleGroup: async () => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) return;

    try {
      const sharedToLock = get().allRoundItems.filter((it) => it.isShared && !it.deleted && it.status !== 'locked');
      for (const it of sharedToLock) {
        try {
          await get().lockRoundItem(it.id, { force: true });
        } catch (e) {
          console.warn('Failed to auto-lock shared item before settle:', it.id, e);
        }
      }

      await api.settleGroup(currentGroup.id, currentUser.id);
      await get().loadGroup(currentGroup.id);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  removeMember: async (memberId: string) => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) return;

    try {
      await api.removeMember(currentGroup.id, currentUser.id, memberId);
      // 重新加载所有数据
      await Promise.all([
        get().loadGroup(currentGroup.id),
        get().loadAllRoundItems()
      ]);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // 店铺历史菜单相关
  saveGroupAsRestaurantMenu: async (displayName: string) => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) {
      throw new Error('未登录或未加入组');
    }

    try {
      await api.saveGroupAsRestaurantMenu(currentGroup.id, currentUser.id, displayName);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  getUserRestaurantMenus: async () => {
    const { currentUser } = get();
    if (!currentUser) {
      throw new Error('未登录');
    }

    try {
      return await api.getUserRestaurantMenus(currentUser.id);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  importRestaurantMenuToGroup: async (restaurantMenuId: string) => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) {
      throw new Error('未登录或未加入组');
    }

    try {
      const result = await api.importRestaurantMenuToGroup(
        currentGroup.id,
        restaurantMenuId,
        currentUser.id
      );

      // 重新加载菜单
      await get().loadMenu();

      return result;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  reset: () => {
    set({
      currentUser: null,
      currentGroup: null,
      members: [],
      menu: [],
      rounds: [],
      currentRound: null,
      roundItems: [],
      allRoundItems: [],
      loading: false,
      error: null,
      actionLoading: {}
    });
  }
}));
