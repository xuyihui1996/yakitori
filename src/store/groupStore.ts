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

  // Actions
  setCurrentUser: (user: User) => void;
  createGroup: (ownerName: string) => Promise<{ group: Group; user: User }>;
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

  // 订单操作
  addOrderItem: (item: Omit<RoundItem, 'id' | 'createdAt' | 'groupId' | 'roundId' | 'userId'>) => Promise<void>;
  updateOrderItem: (itemId: string, qty: number) => Promise<void>;
  deleteOrderItem: (itemId: string) => Promise<void>;

  // 结账
  startCheckoutConfirmation: () => Promise<void>;
  confirmMemberOrder: () => Promise<void>;
  finalizeCheckout: () => Promise<void>;
  settleGroup: () => Promise<void>;

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

  setCurrentUser: (user) => {
    set({ currentUser: user });
  },

  createGroup: async (ownerName: string) => {
    set({ loading: true, error: null });
    try {
      const { group, user } = await api.createGroup(ownerName);
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

    try {
      const newRound = await api.createRound(currentGroup.id, currentUser.id);
      await get().loadRounds();
      set({ currentRound: newRound, roundItems: [] });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  closeCurrentRound: async () => {
    const { currentRound, currentUser } = get();
    if (!currentRound || !currentUser) return;

    try {
      await api.closeRound(currentRound.id, currentUser.id);
      await get().loadRounds();
      await get().loadAllRoundItems();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  addOrderItem: async (item) => {
    const { currentGroup, currentRound, currentUser } = get();
    if (!currentGroup || !currentRound || !currentUser) {
      throw new Error('无法添加订单');
    }

    try {
      const newItem = await api.addRoundItem({
        ...item,
        groupId: currentGroup.id,
        roundId: currentRound.id,
        userId: currentUser.id
      });

      set({ roundItems: [...get().roundItems, newItem] });
      await get().loadAllRoundItems();
    } catch (error) {
      throw error;
    }
  },

  updateOrderItem: async (itemId: string, qty: number) => {
    const { currentUser } = get();
    if (!currentUser) return;

    try {
      await api.updateRoundItem(itemId, currentUser.id, { qty });
      await get().loadRoundItems(get().currentRound?.id || '');
      await get().loadAllRoundItems();
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
      await get().loadRoundItems(get().currentRound?.id || '');
      await get().loadAllRoundItems();
    } catch (error) {
      console.error('Failed to delete order item:', error);
      throw error;
    }
  },

  startCheckoutConfirmation: async () => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) return;

    try {
      await api.startCheckoutConfirmation(currentGroup.id, currentUser.id);
      await get().loadGroup(currentGroup.id);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
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

  finalizeCheckout: async () => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) return;

    try {
      await api.finalizeCheckout(currentGroup.id, currentUser.id);
      await get().loadGroup(currentGroup.id);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  settleGroup: async () => {
    const { currentGroup, currentUser } = get();
    if (!currentGroup || !currentUser) return;

    try {
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
      error: null
    });
  }
}));

