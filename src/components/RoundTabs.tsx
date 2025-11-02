/**
 * 轮次标签页组件
 * 展示：当前轮 / 历史轮 / 全部
 */

import React, { useMemo } from 'react';
import { Round, RoundItem } from '@/types';
import { formatMoney, calculateTotal } from '@/utils/money';
import { getRoundDisplayId } from '@/utils/format';
import { Trash2 } from 'lucide-react';

interface RoundTabsProps {
  rounds: Round[];
  allItems: RoundItem[];
  currentUserId: string;
  isOwner: boolean;
  onDeleteItem?: (itemId: string) => void;
}

type TabType = 'current' | 'history' | 'all';

export const RoundTabs: React.FC<RoundTabsProps> = ({
  rounds,
  allItems,
  currentUserId,
  onDeleteItem
}) => {
  const [activeTab, setActiveTab] = React.useState<TabType>('current');

  const currentRound = useMemo(() => 
    rounds.find(r => r.status === 'open'), 
    [rounds]
  );

  const historyRounds = useMemo(() => 
    rounds.filter(r => r.status === 'closed').sort((a, b) => 
      b.createdAt.localeCompare(a.createdAt)
    ), 
    [rounds]
  );

  // 当前用户当前轮的订单
  const currentRoundItems = useMemo(() => 
    currentRound 
      ? allItems.filter(item => 
          item.roundId === currentRound.id && 
          item.userId === currentUserId && 
          !item.deleted
        )
      : [],
    [currentRound, allItems, currentUserId]
  );

  // 当前用户历史轮的订单
  const historyItems = useMemo(() => 
    allItems.filter(item => 
      item.userId === currentUserId && 
      !item.deleted &&
      (currentRound ? item.roundId !== currentRound.id : true)
    ),
    [allItems, currentUserId, currentRound]
  );

  // 当前用户所有订单
  const allUserItems = useMemo(() => 
    allItems.filter(item => item.userId === currentUserId && !item.deleted),
    [allItems, currentUserId]
  );

  const tabs = [
    { id: 'current' as TabType, label: '当前轮', count: currentRoundItems.length },
    { id: 'history' as TabType, label: '历史轮', count: historyItems.length },
    { id: 'all' as TabType, label: '全部', count: allUserItems.length }
  ];

  const renderItems = (items: RoundItem[], showRoundId: boolean = false) => {
    if (items.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          暂无订单
        </div>
      );
    }

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

    const total = calculateTotal(items);

    return (
      <div>
        <div className="divide-y">
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
                      title="删除"
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
            <span className="font-medium text-gray-700">小计</span>
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
          暂无历史轮次
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {historyRounds.map(round => {
          const roundItems = allItems.filter(
            item => item.roundId === round.id && item.userId === currentUserId && !item.deleted
          );
          
          if (roundItems.length === 0) return null;

          // 按名称和价格合并相同名称的订单项（忽略备注差异）
          const mergedItems: Array<{
            nameDisplay: string;
            price: number;
            totalQty: number;
            notes: string[];
            totalPrice: number;
          }> = [];
          
          roundItems.forEach((item) => {
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
            } else {
              mergedItems.push({
                nameDisplay: item.nameDisplay,
                price: item.price,
                totalQty: item.qty,
                notes: item.note ? [item.note] : [],
                totalPrice: item.price * item.qty
              });
            }
          });

          const roundTotal = calculateTotal(roundItems);

          return (
            <div key={round.id} className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-200 flex justify-between items-center">
                <span className="font-medium text-gray-700">{getRoundDisplayId(round.id)}</span>
                <span className="text-sm text-gray-600">
                  {formatMoney(roundTotal)}
                </span>
              </div>
              <div className="divide-y bg-white">
                {mergedItems.map((merged, index) => (
                  <div key={`${merged.nameDisplay}-${merged.price}-${index}`} className="p-3">
                    <div className="flex justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{merged.nameDisplay}</h4>
                        {/* 显示所有不同的备注 */}
                        {merged.notes.length > 0 && (
                          <p className="text-sm text-gray-500">{merged.notes.join(' / ')}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {formatMoney(merged.price)} × {merged.totalQty}
                        </p>
                        <p className="font-medium text-gray-900">
                          {formatMoney(merged.totalPrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
    </div>
  );
};

