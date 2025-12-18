/**
 * 菜单选择器组件
 * 展示共享菜单，允许快速点单
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Info, Power, PowerOff, Plus, Minus, StopCircle, Edit2, X, Check } from 'lucide-react';
import { GroupMenuItem, User, RoundItem } from '@/types';
import { formatMoney } from '@/utils/money';
import { useI18n } from '@/i18n';

interface MenuPickerProps {
  menu: GroupMenuItem[];
  members: User[];
  currentUserId: string;
  currentRoundItems: RoundItem[]; // 当前轮当前用户的订单项
  onSelect: (item: GroupMenuItem, qty: number) => void;
  onUpdateItemQty?: (itemId: string, newQty: number) => void;
  onDeleteItem?: (itemId: string) => void;
  disabled?: boolean;
  isOwner?: boolean;
  onToggleItemStatus?: (itemId: string, currentStatus: 'active' | 'disabled') => void;
  onUpdateItemName?: (menuItemId: string, newName: string) => Promise<void>;
  onCloseRound?: () => void;
  hasCurrentRound?: boolean;
  isSettled?: boolean;
}

export const MenuPicker: React.FC<MenuPickerProps> = ({
  menu,
  members,
  currentUserId,
  currentRoundItems,
  onSelect,
  onUpdateItemQty,
  onDeleteItem,
  disabled = false,
  isOwner = false,
  onToggleItemStatus,
  onUpdateItemName,
  onCloseRound,
  hasCurrentRound = false,
  isSettled = false
}) => {
  const { t } = useI18n();
  const [searchText, setSearchText] = useState('');
  // 本地管理的数量状态（菜单项ID -> 数量）
  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>({});
  // 编辑状态（菜单项ID -> 编辑中的新名称）
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [renaming, setRenaming] = useState(false);

  // 处理保存改名
  const handleSaveName = async (itemId: string) => {
    if (!onUpdateItemName || !editingName.trim()) {
      setEditingItemId(null);
      setEditingName('');
      return;
    }

    const trimmedName = editingName.trim();
    if (trimmedName === menu.find(m => m.id === itemId)?.nameDisplay) {
      // 名称未改变，直接取消编辑
      setEditingItemId(null);
      setEditingName('');
      return;
    }

    setRenaming(true);
    try {
      await onUpdateItemName(itemId, trimmedName);
      setEditingItemId(null);
      setEditingName('');
    } catch (error: any) {
      if (error.status === 409) {
        // 菜名冲突
        const existingItem = error.existingItem;
        alert(t('menu.renameConflict', { name: existingItem?.nameDisplay || '', price: existingItem?.price || '' }));
      } else if (error.status === 403) {
        alert(error.message || t('menu.renameSettled'));
      } else {
        alert(error.message || t('menu.renameFailed'));
      }
    } finally {
      setRenaming(false);
    }
  };

  // 初始化本地数量：从当前订单计算
  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    
    menu.forEach(menuItem => {
      const matchingItems = currentRoundItems.filter(
        orderItem => 
          orderItem.nameDisplay === menuItem.nameDisplay &&
          orderItem.price === menuItem.price &&
          orderItem.userId === currentUserId &&
          !orderItem.deleted
      );
      
      if (matchingItems.length > 0) {
        const totalQty = matchingItems.reduce((sum, item) => sum + item.qty, 0);
        initialQuantities[menuItem.id] = totalQty;
      } else {
        initialQuantities[menuItem.id] = 0;
      }
    });
    
    setLocalQuantities(initialQuantities);
  }, [menu, currentRoundItems, currentUserId]); // 只在菜单或订单变化时重新计算

  // 过滤菜单
  const filteredMenu = useMemo(() => {
    if (!searchText.trim()) return menu;
    
    const search = searchText.toLowerCase();
    return menu.filter(item => 
      item.nameDisplay.toLowerCase().includes(search) ||
      item.note?.toLowerCase().includes(search)
    );
  }, [menu, searchText]);

  // 获取某个菜单项的本地数量
  const getItemQty = (menuItemId: string): number => {
    return localQuantities[menuItemId] || 0;
  };

  // 增加数量（仅更新本地状态）
  const handleIncrease = (item: GroupMenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.status === 'disabled' || disabled) return;
    
    const currentQty = getItemQty(item.id);
    setLocalQuantities({ ...localQuantities, [item.id]: currentQty + 1 });
  };

  // 减少数量（仅更新本地状态）
  const handleDecrease = (item: GroupMenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.status === 'disabled' || disabled) return;
    
    const currentQty = getItemQty(item.id);
    if (currentQty > 0) {
      setLocalQuantities({ ...localQuantities, [item.id]: currentQty - 1 });
    }
  };

  // 确认改动：应用所有本地改动到订单
  const handleConfirmChanges = async () => {
    if (disabled) {
      // 如果已禁用（轮次关闭），直接返回，不显示错误
      return;
    }

    try {
      // 遍历所有菜单项，应用改动
      for (const menuItem of menu) {
        const localQty = getItemQty(menuItem.id);
        
        // 找到当前订单中该菜单项的数量
        const matchingItems = currentRoundItems.filter(
          orderItem => 
            orderItem.nameDisplay === menuItem.nameDisplay &&
            orderItem.price === menuItem.price &&
            orderItem.userId === currentUserId &&
            !orderItem.deleted
        );
        const currentQty = matchingItems.reduce((sum, item) => sum + item.qty, 0);
        
        const diff = localQty - currentQty;
        
        if (diff > 0) {
          // 需要增加：添加新订单项
          for (let i = 0; i < diff; i++) {
            try {
              await onSelect(menuItem, 1);
            } catch (error) {
              // 如果是因为轮次关闭导致的错误，只显示一次提示并停止处理
              const errorMessage = (error as Error).message;
              if (errorMessage.includes('轮次已关闭') || errorMessage.includes('无法添加订单')) {
                alert(errorMessage);
                return; // 直接返回，不再处理后续项
              }
              // 其他错误继续抛出
              throw error;
            }
          }
        } else if (diff < 0) {
          // 需要减少：更新或删除现有订单项
          const toRemove = Math.abs(diff);
          let remainingToRemove = toRemove;
          
          // 按顺序处理订单项，直到满足减少数量
          for (const orderItem of matchingItems) {
            if (remainingToRemove <= 0) break;
            
            if (orderItem.qty > remainingToRemove && onUpdateItemQty) {
              // 这个订单项的数量足够减少，只需要减少部分数量
              try {
                await onUpdateItemQty(orderItem.id, orderItem.qty - remainingToRemove);
              } catch (error) {
                const errorMessage = (error as Error).message;
                if (errorMessage.includes('轮次已关闭') || errorMessage.includes('无法添加订单')) {
                  alert(errorMessage);
                  return;
                }
                throw error;
              }
              remainingToRemove = 0;
            } else {
              // 这个订单项的数量不够或正好，删除整个订单项
              const itemQtyToRemove = orderItem.qty;
              if (onDeleteItem) {
                try {
                  await onDeleteItem(orderItem.id);
                } catch (error) {
                  const errorMessage = (error as Error).message;
                  if (errorMessage.includes('轮次已关闭') || errorMessage.includes('无法添加订单')) {
                    alert(errorMessage);
                    return;
                  }
                  throw error;
                }
              }
              remainingToRemove -= itemQtyToRemove;
            }
          }
        }
        // diff === 0 时不需要改动
      }
      
      // 重新计算完成，无需 pendingChanges
      
    } catch (error) {
      console.error('Failed to apply changes:', error);
      const errorMessage = (error as Error).message;
      // 如果错误信息中不包含轮次关闭的提示，才显示通用错误
      if (!errorMessage.includes('轮次已关闭') && !errorMessage.includes('无法添加订单')) {
        alert(t('menu.applyFailed', { message: errorMessage }));
      }
    }
  };

  // 检查是否有改动待确认
  const hasPendingChanges = useMemo(() => {
    return menu.some(menuItem => {
      const localQty = getItemQty(menuItem.id);
      const matchingItems = currentRoundItems.filter(
        orderItem => 
          orderItem.nameDisplay === menuItem.nameDisplay &&
          orderItem.price === menuItem.price &&
          orderItem.userId === currentUserId &&
          !orderItem.deleted
      );
      const currentQty = matchingItems.reduce((sum, item) => sum + item.qty, 0);
      return localQty !== currentQty;
    });
  }, [menu, localQuantities, currentRoundItems, currentUserId]);

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* 搜索框 */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('menu.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* 菜单列表 */}
      <div className="max-h-96 overflow-y-auto">
        {filteredMenu.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchText ? t('menu.noMatch') : t('menu.empty')}
          </div>
        ) : (
          <div className="divide-y">
            {filteredMenu.map((item) => {
              const itemQty = getItemQty(item.id);
              
              return (
                <div
                  key={item.id}
                  className={`p-3 transition-colors ${
                    item.status === 'disabled' || disabled
                      ? 'opacity-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {editingItemId === item.id ? (
                          <div className="flex items-center space-x-2 flex-1">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveName(item.id);
                                } else if (e.key === 'Escape') {
                                  setEditingItemId(null);
                                  setEditingName('');
                                }
                              }}
                              className="flex-1 px-2 py-1 border border-primary-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                              autoFocus
                              disabled={renaming}
                            />
                            <button
                              onClick={() => handleSaveName(item.id)}
                              disabled={renaming}
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              title={t('common.save')}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingItemId(null);
                                setEditingName('');
                              }}
                              disabled={renaming}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded disabled:opacity-50"
                              title={t('common.cancel')}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-medium text-gray-900">{item.nameDisplay}</h4>
                            {/* 改名按钮（全员可见，但已结账时禁用） */}
                            {!isSettled && onUpdateItemName && item.status === 'active' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItemId(item.id);
                                  setEditingName(item.nameDisplay);
                                }}
                                className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                title={t('menu.rename')}
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {item.status === 'disabled' && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                {t('menu.disabled')}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {item.note && (
                        <p className="text-sm text-gray-500 mt-0.5">{item.note}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {t('menu.addedBy', { name: members.find(m => m.id === item.createdBy)?.name || item.createdBy })}
                      </p>
                      
                      {/* 数量加减按钮：放在每条item下方 */}
                      {!disabled && item.status !== 'disabled' && (
                        <div className="flex items-center space-x-3 mt-2">
                          <button
                            onClick={(e) => handleDecrease(item, e)}
                            disabled={itemQty <= 0}
                            className="flex items-center justify-center w-8 h-8 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={t('menu.decrease')}
                          >
                            <Minus size={16} className="text-gray-600" />
                          </button>
                          <span className="text-sm font-medium text-gray-700 min-w-[2rem] text-center">
                            {itemQty}
                          </span>
                          <button
                            onClick={(e) => handleIncrease(item, e)}
                            className="flex items-center justify-center w-8 h-8 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                            title={t('menu.increase')}
                          >
                            <Plus size={16} className="text-gray-600" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <p className="font-semibold text-primary-600">
                          {formatMoney(item.price)}
                        </p>
                      </div>
                      {/* Owner停售/启用按钮 */}
                      {isOwner && onToggleItemStatus && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleItemStatus(item.id, item.status);
                          }}
                          className={`p-2 rounded-lg transition-colors ${
                            item.status === 'disabled'
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                          title={item.status === 'disabled' ? t('menu.enable') : t('menu.disable')}
                        >
                          {item.status === 'disabled' ? (
                            <Power size={18} />
                          ) : (
                            <PowerOff size={18} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 确认改动按钮 */}
      {!disabled && hasPendingChanges && (
        <div className="p-3 border-t bg-primary-50">
          <button
            onClick={handleConfirmChanges}
            className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
          >
            {t('menu.confirmChanges')}
          </button>
        </div>
      )}

      {/* 结束当前轮次按钮 */}
      {onCloseRound && hasCurrentRound && !isSettled && (
        <div className="p-3 border-t">
          <button
            onClick={onCloseRound}
            className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center space-x-2"
          >
            <StopCircle size={20} />
            <span>{t('menu.endRound')}</span>
          </button>
        </div>
      )}

      {/* 提示信息 */}
      {disabled && (
        <div className="p-3 border-t bg-yellow-50 flex items-start space-x-2">
          <Info size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-700">
            {t('menu.roundClosedOrNoPermission')}
          </p>
        </div>
      )}
    </div>
  );
};
