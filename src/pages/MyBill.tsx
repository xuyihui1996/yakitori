/**
 * 我的账单页面
 * 展示当前用户的所有订单和汇总
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { useGroupStore } from '@/store/groupStore';
import { getUserBill } from '@/api/supabaseService';
import { UserBill } from '@/types';
import { formatMoney } from '@/utils/money';
import { generateUserBillText, copyToClipboard } from '@/utils/export';
import { getRoundDisplayId } from '@/utils/format';
import { useI18n } from '@/i18n';
import { LanguageToggle } from '@/components/LanguageToggle';

export const MyBill: React.FC = () => {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { currentGroup, currentUser, rounds } = useGroupStore();
  const [bill, setBill] = useState<UserBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentGroup || !currentUser) {
      navigate('/');
      return;
    }

    loadBill();
  }, [currentGroup, currentUser]);

  const loadBill = async () => {
    if (!currentGroup || !currentUser) return;

    try {
      const userBill = await getUserBill(currentGroup.id, currentUser.id);
      setBill(userBill);
    } catch (error) {
      console.error('Failed to load bill:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!bill) return;

    const text = generateUserBillText(
      bill.userName,
      rounds,
      bill.rounds.flatMap(r => r.items),
      locale
    );

    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">{t('bill.loading')}</div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">{t('bill.empty')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部导航 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center space-x-4">
          <button
            onClick={() => navigate('/group')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{t('bill.title')}</h1>
            <p className="text-sm text-gray-500">
              {currentGroup?.id} · {bill.userName}
            </p>
          </div>
          <LanguageToggle className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2" />
          <button
            onClick={handleExport}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title={t('bill.export')}
          >
            {copied ? (
              <Check size={24} className="text-green-600" />
            ) : (
              <Copy size={24} />
            )}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 总金额卡片 */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-sm opacity-90 mb-2">{t('bill.total')}</p>
          <p className="text-4xl font-bold">{formatMoney(bill.grandTotal)}</p>
          <div className="mt-4 flex items-center space-x-4 text-sm opacity-90">
            <span>{t('bill.rounds', { n: bill.rounds.length })}</span>
            <span>·</span>
            <span>
              {t('bill.items', { n: bill.rounds.reduce((sum, r) => sum + r.items.length, 0) })}
            </span>
          </div>
        </div>

        {/* 按轮次展示 */}
        <div className="space-y-3">
          {bill.rounds
            .sort((a, b) => {
              const roundA = rounds.find(r => r.id === a.roundId);
              const roundB = rounds.find(r => r.id === b.roundId);
              return (roundA?.createdAt || '').localeCompare(roundB?.createdAt || '');
            })
            .map((roundBill) => {
              const round = rounds.find(r => r.id === roundBill.roundId);
              
              if (roundBill.items.length === 0) return null;

              return (
                <div key={roundBill.roundId} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  {/* 轮次头部 */}
                  <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {getRoundDisplayId(roundBill.roundId)}
                      </span>
                      {round && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          round.status === 'open'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {round.status === 'open' ? t('owner.roundOpen') : t('owner.roundClosed')}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-primary-600">
                      {formatMoney(roundBill.roundTotal)}
                    </span>
                  </div>

                  {/* 订单项 - 按名称合并，备注不同的合并显示 */}
                  <div className="divide-y">
                    {(() => {
                      // 按名称合并相同名称的订单项（忽略备注差异）
                      const mergedItems: Array<{
                        nameDisplay: string;
                        price: number;
                        totalQty: number;
                        notes: string[]; // 收集所有不同的备注
                        totalPrice: number;
                      }> = [];
                      
                      roundBill.items.forEach((item) => {
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
                      
                      return mergedItems.map((merged, index) => (
                        <div key={`${merged.nameDisplay}-${merged.price}-${index}`} className="px-4 py-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {merged.nameDisplay}
                              </h4>
                              {/* 显示所有不同的备注 */}
                              {merged.notes.length > 0 && (
                                <p className="text-sm text-gray-500 mt-0.5">
                                  {merged.notes.join(' / ')}
                                </p>
                              )}
                              <p className="text-sm text-gray-600 mt-1">
                                {formatMoney(merged.price)} × {merged.totalQty}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                {formatMoney(merged.totalPrice)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              );
            })}
        </div>

        {/* 空状态 */}
        {bill.rounds.every(r => r.items.length === 0) && (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <p className="text-gray-500">{t('bill.emptyOrder')}</p>
            <button
              onClick={() => navigate('/group')}
              className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {t('bill.gotoOrder')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
