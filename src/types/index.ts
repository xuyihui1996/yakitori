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
}

// 某一轮里的具体点单记录
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

