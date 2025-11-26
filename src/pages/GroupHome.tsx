/**
 * 组主页 - 核心点单界面
 * 展示当前桌号、轮次、菜单、我的订单等
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Receipt, Settings, PlayCircle, CheckCircle } from 'lucide-react';
import { useGroupStore } from '@/store/groupStore';
import { ItemInput } from '@/components/ItemInput';
import { MenuPicker } from '@/components/MenuPicker';
import { RoundTabs } from '@/components/RoundTabs';
import { OwnerSummary } from '@/components/OwnerSummary';
import { CheckoutConfirmModal } from '@/components/CheckoutConfirmModal';
import { SaveRestaurantMenuModal } from '@/components/SaveRestaurantMenuModal';
import { ImportRestaurantMenuModal } from '@/components/ImportRestaurantMenuModal';
import { GroupMenuItem } from '@/types';
import { getRoundDisplayId } from '@/utils/format';
import * as api from '@/api/supabaseService';

export const GroupHome: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    currentGroup,
    members,
    menu,
    rounds,
    currentRound,
    allRoundItems,
    loadGroup,
    loadMenu,
    addMenuItem,
    updateMenuItemPrice,
    updateMenuItemName,
    addOrderItem,
    deleteOrderItem,
    updateOrderItem,
    createNewRound,
    closeCurrentRound,
    startCheckoutConfirmation,
    confirmMemberOrder,
    finalizeCheckout,
    removeMember,
    loadRounds,
    loadAllRoundItems,
    saveGroupAsRestaurantMenu,
    getUserRestaurantMenus,
    importRestaurantMenuToGroup
  } = useGroupStore();

  const [showItemInput, setShowItemInput] = useState(false);
  const [showOwnerView, setShowOwnerView] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showSaveMenuModal, setShowSaveMenuModal] = useState(false);
  const [showImportMenuModal, setShowImportMenuModal] = useState(false);
  const [restaurantMenus, setRestaurantMenus] = useState<Array<{
    link: import('@/types').UserRestaurantMenuLink;
    menu: import('@/types').RestaurantMenu;
    items: import('@/types').RestaurantMenuItem[];
  }>>([]);

  // 加载组数据
  useEffect(() => {
    const groupId = localStorage.getItem('ordered_group_id');
    
    // 如果有组ID但没有加载组信息，尝试加载
    if (groupId && !currentGroup) {
      loadGroup(groupId).catch(() => {
        // 如果加载失败，可能是组不存在或已过期
        console.warn('Failed to load group, redirecting to home');
        navigate('/');
      });
      return;
    }

    // 如果有组ID且有组信息，但组ID不匹配，重新加载
    if (groupId && currentGroup && currentGroup.id !== groupId) {
      loadGroup(groupId);
      return;
    }

    // 如果既没有组ID也没有组信息，跳转到首页
    if (!groupId && !currentGroup) {
      navigate('/');
      return;
    }

    // 如果已加载组，刷新数据
    if (currentGroup && groupId) {
      loadGroup(groupId);
    }
  }, []);

  // 检查是否需要显示导入历史菜单弹窗（仅 Owner 且首次进入）
  useEffect(() => {
    const checkAndShowImportMenu = async () => {
      // 只在以下条件满足时显示：
      // 1. 是 Owner
      // 2. 有当前组
      // 3. 组未结账
      // 4. 还没有显示过导入弹窗（使用 localStorage 记录）
      if (!currentUser || !currentGroup) {
        return;
      }
      
      const isOwner = currentUser.id === currentGroup.ownerId;
      if (!isOwner) {
        return;
      }
      
      if (currentGroup.settled) {
        return;
      }
      
      // 检查是否已经显示过导入弹窗（使用 groupId 作为 key）
      const importMenuKey = `import_menu_shown_${currentGroup.id}`;
      const hasShown = localStorage.getItem(importMenuKey);
      if (hasShown) {
        return;
      }
      
      try {
        const menus = await getUserRestaurantMenus();
        if (menus.length > 0) {
          setRestaurantMenus(menus);
          setShowImportMenuModal(true);
          // 标记已显示过（即使用户跳过，也记录）
          localStorage.setItem(importMenuKey, 'true');
        }
      } catch (error) {
        console.error('获取历史菜单失败:', error);
        // 不影响正常流程
      }
    };

    // 等待组和用户数据加载完成后再检查
    if (currentGroup && currentUser) {
      // 延迟一点，确保数据已经加载
      const timer = setTimeout(() => {
        checkAndShowImportMenu();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentGroup?.id, currentUser?.id, currentGroup?.ownerId, currentGroup?.settled, getUserRestaurantMenus]);

  const isOwner = currentUser?.id === currentGroup?.ownerId;

  // 处理添加菜品
  const handleAddMenuItem = async (item: {
    nameDisplay: string;
    price: number;
    qty: number;
    note?: string;
  }) => {
    const { nameDisplay, price, qty, note } = item;

    const result = await addMenuItem({
      nameDisplay,
      price,
      note,
      status: 'active'
    });

    if (!result.success && result.conflict) {
      // 处理冲突
      if (result.conflict.conflictType === 'price_mismatch') {
        // 获取创建者用户名
        const creatorId = result.conflict.existingItem?.createdBy || '';
        const creator = members.find(m => m.id === creatorId);
        const creatorName = creator?.name || creatorId;
        
        // 显示更友好的对话框
        const message = `本菜由「${creatorName}」录入，价格为 ¥${result.conflict.existingItem?.price}，与您输入的 ¥${price} 不同。\n\n请选择：\n1. 使用现有价格 ¥${result.conflict.existingItem?.price}\n2. 更新为新价格 ¥${price}`;
        
        const useExisting = window.confirm(message + '\n\n点击"确定"=使用现有价格，点击"取消"=更新为新价格');
        
        if (useExisting) {
          // 使用现有价格，不添加新项，直接使用现有项添加订单
          const finalPrice = result.conflict.existingItem?.price || price;
          if (currentRound && result.conflict.existingItem) {
            await addOrderItem({
              nameDisplay,
              price: finalPrice,
              qty,
              note: note || result.conflict.existingItem.note
            });
          }
          setShowItemInput(false);
          return;
        } else {
          // 用户选择更新价格
          // 先更新菜单和订单的价格
          await updateMenuItemPrice(nameDisplay, price);
          
          // 等待一下确保数据同步
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 使用更新后的价格添加订单
          if (currentRound) {
            await addOrderItem({
              nameDisplay,
              price, // 使用新价格
              qty,
              note
            });
          }
          setShowItemInput(false);
          return;
        }
      } else {
        // 完全相同的菜品已存在，直接使用现有项添加订单
        if (result.conflict.existingItem && currentRound) {
          await addOrderItem({
            nameDisplay,
            price: result.conflict.existingItem.price,
            qty,
            note: note || result.conflict.existingItem.note
          });
        }
        setShowItemInput(false);
        return;
      }
    }

    // 没有冲突，正常添加菜品和订单
    if (currentRound) {
      await addOrderItem({
        nameDisplay,
        price,
        qty,
        note
      });
    }

    setShowItemInput(false);
  };

  // 从菜单选择并添加到订单
  const handleSelectFromMenu = async (menuItem: GroupMenuItem, qty: number) => {
    if (!currentRound) {
      // 不显示 alert，直接返回（因为 disabled 状态已经提示了）
      return;
    }

    // 检查轮次状态
    if (currentRound.status !== 'open') {
      // 轮次已关闭，不显示 alert（避免重复提示），直接返回
      return;
    }

    try {
      await addOrderItem({
        nameDisplay: menuItem.nameDisplay,
        price: menuItem.price,
        qty,
        note: menuItem.note
      });
    } catch (error) {
      // 错误已经在 API 层处理，这里不再重复显示 alert
      // 避免在 handleConfirmChanges 的循环中重复弹出
      throw error; // 重新抛出，让调用方决定是否显示错误
    }
  };

  // 处理轮次操作
  const handleCloseRound = async () => {
    if (!window.confirm('确认要关闭当前轮次吗？关闭后将生成本轮清单。')) {
      return;
    }

    try {
      await closeCurrentRound();
      alert('当前轮次已关闭');
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleStartNewRound = async () => {
    try {
      await createNewRound();
      alert('新轮次已开启');
    } catch (error) {
      alert((error as Error).message);
    }
  };

  // 检查是否需要显示确认弹窗
  useEffect(() => {
    if (currentGroup?.checkoutConfirming && currentUser) {
      // 检查当前用户是否已确认
      const isConfirmed = currentGroup.memberConfirmations?.[currentUser.id] || false;
      if (!isConfirmed) {
        setShowCheckoutConfirm(true);
      }
    } else {
      setShowCheckoutConfirm(false);
    }
  }, [currentGroup?.checkoutConfirming, currentGroup?.memberConfirmations, currentUser]);

  // Owner开始结账确认流程
  const handleStartCheckout = async () => {
    if (!window.confirm('确认要结账吗？所有成员需要确认订单后才能最终结账。')) {
      return;
    }

    try {
      await startCheckoutConfirmation();
      // 重新加载数据
      await loadRounds();
      await loadAllRoundItems();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  // Owner最终确认结账
  const handleFinalizeCheckout = async () => {
    try {
      await finalizeCheckout();
      alert('结账完成！');
      
      // 重新加载组数据
      if (currentGroup) {
        await loadGroup(currentGroup.id);
      }
      
      // 显示保存菜单弹窗（只显示一次，使用 localStorage 记录）
      if (currentGroup && currentUser) {
        const saveMenuKey = `save_menu_${currentGroup.id}_${currentUser.id}`;
        const hasShown = localStorage.getItem(saveMenuKey);
        if (!hasShown) {
          setShowSaveMenuModal(true);
          localStorage.setItem(saveMenuKey, 'true');
        }
      }
    } catch (error) {
      alert((error as Error).message);
    }
  };

  // 成员确认订单
  const handleConfirmOrder = async () => {
    try {
      await confirmMemberOrder();
      setShowCheckoutConfirm(false);
      // 重新加载数据
      await loadAllRoundItems();
      await loadGroup(currentGroup!.id);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  // 获取Extra round的订单项
  const extraRoundId = currentGroup ? `${currentGroup.id}_Extra` : '';
  const extraRoundItems = allRoundItems.filter(
    item => item.roundId === extraRoundId && item.userId === currentUser?.id && !item.deleted
  );

  // 获取正常轮次的订单项（不包括Extra round）
  const normalRoundItems = allRoundItems.filter(
    item => item.roundId !== extraRoundId && item.userId === currentUser?.id && !item.deleted
  );

  // 添加Extra round调整项
  const handleAddExtraItem = async (nameDisplay: string, price: number, qty: number) => {
    if (!currentGroup || !currentUser) return;
    
    try {
      // 直接调用API添加Extra round订单项
      await api.addRoundItem({
        groupId: currentGroup.id,
        roundId: extraRoundId,
        userId: currentUser.id,
        nameDisplay,
        price,
        qty,
        note: qty > 0 ? '多吃' : '未上'
      });
      await loadAllRoundItems();
    } catch (error) {
      throw error;
    }
  };

  // 更新Extra round调整项
  const handleUpdateExtraItem = async (itemId: string, qty: number) => {
    try {
      await updateOrderItem(itemId, qty);
    } catch (error) {
      throw error;
    }
  };

  // 删除Extra round调整项
  const handleDeleteExtraItem = async (itemId: string) => {
    try {
      await deleteOrderItem(itemId);
    } catch (error) {
      throw error;
    }
  };

  if (!currentGroup || !currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部状态栏 */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white sticky top-0 z-20 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold">{currentGroup.id}</h1>
                {currentGroup.settled && (
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">
                    已结账
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3 mt-1 text-sm opacity-90">
                <span className="flex items-center space-x-1">
                  <Users size={14} />
                  <span>{members.length} 人</span>
                </span>
                {currentRound && (
                  <>
                    <span>·</span>
                    <span>{getRoundDisplayId(currentRound.id)}</span>
                    <span className="px-2 py-0.5 bg-green-400 text-white rounded text-xs">
                      进行中
                    </span>
                  </>
                )}
                {!currentRound && (
                  <>
                    <span>·</span>
                    <span className="text-yellow-200">无进行中的轮次</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => navigate('/my-bill')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="我的账单"
              >
                <Receipt size={24} />
              </button>
              {isOwner && (
                <button
                  onClick={() => setShowOwnerView(!showOwnerView)}
                  className={`p-2 rounded-lg transition-colors ${
                    showOwnerView ? 'bg-white/20' : 'hover:bg-white/10'
                  }`}
                  title="管理员视图"
                >
                  <Settings size={24} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Owner视图 */}
        {isOwner && showOwnerView && (
          <div className="space-y-4">
            <OwnerSummary
              rounds={rounds}
              allItems={allRoundItems}
              members={members}
              groupId={currentGroup.id}
              currentGroup={currentGroup}
              currentUserId={currentUser.id}
              onRemoveMember={removeMember}
            />

            {/* 管理员操作 */}
            <div className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
              <h3 className="font-semibold text-gray-800 mb-3">轮次管理</h3>
              
              {!currentRound && !currentGroup.settled && (
                <button
                  onClick={handleStartNewRound}
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center space-x-2"
                >
                  <PlayCircle size={20} />
                  <span>开启新轮次</span>
                </button>
              )}

              {!currentGroup.settled && (
                <>
                  {currentGroup.checkoutConfirming ? (
                    <button
                      onClick={handleFinalizeCheckout}
                      className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center space-x-2"
                    >
                      <CheckCircle size={20} />
                      <span>最终确认结账</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartCheckout}
                      className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center justify-center space-x-2"
                    >
                      <CheckCircle size={20} />
                      <span>开始结账</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 普通点单视图 */}
        {(!isOwner || !showOwnerView) && (
          <>
            {/* 我的订单 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                我的订单
              </h2>
              <RoundTabs
                rounds={rounds}
                allItems={allRoundItems}
                currentUserId={currentUser.id}
                isOwner={isOwner}
                onDeleteItem={deleteOrderItem}
              />
            </div>

            {/* 添加菜品 */}
            {!currentGroup.settled && currentRound && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-semibold text-gray-800">
                    点单区
                  </h2>
                  <button
                    onClick={() => setShowItemInput(!showItemInput)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center space-x-2"
                  >
                    <Plus size={18} />
                    <span>新建菜品</span>
                  </button>
                </div>

                {showItemInput && (
                  <div className="mb-4">
                    <ItemInput
                      onSubmit={handleAddMenuItem}
                      onCancel={() => setShowItemInput(false)}
                    />
                  </div>
                )}

                {/* 菜单选择器 */}
                <MenuPicker
                  menu={menu}
                  members={members}
                  currentUserId={currentUser.id}
                  currentRoundItems={allRoundItems.filter(
                    item => 
                      item.roundId === currentRound.id && 
                      item.userId === currentUser.id && 
                      !item.deleted
                  )}
                  onSelect={handleSelectFromMenu}
                  onUpdateItemQty={async (itemId, newQty) => {
                    await updateOrderItem(itemId, newQty);
                  }}
                  onDeleteItem={async (itemId) => {
                    await deleteOrderItem(itemId);
                  }}
                  disabled={currentGroup.settled || !currentRound}
                  isOwner={isOwner}
                  onToggleItemStatus={async (itemId, currentStatus) => {
                    if (currentStatus === 'disabled') {
                      // 启用
                      await api.updateMenuItem(itemId, { status: 'active' });
                    } else {
                      // 停售
                      await api.updateMenuItem(itemId, { status: 'disabled' });
                    }
                    await loadMenu();
                  }}
                  onUpdateItemName={async (menuItemId, newName) => {
                    await updateMenuItemName(menuItemId, newName);
                  }}
                  onCloseRound={isOwner && currentRound && !currentGroup.settled ? handleCloseRound : undefined}
                  hasCurrentRound={!!currentRound}
                  isSettled={currentGroup.settled}
                />
              </div>
            )}

            {/* 无进行中轮次提示 */}
            {!currentRound && !currentGroup.settled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <p className="text-yellow-800 mb-2">
                  {isOwner 
                    ? '当前没有进行中的轮次，请开启新轮次开始点单'
                    : '当前没有进行中的轮次，请等待管理员开启'}
                </p>
                {isOwner && (
                  <button
                    onClick={handleStartNewRound}
                    className="mt-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                  >
                    开启新轮次
                  </button>
                )}
              </div>
            )}

            {/* 已结账提示 */}
            {currentGroup.settled && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <CheckCircle size={48} className="mx-auto text-green-600 mb-3" />
                  <p className="text-green-800 text-lg font-medium mb-2">
                    已完成结账
                  </p>
                  <p className="text-green-700 text-sm mb-4">
                    感谢使用 Ordered，下次再见！
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => navigate('/my-bill')}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      查看我的账单
                    </button>
                    <button
                      onClick={() => {
                        // 清除当前组信息，允许创建或加入新桌
                        localStorage.removeItem('ordered_group_id');
                        // 保留用户ID，下次可以自动恢复用户身份
                        navigate('/');
                      }}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                    >
                      创建新桌 / 加入新桌
                    </button>
                    <button
                      onClick={() => {
                        // 完全清除，重新开始（清除用户和组）
                        localStorage.removeItem('ordered_user_id');
                        localStorage.removeItem('ordered_group_id');
                        window.location.href = '/';
                      }}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                    >
                      重新开始（清除身份）
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 结账确认弹窗 */}
      {showCheckoutConfirm && currentUser && currentGroup && (
        <CheckoutConfirmModal
          isOpen={showCheckoutConfirm}
          onClose={() => setShowCheckoutConfirm(false)}
          onConfirm={handleConfirmOrder}
          userName={currentUser.name}
          allItems={normalRoundItems}
          extraRoundItems={extraRoundItems}
          onAddExtraItem={handleAddExtraItem}
          onUpdateExtraItem={handleUpdateExtraItem}
          onDeleteExtraItem={handleDeleteExtraItem}
          disabled={currentGroup.settled}
        />
      )}

      {/* 保存为店铺菜单弹窗 */}
      {showSaveMenuModal && currentUser && currentGroup && (
        <SaveRestaurantMenuModal
          isOpen={showSaveMenuModal}
          onSave={async (displayName) => {
            try {
              await saveGroupAsRestaurantMenu(displayName);
              setShowSaveMenuModal(false);
              alert('店铺菜单保存成功！');
            } catch (error) {
              alert('保存失败：' + (error as Error).message);
            }
          }}
          onSkip={() => setShowSaveMenuModal(false)}
        />
      )}

      {/* 导入历史菜单弹窗 */}
      {showImportMenuModal && currentGroup && currentUser && restaurantMenus.length > 0 && (
        <ImportRestaurantMenuModal
          isOpen={showImportMenuModal}
          menus={restaurantMenus}
          onImport={async (restaurantMenuId) => {
            const result = await importRestaurantMenuToGroup(restaurantMenuId);
            // 重新加载菜单
            await loadMenu();
            return result;
          }}
          onSkip={() => setShowImportMenuModal(false)}
        />
      )}
    </div>
  );
};

