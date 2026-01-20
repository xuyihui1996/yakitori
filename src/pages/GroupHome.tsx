/**
 * 组主页 - 核心点单界面
 * 展示当前桌号、轮次、菜单、我的订单等
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Receipt, PlayCircle, CheckCircle, BarChart3, X, UtensilsCrossed } from 'lucide-react';
import { useGroupStore } from '@/store/groupStore';
import { ItemInput } from '@/components/ItemInput';
import { MerchantMenu } from '@/components/MerchantMenu';
import { RoundTabs } from '@/components/RoundTabs';
import { OwnerSummary } from '@/components/OwnerSummary';
import { CheckoutConfirmModal } from '@/components/CheckoutConfirmModal';
import { SaveRestaurantMenuModal } from '@/components/SaveRestaurantMenuModal';
import { ImportRestaurantMenuModal } from '@/components/ImportRestaurantMenuModal';
import { SharedJoinBanner } from '@/components/SharedJoinBanner';
import { SharedItemCreator } from '@/components/SharedItemCreator';
import { getRoundDisplayId } from '@/utils/format';
import * as api from '@/api/supabaseService';
import { useI18n } from '@/i18n';
import { LanguageToggle } from '@/components/LanguageToggle';
import { calculateTotal, formatMoney } from '@/utils/money';
import { merchantMenu } from '@/data/merchantMenu';

export const GroupHome: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    currentUser,
    currentGroup,
    members,
    rounds,
    currentRound,
    allRoundItems,
    actionLoading,
    loadGroup,
    loadMenu,
    addMenuItem,
    updateMenuItemPrice,
    addOrderItem,
    deleteOrderItem,
    updateOrderItem,
    createSharedItem,
    joinSharedItem,
    addParticipantsToSharedItem,
    removeParticipantFromSharedItem,
    lockRoundItem,
    createNewRound,
    startCheckoutConfirmation,
    confirmMemberOrder,
    finalizeCheckout,
    removeMember,
    loadAllRoundItems,
    saveGroupAsRestaurantMenu,
    getUserRestaurantMenus,
    importRestaurantMenuToGroup,
    confirmCurrentRound,
    closeCurrentRound,
  } = useGroupStore();

  const [showItemInput, setShowItemInput] = useState(false);
  const [showSharedCreator, setShowSharedCreator] = useState(false);
  const [sharedCreatorInitialData, setSharedCreatorInitialData] = useState<{
    nameDisplay?: string;
    price?: number;
    qty?: number;
    note?: string;
  } | undefined>(undefined);
  const [showOwnerView, setShowOwnerView] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showSaveMenuModal, setShowSaveMenuModal] = useState(false);
  const [showImportMenuModal, setShowImportMenuModal] = useState(false);
  const [confirmModalRoundId, setConfirmModalRoundId] = useState<string | null>(null);
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
  const isCreatingRound = !!actionLoading.createNewRound;
  const isStartingCheckout = !!actionLoading.startCheckoutConfirmation;
  const isFinalizingCheckout = !!actionLoading.finalizeCheckout;
  const isClosingRound = !!actionLoading.closeCurrentRound;
  const isConfirmingRound = !!actionLoading.confirmRound;

  const startNewRoundGuardRef = React.useRef(false);
  const startCheckoutGuardRef = React.useRef(false);

  const ownerHintKey = currentGroup ? `owner_summary_hint_${currentGroup.id}` : '';
  const [showOwnerHint, setShowOwnerHint] = useState(() => {
    if (!ownerHintKey) return false;
    return localStorage.getItem(ownerHintKey) !== 'true';
  });

  const totals = React.useMemo(() => {
    const valid = allRoundItems.filter((it) => !it.deleted);
    const allTotal = calculateTotal(valid);
    const currentTotal = currentRound ? calculateTotal(valid.filter((it) => it.roundId === currentRound.id)) : 0;
    return { allTotal, currentTotal };
  }, [allRoundItems, currentRound]);

  const currentRoundSharedItems =
    currentRound && currentGroup && !currentGroup.settled
      ? allRoundItems.filter((it) => it.roundId === currentRound.id && !it.deleted && it.isShared)
      : [];

  const roundConfirmations = currentRound?.memberConfirmations || {};
  const confirmedCount = members.filter((m) => roundConfirmations[m.id]).length;
  const totalMembers = members.length;
  const allConfirmed = totalMembers > 0 && confirmedCount === totalMembers;
  const confirmedMembers = members.filter((m) => roundConfirmations[m.id]);
  const pendingMembers = members.filter((m) => !roundConfirmations[m.id]);

  const currentUserRoundItems = React.useMemo(() => {
    if (!currentRound || !currentUser) return [];
    return allRoundItems.filter(
      (it) =>
        it.roundId === currentRound.id &&
        it.userId === currentUser.id &&
        !it.deleted
    );
  }, [allRoundItems, currentRound, currentUser]);

  const currentUserRoundSummary = React.useMemo(() => {
    const map = new Map<string, { nameDisplay: string; price: number; qty: number }>();
    currentUserRoundItems.forEach((it) => {
      const key = `${it.nameDisplay}:${it.price}`;
      const existing = map.get(key);
      if (existing) {
        existing.qty += it.qty;
      } else {
        map.set(key, { nameDisplay: it.nameDisplay, price: it.price, qty: it.qty });
      }
    });
    return Array.from(map.values());
  }, [currentUserRoundItems]);

  const currentUserRoundTotal = React.useMemo(() => {
    return currentUserRoundSummary.reduce((sum, it) => sum + it.price * it.qty, 0);
  }, [currentUserRoundSummary]);

  useEffect(() => {
    if (confirmModalRoundId && currentRound?.id !== confirmModalRoundId) {
      setConfirmModalRoundId(null);
    }
  }, [confirmModalRoundId, currentRound?.id]);

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
        const message = t('home.priceConflictMessage', {
          creatorName,
          existingPrice: String(result.conflict.existingItem?.price ?? ''),
          inputPrice: String(price),
        });
        const useExisting = window.confirm(message);

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

  const handleStartNewRound = async () => {
    if (startNewRoundGuardRef.current) return;
    startNewRoundGuardRef.current = true;
    try {
      await createNewRound();
      alert(t('home.startNewRoundDone'));
    } catch (error) {
      alert((error as Error).message);
    } finally {
      startNewRoundGuardRef.current = false;
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
    if (startCheckoutGuardRef.current) return;
    startCheckoutGuardRef.current = true;
    if (!window.confirm(t('home.checkoutStartConfirm'))) {
      startCheckoutGuardRef.current = false;
      return;
    }

    try {
      await startCheckoutConfirmation();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      startCheckoutGuardRef.current = false;
    }
  };

  // Force start next round (for any member, if all confirmed)
  const handleForceNextRound = async () => {
    if (startNewRoundGuardRef.current) return;
    if (!currentGroup || !currentRound || !currentUser) return;

    if (!window.confirm(t('home.forceStartNextRoundConfirm'))) {
      return;
    }

    startNewRoundGuardRef.current = true;
    try {
      // 1. Close current round
      await closeCurrentRound();
      // 2. Start new round
      await createNewRound();
      alert(t('home.startNewRoundDone'));
    } catch (error) {
      alert((error as Error).message);
    } finally {
      startNewRoundGuardRef.current = false;
    }
  };

  // Owner finalized checkout
  const handleFinalizeCheckout = async () => {
    try {
      await finalizeCheckout();
      alert(t('home.checkoutFinalizeDone'));

      // Reload group data
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
      {/* 顶部状态栏 - Glassmorphism */}
      <div className="glass-nav sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-800">
                  {currentGroup.id}
                </h1>
                {currentGroup.settled && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold border border-gray-200 uppercase tracking-wide">
                    {t('home.settled')}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3 mt-0.5 text-xs text-slate-500 font-medium">
                <span className="flex items-center space-x-1">
                  <Users size={12} className="text-slate-400" />
                  <span>{members.length}</span>
                </span>
                {currentRound && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      {getRoundDisplayId(currentRound.id)}
                    </span>
                    <span className="flex items-center gap-1 text-green-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      {t('home.roundOpen')}
                    </span>
                  </>
                )}
                {!currentRound && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-500">{t('home.noActiveRound')}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center flex-nowrap shrink-0">
              <LanguageToggle className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-primary-600 transition-colors shrink-0" />
              <button
                onClick={() => navigate('/my-bill')}
                className="p-2 hover:bg-primary-50 text-slate-500 hover:text-primary-600 rounded-xl transition-colors shrink-0 relative group"
                title={t('home.myBill')}
              >
                <Receipt size={22} strokeWidth={1.5} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {t('home.myBill')}
                </span>
              </button>
              {isOwner && (
                <button
                  onClick={() => setShowOwnerView((v) => !v)}
                  className={`px-3 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 font-medium text-sm ${showOwnerView
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-200 hover:text-primary-600 hover:shadow-sm'
                    }`}
                  title={showOwnerView ? t('home.order') : t('home.summary')}
                  type="button"
                >
                  {showOwnerView ? <UtensilsCrossed size={18} /> : <BarChart3 size={18} />}
                  <span className="hidden sm:inline">{showOwnerView ? t('home.order') : t('home.summary')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Owner 一次性引导 */}
        {isOwner && !showOwnerView && showOwnerHint && !currentGroup.settled && (
          <div className="bg-white rounded-lg shadow-sm border p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{t('home.ownerHintTitle')}</p>
              <p className="text-sm text-gray-600 mt-1">{t('home.ownerHintBody')}</p>
            </div>
            <button
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              onClick={() => {
                setShowOwnerHint(false);
                if (ownerHintKey) localStorage.setItem(ownerHintKey, 'true');
              }}
              title={t('common.close')}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Summary View (Formerly Owner View) */}
        {showOwnerView && (
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

            {/* 管理员操作：仅 Owner 可见 */}
            {isOwner && (
              <div className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
                <h3 className="font-semibold text-gray-800 mb-3">{t('home.roundManage')}</h3>

                {!currentRound && !currentGroup.settled && (
                  <button
                    onClick={handleStartNewRound}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isCreatingRound || isClosingRound || isStartingCheckout || isFinalizingCheckout}
                  >
                    <PlayCircle size={20} />
                    <span>{isCreatingRound ? t('home.startNewRoundLoading') : t('home.startNewRound')}</span>
                  </button>
                )}

                {!currentGroup.settled && (
                  <>
                    {currentGroup.checkoutConfirming ? (
                      <button
                        onClick={handleFinalizeCheckout}
                        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isFinalizingCheckout || isStartingCheckout || isCreatingRound || isClosingRound}
                      >
                        <CheckCircle size={20} />
                        <span>{isFinalizingCheckout ? t('home.checkoutFinalizing') : t('home.checkoutFinalize')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStartCheckout}
                        className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isStartingCheckout || isFinalizingCheckout || isCreatingRound || isClosingRound}
                      >
                        <CheckCircle size={20} />
                        <span>{isStartingCheckout ? t('home.checkoutStarting') : t('home.checkoutStart')}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 普通点单视图 */}
        {!showOwnerView && (
          <>
            {/* Owner 快速汇总入口 -> 改为全员可见的 Group Bill 入口 */}
            {currentRound && !currentGroup.settled && (
              <button
                onClick={() => setShowOwnerView(true)}
                className="w-full text-left bg-white rounded-2xl shadow-sm border p-4 hover:bg-gray-50"
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">{t('home.summaryCardTitle')}</p>
                    <div className="mt-2 flex items-end gap-6">
                      <div>
                        <p className="text-xs text-gray-500">{t('home.summaryCardRoundTotal')}</p>
                        <p className="text-2xl font-bold text-gray-900">{t('money.yen')}{totals.currentTotal.toLocaleString('ja-JP')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('home.summaryCardAllTotal')}</p>
                        <p className="text-2xl font-bold text-primary-700">{t('money.yen')}{totals.allTotal.toLocaleString('ja-JP')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-primary-700 font-semibold">
                    <BarChart3 size={18} />
                    <span className="text-sm">{t('home.summaryCardCta')}</span>
                  </div>
                </div>
              </button>
            )}

            {/* 我的订单 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                {t('home.myOrder')}
              </h2>

              {/* 当前轮共享入口 */}
              {currentRound && currentRoundSharedItems.length > 0 && (
                <SharedJoinBanner
                  sharedItems={currentRoundSharedItems}
                  members={members}
                  currentUserId={currentUser.id}
                  isOwner={!!isOwner}
                  onJoin={async (itemId, options) => {
                    await joinSharedItem(itemId, options);
                  }}
                  onAddParticipants={async (itemId, userIds) => {
                    await addParticipantsToSharedItem(itemId, userIds);
                  }}
                  onLock={async (itemId) => {
                    await lockRoundItem(itemId);
                  }}
                />
              )}

              <RoundTabs
                rounds={rounds}
                allItems={allRoundItems}
                currentUserId={currentUser.id}
                isOwner={isOwner}
                members={members}
                onJoinSharedItem={async (itemId, options) => {
                  await joinSharedItem(itemId, options);
                }}
                onAddParticipantsToSharedItem={async (itemId, userIds) => {
                  await addParticipantsToSharedItem(itemId, userIds);
                }}
                onRemoveParticipantFromSharedItem={async (itemId, userId) => {
                  await removeParticipantFromSharedItem(itemId, userId);
                }}
                onLockSharedItem={async (itemId) => {
                  await lockRoundItem(itemId);
                }}
                onDeleteItem={deleteOrderItem}
              />
            </div>

            {/* 商家菜单式点单区 */}
            {!currentGroup.settled && currentRound && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {t('home.orderArea')}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSharedCreatorInitialData(undefined);
                        setShowSharedCreator(true);
                      }}
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-medium flex items-center space-x-2 shadow-lg shadow-slate-200 transition-all hover:scale-105 active:scale-95"
                    >
                      <Plus size={18} />
                      <span>{t('home.newShared')}</span>
                    </button>
                    <button
                      onClick={() => setShowItemInput(!showItemInput)}
                      className="px-4 py-2 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 font-medium flex items-center space-x-2 shadow-lg shadow-primary-500/30 transition-all hover:scale-105 active:scale-95"
                    >
                      <Plus size={18} />
                      <span>{t('home.newDish')}</span>
                    </button>
                  </div>
                </div>

                {showItemInput && (
                  <div className="mb-2">
                    <ItemInput
                      onSubmit={handleAddMenuItem}
                      onCancel={() => setShowItemInput(false)}
                    />
                  </div>
                )}

                <MerchantMenu
                  items={merchantMenu}
                  disabled={currentGroup.settled || !currentRound}
                  onAdd={async ({ nameDisplay, price, qty, note }) => {
                    if (!currentRound) return;
                    await addOrderItem({
                      nameDisplay,
                      price,
                      qty,
                      note
                    });
                  }}
                  onShare={(item) => {
                    setSharedCreatorInitialData(item);
                    setShowSharedCreator(true);
                  }}
                />

                <div className="sticky bottom-4 z-40">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentRound) setConfirmModalRoundId(currentRound.id);
                    }}
                    disabled={
                      currentGroup.settled ||
                      !currentRound ||
                      isConfirmingRound ||
                      allConfirmed
                    }
                    className="w-full mt-3 bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                  >
                    {isConfirmingRound
                      ? t('home.confirmRoundLoading')
                      : allConfirmed
                        ? t('home.confirmRoundDone')
                        : t('home.confirmRound')}
                    {!allConfirmed && (
                      <span className="ml-2 text-sm text-white/80">
                        {confirmedCount}/{totalMembers}
                      </span>
                    )}
                  </button>

                  {/* Allow any user to force start next round if ALL confirmed */}
                  {allConfirmed && !isConfirmingRound && (
                    <button
                      type="button"
                      onClick={handleForceNextRound}
                      className="w-full mt-3 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 shadow-md flex items-center justify-center gap-2"
                    >
                      <PlayCircle size={20} />
                      {t('home.forceStartNextRound')}
                    </button>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {t('home.confirmRoundHint')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('home.confirmRoundConfirmed', {
                      names: confirmedMembers.length > 0 ? confirmedMembers.map((m) => m.name).join('、') : '-'
                    })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('home.confirmRoundPending', {
                      names: pendingMembers.length > 0 ? pendingMembers.map((m) => m.name).join('、') : '-'
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* 无进行中轮次提示 */}
            {!currentRound && !currentGroup.settled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <p className="text-yellow-800 mb-2">
                  {isOwner
                    ? t('home.noRoundOwnerHint')
                    : t('home.noRoundMemberHint')}
                </p>
                {isOwner && (
                  <button
                    onClick={handleStartNewRound}
                    className="mt-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                  >
                    {t('home.startNewRound')}
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
                    {t('home.thanksTitle')}
                  </p>
                  <p className="text-green-700 text-sm mb-4">
                    {t('home.thanksSubtitle')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => navigate('/my-bill')}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      {t('home.gotoMyBill')}
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
                      {t('home.createOrJoinNew')}
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
                      {t('home.restartClearIdentity')}
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

      {/* 本轮下单确认弹窗 */}
      {confirmModalRoundId && currentRound && currentUser && confirmModalRoundId === currentRound.id && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('home.confirmRoundTitle')}
              </h3>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {currentUserRoundSummary.length === 0 ? (
                <p className="text-sm text-gray-500">{t('home.confirmRoundEmpty')}</p>
              ) : (
                <div className="space-y-2">
                  {currentUserRoundSummary.map((it) => (
                    <div key={`${it.nameDisplay}-${it.price}`} className="flex justify-between items-center">
                      <span className="text-gray-900">{it.nameDisplay}</span>
                      <span className="text-gray-600">× {it.qty}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-3 border-t flex justify-between items-center font-semibold">
                <span>{t('home.confirmRoundTotal')}</span>
                <span>{formatMoney(currentUserRoundTotal)}</span>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setConfirmModalRoundId(null)}
                disabled={isConfirmingRound}
              >
                {t('home.confirmRoundEdit')}
              </button>
              <button
                type="button"
                className="flex-1 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                disabled={isConfirmingRound}
                onClick={async () => {
                  try {
                    await confirmCurrentRound();
                    setConfirmModalRoundId(null);
                  } catch (error) {
                    alert((error as Error).message);
                  }
                }}
              >
                {isConfirmingRound ? t('home.confirmRoundLoading') : t('home.confirmRoundConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 保存为店铺菜单弹窗 */}
      {showSaveMenuModal && currentUser && currentGroup && (
        <SaveRestaurantMenuModal
          isOpen={showSaveMenuModal}
          onSave={async (displayName) => {
            try {
              await saveGroupAsRestaurantMenu(displayName);
              setShowSaveMenuModal(false);
              alert(t('saveMenu.success'));
            } catch (error) {
              alert(t('saveMenu.failed', { message: (error as Error).message }));
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

      {/* 新建共享条目抽屉 */}
      {showSharedCreator && currentUser && (
        <SharedItemCreator
          isOpen={showSharedCreator}
          members={members}
          onClose={() => setShowSharedCreator(false)}
          onCreate={async (data) => {
            if (!data.isShared) {
              if (currentRound) {
                await addOrderItem({
                  nameDisplay: data.nameDisplay,
                  price: data.price,
                  qty: data.qty,
                  note: data.note,
                });
              }
              return;
            }

            if (!data.shareMode) throw new Error(t('shared.error.chooseShareMode'));

            await createSharedItem({
              nameDisplay: data.nameDisplay,
              price: data.price,
              qty: data.qty,
              note: data.note,
              shareMode: data.shareMode,
              shares: data.shares,
              allowSelfJoin: data.allowSelfJoin,
              allowClaimUnits: data.allowClaimUnits,
            });
          }}
          initialValues={sharedCreatorInitialData}
        />
      )}
    </div>
  );
};
