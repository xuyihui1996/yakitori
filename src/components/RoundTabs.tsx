/**
 * 轮次标签页组件
 * 展示：当前轮 / 历史轮 / 全部
 */

import React, { useMemo } from 'react';
import { Round, RoundItem, User } from '@/types';
import { formatMoney, calculateTotal } from '@/utils/money';
import { getRoundDisplayId } from '@/utils/format';
import { Info, Trash2, X } from 'lucide-react';
import { SharedItemDetail } from '@/components/SharedItemDetail';
import { getSharedItemTotalYen, getUserOwedYenForRoundItem } from '@/utils/split';
import { useI18n } from '@/i18n';

interface RoundTabsProps {
  rounds: Round[];
  allItems: RoundItem[];
  currentUserId: string;
  isOwner: boolean;
  members: User[];
  onJoinSharedItem: (itemId: string, options?: { weight?: number; units?: number }) => Promise<void>;
  onAddParticipantsToSharedItem: (itemId: string, userIds: string[]) => Promise<void>;
  onRemoveParticipantFromSharedItem: (itemId: string, userId: string) => Promise<void>;
  onLockSharedItem: (itemId: string) => Promise<void>;
  onDeleteItem?: (itemId: string) => void;
}

type TabType = 'current' | 'history' | 'all';

