/**
 * Owner汇总视图组件
 * 显示整桌的订单汇总、按轮次分组、导出文本等
 */

import React, { useMemo, useState } from 'react';
import { Round, RoundItem, User, Group } from '@/types';
import { formatMoney, calculateTotal } from '@/utils/money';
import { generateFullExportText, copyToClipboard, aggregateItemsByName } from '@/utils/export';
import { getRoundDisplayId } from '@/utils/format';
import { Copy, Check, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { getUserOwedYenForRoundItem } from '@/utils/split';
import { useI18n } from '@/i18n';

interface OwnerSummaryProps {
  rounds: Round[];
  allItems: RoundItem[];
  members: User[];
  groupId: string;
  currentGroup?: Group;
  currentUserId?: string;
  onRemoveMember?: (memberId: string) => Promise<void>;
}

export const OwnerSummary: React.FC<OwnerSummaryProps> = ({
  rounds,
  allItems,
  members,
  groupId,
  currentGroup,
  currentUserId,
  onRemoveMember
}) => {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());

  // 按轮次分组
  const roundSummaries = useMemo(() => {
    return rounds
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(round => {
        const items = allItems.filter(item => item.roundId === round.id && !item.deleted);
        const aggregated = aggregateItemsByName(items, locale);
        const total = calculateTotal(items);

        return {
          round,
          items,
          aggregated,
          total
        };
      });
  }, [rounds, allItems, locale]);

  // 全部汇总
  const totalSummary = useMemo(() => {
    const validItems = allItems.filter(item => !item.deleted);
    const aggregated = aggregateItemsByName(validItems, locale);
    const total = calculateTotal(validItems);

    return { aggregated, total };
  }, [allItems, locale]);

  // 按人汇总
  const memberSummaries = useMemo(() => {
    return members.map(member => {
      const memberNormalItems = allItems.filter(
        item => item.userId === member.id && !item.deleted && !item.isShared
      );
      const sharedOwed = allItems
        .filter(item => item.isShared && !item.deleted)
        .reduce((sum, item) => sum + getUserOwedYenForRoundItem(item, member.id), 0);

      const total = calculateTotal(memberNormalItems) + sharedOwed;

      return {
        member,
        itemCount:
          memberNormalItems.length +
          allItems.filter(item => item.isShared && !item.deleted && (item.shares || []).some(s => s.userId === member.id)).length,
        total
      };
    }).sort((a, b) => b.total - a.total);
  }, [members, allItems]);

  const handleExport = async () => {
    const text = generateFullExportText(rounds, allItems, groupId, locale);
    const success = await copyToClipboard(text);

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert('复制失败，请手动复制');
    }
  };

  const toggleRound = (roundId: string) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(roundId)) {
      newExpanded.delete(roundId);
    } else {
      newExpanded.add(roundId);
    }
    setExpandedRounds(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* 导出按钮 */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <button
          onClick={handleExport}
          className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center justify-center space-x-2"
        >
          {copied ? (
            <>
              <Check size={20} />
              <span>{t('owner.exportCopied')}</span>
            </>
          ) : (
            <>
              <Copy size={20} />
              <span>{t('owner.exportAll')}</span>
            </>
          )}
        </button>
      </div>

      {/* 总览 */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('owner.overview')}</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary-600">
              {rounds.length}
            </p>
            <p className="text-sm text-gray-600">{t('bill.rounds', { n: rounds.length })}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-600">
              {allItems.filter(item => !item.deleted).length}
            </p>
            <p className="text-sm text-gray-600">{t('bill.items', { n: allItems.filter(item => !item.deleted).length })}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-600">
              {formatMoney(totalSummary.total)}
            </p>
            <p className="text-sm text-gray-600">{t('export.total')}</p>
          </div>
        </div>
      </div>

      {/* 按人汇总 */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('owner.memberSpend')}</h3>
        <div className="space-y-2">
          {memberSummaries.map(({ member, itemCount, total }) => {
            const isOwner = currentGroup?.ownerId === currentUserId;
            const isCurrentUser = member.id === currentUserId;
            const canRemove = isOwner && !isCurrentUser && !currentGroup?.settled && onRemoveMember;

            return (
              <div key={member.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-2 flex-1">
                  <div>
                    <span className="font-medium text-gray-900">{member.name}</span>
                    <span className="ml-2 text-sm text-gray-500">({t('bill.items', { n: itemCount })})</span>
                  </div>
                  {canRemove && (
                    <button
                      onClick={async () => {
                        if (window.confirm(t('owner.removeMemberConfirm', { name: member.name }))) {
                          try {
                            await onRemoveMember(member.id);
                          } catch (error) {
                            alert((error as Error).message);
                          }
                        }
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title={t('owner.removeMember')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <span className="font-semibold text-primary-600">
                  {formatMoney(total)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 按轮次汇总 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">{t('owner.roundDetail')}</h3>
        </div>
        <div className="divide-y">
          {roundSummaries.map(({ round, aggregated, total }) => {
            const isExpanded = expandedRounds.has(round.id);

            return (
              <div key={round.id}>
                <button
                  onClick={() => toggleRound(round.id)}
                  className="w-full p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-gray-900">{getRoundDisplayId(round.id)}</span>
                    <span className={`text-xs px-2 py-1 rounded ${round.status === 'open'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                      {round.status === 'open' ? t('owner.roundOpen') : t('owner.roundClosed')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-primary-600">
                      {formatMoney(total)}
                    </span>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 bg-gray-50">
                    <div className="space-y-2">
                      {aggregated.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <div>
                            <span className="text-gray-900">{item.nameDisplay}</span>
                            {item.note && (
                              <span className="text-gray-500 ml-2">({item.note})</span>
                            )}
                          </div>
                          <span className="text-gray-600">
                            {formatMoney(item.price)} × {item.totalQty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 全部菜品汇总 */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('owner.allItems')}</h3>
        <div className="space-y-2">
          {totalSummary.aggregated.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
              <div>
                <span className="font-medium text-gray-900">{item.nameDisplay}</span>
                {item.note && (
                  <span className="text-sm text-gray-500 ml-2">({item.note})</span>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  {formatMoney(item.price)} × {item.totalQty}
                </p>
                <p className="font-semibold text-primary-600">
                  {formatMoney(item.price * item.totalQty)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-800">{t('owner.total')}</span>
          <span className="text-2xl font-bold text-primary-600">
            {formatMoney(totalSummary.total)}
          </span>
        </div>
      </div>
    </div>
  );
};
