/**
 * 数据模型定义
 * 按照产品需求文档定义的数据结构
 */

// 用户（轻量，因为只针对顾客）
export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
}

// 组 / 桌
export interface Group {
  id: string;              // 比如 G12345
  ownerId: string;         // 创建人
  createdAt: string;
  expiresAt: string;       // 1周后
  settled: boolean;        // 是否结账
  members: string[];       // userId 列表
  checkoutConfirming?: boolean; // 是否在结账确认中
  memberConfirmations?: Record<string, boolean>; // 成员确认状态 {userId: true/false}
}

// 组内的共享菜单项
export interface GroupMenuItem {
  id: string;
  groupId: string;
  nameDisplay: string;     // かわ
  price: number;           // 165
  note?: string;           // 中文名/解释
  status: 'active' | 'disabled';
  createdBy: string;       // userId
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;      // 价格修改人
}

// 轮次
export interface Round {
  id: string;              // R1, R2 ...
  groupId: string;
  status: 'open' | 'closed';
  createdBy: string;
  createdAt: string;
  closedAt?: string;
   memberConfirmations?: Record<string, boolean>;
}

// 某一轮里的具体点单记录
export type SharedStatus = 'pending' | 'active' | 'locked';
export type ShareMode = 'equal' | 'ratio' | 'units';

export interface RoundItemShare {
  userId: string;
  // ratio 模式：权重（整数）
  weight?: number;
  // units 模式：认领份数（整数）
  units?: number;
  // locked 后：该成员应付金额（日元，整数）
  amountYen?: number;
}

export interface RoundItem {
  id: string;
  groupId: string;
  roundId: string;
  userId: string;
  nameDisplay: string;
  price: number;
  qty: number;
  note?: string;
  createdAt: string;
  updatedAt?: string;
  deleted?: boolean;
  deletedBy?: string;
  menuItemId?: string;        // 关联的菜单项ID（用于统一改名）
  userNameSnapshot?: string;  // 结账时的用户昵称快照
  updatedBy?: string;         // 最后更新人

  // ============ 共享条目（混合式共享） ============
  // 说明：共享条目以“单条 RoundItem + shares 列表”表达，不为每个成员生成独立订单行
  isShared?: boolean;
  shareMode?: ShareMode;
  shares?: RoundItemShare[];
  status?: SharedStatus;
  allowSelfJoin?: boolean; // equal/ratio：允许成员自助加入
  allowClaimUnits?: boolean; // units：允许成员自助认领份数
}

// 菜单项冲突信息
export interface MenuConflict {
  exists: boolean;
  existingItem?: GroupMenuItem;
  conflictType?: 'price_mismatch';
  message?: string;
}

// 轮次汇总（用于展示）
export interface RoundSummary {
  roundId: string;
  items: RoundItem[];
  totalAmount: number;
  // 按菜名聚合的结果（用于给店家看）
  aggregatedItems: {
    nameDisplay: string;
    price: number;
    totalQty: number;
    note?: string;
  }[];
}

// 用户账单
export interface UserBill {
  userId: string;
  userName: string;
  rounds: {
    roundId: string;
    items: RoundItem[];
    roundTotal: number;
  }[];
  grandTotal: number;
}

// 整桌账单（Owner视图）
export interface GroupBill {
  groupId: string;
  rounds: RoundSummary[];
  grandTotal: number;
  memberBills: UserBill[];
}

// 合并后的订单项（用于结账确认）
export interface MergedOrderItem {
  nameDisplay: string;
  price: number;
  totalQty: number; // 所有轮次合并后的总数量
  notes: string[]; // 所有不同的备注
  originalItems: RoundItem[]; // 原始订单项（用于计算总数）
}

// Extra round 调整项
export interface ExtraRoundItem {
  id: string;
  groupId: string;
  roundId: string; // Extra round的ID
  userId: string;
  nameDisplay: string;
  price: number; // 不能修改单价
  qty: number; // 正数表示"多吃"，负数表示"未上"
  note?: string;
  createdAt: string;
}

// ============ 店铺历史菜单相关 ============

// 店铺菜单模板（本次聚餐生成的一份"全桌菜品列表"）
export interface RestaurantMenu {
  id: string;                 // 比如 "rm_xxx"
  createdFromGroupId: string; // 来源 group，方便溯源
  createdAt: string;
}

// 店铺菜单里的具体条目
export interface RestaurantMenuItem {
  id: string;
  restaurantMenuId: string;
  nameDisplay: string;        // 菜名（日文）
  price: number;              // 单价（整数，单位日元）
  note?: string;              // 备注（中文/说明）
}

// 用户与店铺菜单的关联
export interface UserRestaurantMenuLink {
  userId: string;
  restaurantMenuId: string;
  displayName: string;        // 用户起的"店名"（restaurant_mume）
  createdAt: string;
  lastUsedAt: string;         // 最近一次导入时间（LRU 用）
}
