/**
 * Mock数据
 * 用于开发和演示，模拟多个用户点单的场景
 */

import { User, Group, GroupMenuItem, Round, RoundItem } from '@/types';

// Mock用户
export const mockUsers: User[] = [
  { id: 'U001', name: '小明', avatarUrl: undefined },
  { id: 'U002', name: '小红', avatarUrl: undefined },
  { id: 'U003', name: '小李', avatarUrl: undefined },
  { id: 'U004', name: '小张', avatarUrl: undefined },
];

// 当前登录用户ID（存储在localStorage）
export function getCurrentUserId(): string {
  let userId = localStorage.getItem('ordered_user_id');
  if (!userId) {
    userId = 'U001'; // 默认用户
    localStorage.setItem('ordered_user_id', userId);
  }
  return userId;
}

export function setCurrentUserId(userId: string): void {
  localStorage.setItem('ordered_user_id', userId);
}

export function getCurrentUser(): User {
  const userId = getCurrentUserId();
  return mockUsers.find(u => u.id === userId) || mockUsers[0];
}

// Mock组数据（这是演示用的默认组，实际使用时会创建新组）
export const mockGroup: Group = {
  id: 'GDEMO01',
  ownerId: 'U001',
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  settled: false,
  members: ['U001']
};

// Mock菜单（初始为空，用户自己添加）
export const mockMenu: GroupMenuItem[] = [];

// Mock轮次（创建组时会自动创建第一轮）
export const mockRounds: Round[] = [];

// Mock订单项（初始为空，用户开始点单后才有数据）
export const mockRoundItems: RoundItem[] = [];