export const RoundTabs: React.FC<RoundTabsProps> = ({
  rounds,
  allItems,
  currentUserId,
  isOwner,
  members,
  onJoinSharedItem,
  onAddParticipantsToSharedItem,
  onRemoveParticipantFromSharedItem,
  onLockSharedItem,
  onDeleteItem,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = React.useState<TabType>('current');
  const [detailItemId, setDetailItemId] = React.useState<string | null>(null);
  const [explain, setExplain] = React.useState<{ title: string; body: string } | null>(null);

  const currentRound = useMemo(() => 
    rounds.find(r => r.status === 'open'), 
    [rounds]
  );

  const isVisibleToUser = (item: RoundItem) => {
    if (item.deleted) return false;
    if (item.isShared) {
      return (item.shares ?? []).some((s) => s.userId === currentUserId);
    }
    return item.userId === currentUserId;
  };

  const historyRounds = useMemo(() => 
    rounds.filter(r => r.status === 'closed').sort((a, b) => 
      b.createdAt.localeCompare(a.createdAt)
    ), 
    [rounds]
  );

  // 当前用户当前轮的订单
  const currentRoundItems = useMemo(() => 
    currentRound 
      ? allItems.filter(item => item.roundId === currentRound.id && isVisibleToUser(item))
      : [],
    [currentRound, allItems, currentUserId]
  );

  // 当前用户历史轮的订单
  const historyItems = useMemo(() => 
    allItems.filter(item =>
      isVisibleToUser(item) &&
      (currentRound ? item.roundId !== currentRound.id : true)
    ),
    [allItems, currentUserId, currentRound]
  );

  // 当前用户所有订单
  const allUserItems = useMemo(() => 
    allItems.filter(item => isVisibleToUser(item)),
    [allItems, currentUserId]
  );

  const tabs = [
    { id: 'current' as TabType, label: t('roundTabs.current'), count: currentRoundItems.length },
    { id: 'history' as TabType, label: t('roundTabs.history'), count: historyItems.length },
    { id: 'all' as TabType, label: t('roundTabs.all'), count: allUserItems.length }
  ];

  const renderItems = (items: RoundItem[], showRoundId: boolean = false) => {
    if (items.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          {t('roundTabs.empty')}
        </div>
      );
    }

    const memberMap = new Map(members.map((m) => [m.id, m]));

    const sharedItems = items.filter((i) => i.isShared);
    const normalItems = items.filter((i) => !i.isShared);

    // 按名称和价格合并相同名称的订单项（忽略备注差异）
    const mergedItems: Array<{
      nameDisplay: string;
      price: number;
      totalQty: number;
      notes: string[];
      totalPrice: number;
      items: RoundItem[]; // 保存原始items，用于操作按钮
    }> = [];
    
    items.forEach((item) => {
      const existing = mergedItems.find(
        m => m.nameDisplay === item.nameDisplay && m.price === item.price
      );
      
      if (existing) {
        existing.totalQty += item.qty;
        existing.totalPrice += item.price * item.qty;
        // 添加备注（如果存在且不重复）
        if (item.note && !existing.notes.includes(item.note)) {
          existing.notes.push(item.note);
        }
        existing.items.push(item);
      } else {
        mergedItems.push({
          nameDisplay: item.nameDisplay,
          price: item.price,
          totalQty: item.qty,
          notes: item.note ? [item.note] : [],
          totalPrice: item.price * item.qty,
      items: [item]
        });
      }
    });

    const total =
      calculateTotal(normalItems) +
      sharedItems.reduce((sum, it) => sum + getUserOwedYenForRoundItem(it, currentUserId), 0);

    return (
      <div>
        <div className="divide-y">
          {/* 共享条目（不合并） */}
          {sharedItems.map((it) => {
            const totalYen = getSharedItemTotalYen(it);
            const myOwed = getUserOwedYenForRoundItem(it, currentUserId);
            const joined = (it.shares ?? []).map((s) => memberMap.get(s.userId)).filter(Boolean) as User[];
            const statusText =
              it.status === 'locked'
                ? t('roundTabs.status.locked')
                : it.status === 'active'
                  ? t('roundTabs.status.active')
                  : t('roundTabs.status.pending');
            return (
              <button
                key={it.id}
                onClick={() => setDetailItemId(it.id)}
                className="w-full text-left p-3 hover:bg-gray-50"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 truncate">{it.nameDisplay}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                        {t('roundTabs.sharedBadge')}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                        {statusText}
                      </span>
                      {showRoundId && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                          {it.roundId}
                        </span>
                      )}
                    </div>
                    {it.note && <p className="text-sm text-gray-500 mt-0.5">{it.note}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {joined.slice(0, 6).map((m) => (
                          <div
                            key={m.id}
                            className="w-6 h-6 rounded-full bg-primary-600 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white"
                            title={m.name}
                          >
                            {m.name.trim().slice(0, 2)}
                          </div>
                        ))}
                        {joined.length > 6 && (
                          <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold flex items-center justify-center border-2 border-white">
                            +{joined.length - 6}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{formatMoney(totalYen)}</p>
                        <button
                          type="button"
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 justify-end"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExplain({
                              title: t('roundTabs.myOwedExplainTitle'),
                              body:
                                it.status === 'locked'
                                  ? t('roundTabs.myOwedExplainLocked')
                                  : t('roundTabs.myOwedExplainTrial'),
                            });
                          }}
                        >
                          <Info size={12} />
                          {t('roundTabs.myOwed')} {formatMoney(myOwed)}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {mergedItems.map((merged, index) => {
            // 如果合并后有多个原始items，且是当前轮，需要特殊处理操作按钮
            const canEdit = currentRound && merged.items.some(item => item.roundId === currentRound.id);
            const firstItem = merged.items[0];
            
            return (
              <div key={`${merged.nameDisplay}-${merged.price}-${index}`} className="p-3 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900">
                        {merged.nameDisplay}
                      </h4>
                      {showRoundId && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                          {firstItem.roundId}
                        </span>
                      )}
                    </div>
                    {/* 显示所有不同的备注 */}
                    {merged.notes.length > 0 && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {merged.notes.join(' / ')}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 mt-1">
                      {formatMoney(merged.price)} × {merged.totalQty} = {formatMoney(merged.totalPrice)}
                    </p>
                  </div>
                  
                  {/* 删除按钮：当前轮可删除，删除第一个item */}
                  {canEdit && onDeleteItem && merged.items.length > 0 && (
                    <button
                      onClick={() => onDeleteItem(merged.items[0].id)}
                      className="ml-2 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* 小计 */}
        <div className="p-4 bg-gray-50 border-t">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700">{t('roundTabs.subtotal')}</span>
            <span className="text-xl font-bold text-primary-600">
              {formatMoney(total)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryByRounds = () => {
    if (historyRounds.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          {t('roundTabs.history')}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {historyRounds.map(round => {
          const roundItems = allItems.filter((item) => item.roundId === round.id && isVisibleToUser(item));
          
          if (roundItems.length === 0) return null;

          return (
            <div key={round.id} className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-200 flex justify-between items-center">
                <span className="font-medium text-gray-700">{getRoundDisplayId(round.id)}</span>
                <span className="text-xs text-gray-600">{t('roundTabs.history')}</span>
              </div>
              <div className="bg-white">{renderItems(roundItems)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* 标签页头部 */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? 'bg-white/20'
                  : 'bg-gray-200'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 标签页内容 */}
      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'current' && renderItems(currentRoundItems)}
        {activeTab === 'history' && renderHistoryByRounds()}
        {activeTab === 'all' && renderItems(allUserItems, true)}
      </div>

      {/* 共享条目详情 */}
      <SharedItemDetail
        isOpen={!!detailItemId}
        item={detailItemId ? allItems.find((i) => i.id === detailItemId) || null : null}
        members={members}
        currentUserId={currentUserId}
        isOwner={isOwner}
        onClose={() => setDetailItemId(null)}
        onJoinOrUpdateMyShare={onJoinSharedItem}
        onAddParticipants={onAddParticipantsToSharedItem}
        onRemoveParticipant={onRemoveParticipantFromSharedItem}
        onLock={onLockSharedItem}
      />

      {/* 我的应付解释弹窗 */}
      {explain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setExplain(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">{explain.title}</h4>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setExplain(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 text-sm text-gray-700 whitespace-pre-line">{explain.body}</div>
            <div className="p-4 border-t">
              <button className="w-full py-3 rounded-lg bg-primary-600 text-white font-semibold" onClick={() => setExplain(null)}>
                {t('common.done')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
