import React, { useEffect, useState, useMemo } from 'react';
import { useGroupStore } from '@/store/groupStore';
import { useMerchantStore } from '@/store/merchantStore';
import { merchantMenu } from '@/data/merchantMenu';
import { useI18n } from '@/i18n';
import { Ban, X } from 'lucide-react';

export const MerchantDashboard: React.FC = () => {
    const {
        groups,
        loadAllGroups,
        allRounds,
        loadAllRounds,
        allRoundItems,
        loadAllRoundItems,
        reviewRound,
        settleGroupById
    } = useGroupStore();
    const { toggleSoldOut, isSoldOut } = useMerchantStore();
    const { locale } = useI18n();
    const [activeTab, setActiveTab] = useState<'tables' | 'menu'>('tables');

    // Modal States
    const [confirmRoundId, setConfirmRoundId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<'confirm' | 'reject' | null>(null);
    const [settleGroupId, setSettleGroupId] = useState<string | null>(null);

    useEffect(() => {
        // Initial load
        const loadData = async () => {
            await Promise.all([
                loadAllGroups(),
                loadAllRounds(),
                loadAllRoundItems()
            ]);
        };
        loadData();

        // Poll for updates (in a real app, use subscriptions)
        const interval = setInterval(() => {
            loadData();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Filter groups that are not settled (Active Tables)
    const activeGroups = groups.filter(g => !g.settled);

    // Find pending rounds (Global)
    const pendingRounds = useMemo(() =>
        allRounds?.filter(r => r.reviewStatus === 'pending') || []
        , [allRounds]);

    // Helpers for Modal Data
    const getRoundItems = (roundId: string) =>
        allRoundItems.filter(item => item.roundId === roundId && !item.deleted);

    const getGroupTotal = (groupId: string) => {
        const groupItems = allRoundItems.filter(item =>
            item.groupId === groupId &&
            !item.deleted &&
            // Include items from confirmed rounds.
            // For simplicity in this MVP, we sum all non-deleted items for the group.
            true
        );
        return groupItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    };

    const handleReviewClick = (roundId: string, action: 'confirm' | 'reject') => {
        setConfirmRoundId(roundId);
        setConfirmAction(action);
    };

    const confirmReview = async () => {
        if (!confirmRoundId || !confirmAction) return;
        try {
            await reviewRound(confirmRoundId, confirmAction);
            setConfirmRoundId(null);
            setConfirmAction(null);
        } catch (error) {
            alert('操作失敗 / Operation failed');
        }
    };

    const handleSettleClick = (groupId: string) => {
        setSettleGroupId(groupId);
    };

    const confirmSettle = async () => {
        if (!settleGroupId) return;
        try {
            await settleGroupById(settleGroupId);
            setSettleGroupId(null);
        } catch (error) {
            alert('会計失敗 / Settlement failed');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">店舗管理画面 (Merchant) <span className="text-sm font-normal text-gray-500 bg-gray-200 px-2 py-1 rounded">v1.6</span></h1>
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('tables')}
                        className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'tables' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                    >
                        テーブル管理
                    </button>
                    <button
                        onClick={() => setActiveTab('menu')}
                        className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'menu' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                    >
                        メニュー管理
                    </button>
                </div>
            </header>

            {/* Modals */}
            {confirmRoundId && confirmAction && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900">
                                {confirmAction === 'confirm' ? '注文確認' : '注文拒否'}
                            </h3>
                            <button onClick={() => setConfirmRoundId(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-60 overflow-y-auto">
                            {getRoundItems(confirmRoundId).map((item, idx) => (
                                <div key={item.id || idx} className="flex justify-between py-2 border-b border-gray-200 last:border-0">
                                    <span className="font-medium text-gray-800">{item.nameDisplay}</span>
                                    <span className="font-bold text-gray-900">x{item.qty}</span>
                                </div>
                            ))}
                            {getRoundItems(confirmRoundId).length === 0 && (
                                <p className="text-gray-500 text-center py-2">商品なし (Loading...)</p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmRoundId(null)}
                                className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={confirmReview}
                                className={`flex-1 py-3 rounded-lg text-white font-bold ${confirmAction === 'confirm' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                    }`}
                            >
                                {confirmAction === 'confirm' ? '確定する' : '拒否する'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {settleGroupId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900">お会計確認</h3>
                            <button onClick={() => setSettleGroupId(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="text-center py-6">
                            <p className="text-gray-500 mb-2">合計金額</p>
                            <p className="text-4xl font-bold text-blue-600">
                                ¥{getGroupTotal(settleGroupId).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-400 mt-2">
                                ※ この操作を行うと、テーブルはアーカイブされます。
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setSettleGroupId(null)}
                                className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={confirmSettle}
                                className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700"
                            >
                                会計完了
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tables' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Active Tables */}
                    {activeGroups.map(group => {
                        const groupPendingRounds = pendingRounds.filter(r => r.groupId === group.id);
                        const status = groupPendingRounds.length > 0
                            ? '要対応' // Action Required
                            : '食事中'; // Dining

                        return (
                            <div key={group.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${status === '要対応' ? 'border-red-500' : 'border-green-500'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">卓番 {group.tableNo || group.id.slice(0, 4)}</h3>
                                        <p className="text-sm text-gray-500">ID: {group.id}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${status === '要対応' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        {status}
                                    </span>
                                </div>

                                {/* Pending Confirmations */}
                                {groupPendingRounds.length > 0 && (
                                    <div className="mb-4 bg-orange-50 p-3 rounded-lg border border-orange-100">
                                        <p className="text-sm font-semibold text-orange-800 mb-2">新規注文あり!</p>
                                        <div className="flex flex-col gap-2">
                                            {groupPendingRounds.map(round => (
                                                <div key={round.id} className="flex gap-2 items-center">
                                                    <span className="text-xs text-orange-600 font-mono">#{round.id.split('_R')[1] || '?'}</span>
                                                    <div className="flex flex-1 gap-2">
                                                        <button
                                                            onClick={() => handleReviewClick(round.id, 'confirm')}
                                                            className="flex-1 bg-green-600 text-white py-1 rounded hover:bg-green-700 font-medium text-xs"
                                                        >
                                                            確認
                                                        </button>
                                                        <button
                                                            onClick={() => handleReviewClick(round.id, 'reject')}
                                                            className="flex-1 bg-red-100 text-red-600 py-1 rounded hover:bg-red-200 font-medium text-xs"
                                                        >
                                                            拒否
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                                    <button
                                        onClick={() => handleSettleClick(group.id)}
                                        className="text-sm text-gray-500 hover:text-red-600 underline"
                                    >
                                        お会計・退店処理
                                    </button>
                                </div>

                                {/* Kitchen View: List confirmed items */}
                                {(() => {
                                    const confirmedItems = allRoundItems.filter(item => {
                                        if (item.groupId !== group.id || item.deleted) return false;
                                        const round = allRounds.find(r => r.id === item.roundId);
                                        return round?.reviewStatus === 'confirmed';
                                    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                                    if (confirmedItems.length === 0) return null;

                                    return (
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <h4 className="text-sm font-bold text-gray-700 mb-2">調理・配膳 (Kitchen)</h4>
                                            <div className="space-y-2">
                                                {confirmedItems.map(item => (
                                                    <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                                        <span className={`flex-1 font-medium ${item.served ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                            {item.nameDisplay} x{item.qty}
                                                        </span>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await useGroupStore.getState().toggleItemServed(item.id, !item.served);
                                                                } catch (e) {
                                                                    alert('Error');
                                                                }
                                                            }}
                                                            className={`ml-2 px-3 py-1 rounded text-xs font-bold transition-colors ${item.served
                                                                ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                                                }`}
                                                        >
                                                            {item.served ? '取消' : '出餐'}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })}

                    {/* Empty State */}
                    {activeGroups.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-400">
                            現在利用中のテーブルはありません。
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'menu' && (
                <div className="bg-white rounded-xl shadow p-6">
                    <h2 className="text-lg font-bold mb-4">メニュー売り切れ管理</h2>
                    {/* Group by category */}
                    <div className="space-y-6">
                        {Array.from(new Set(merchantMenu.map(i => i.category))).map(cat => (
                            <div key={cat}>
                                <h3 className="font-semibold text-gray-900 mb-2">{cat}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {merchantMenu.filter(i => i.category === cat).map(item => {
                                        const soldOut = isSoldOut(item.nameJa);
                                        return (
                                            <button
                                                key={item.nameJa}
                                                onClick={() => toggleSoldOut(item.nameJa)}
                                                className={`p-3 rounded-lg border text-left transition-all ${soldOut
                                                    ? 'bg-gray-100 border-gray-200 opacity-60'
                                                    : 'bg-white border-gray-200 hover:border-blue-500'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className={soldOut ? 'line-through text-gray-400' : 'text-gray-800'}>
                                                        {locale === 'zh' ? item.nameZh : item.nameJa}
                                                    </span>
                                                    {soldOut && <Ban size={16} className="text-red-500" />}
                                                </div>
                                                <p className="text-sm text-gray-400 mt-1">
                                                    {item.priceYen ? `¥${item.priceYen}` : '-'}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
