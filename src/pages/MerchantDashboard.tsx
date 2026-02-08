import React, { useEffect, useState } from 'react';
import { useGroupStore } from '@/store/groupStore';
import { useMerchantStore } from '@/store/merchantStore';
import { merchantMenu } from '@/data/merchantMenu';
import { useI18n } from '@/i18n';
import { Ban } from 'lucide-react';

export const MerchantDashboard: React.FC = () => {
    const {
        groups,
        loadAllGroups,
        allRounds,
        loadAllRounds,
        reviewRound,
        settleGroupById
    } = useGroupStore();
    const { toggleSoldOut, isSoldOut } = useMerchantStore();
    const { locale } = useI18n();
    const [activeTab, setActiveTab] = useState<'tables' | 'menu'>('tables');

    useEffect(() => {
        // Initial load
        loadAllGroups();
        loadAllRounds();

        // Poll for updates (in a real app, use subscriptions)
        const interval = setInterval(() => {
            loadAllGroups();
            loadAllRounds();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Filter groups that are not settled (Active Tables)
    const activeGroups = groups.filter(g => !g.settled);

    // Find pending rounds (Global)
    const pendingRounds = allRounds?.filter(r => r.reviewStatus === 'pending') || [];

    const handleReview = async (roundId: string, action: 'confirm' | 'reject') => {
        if (!confirm(action === 'confirm' ? 'Confirm this order?' : 'Reject this order?')) return;
        try {
            await reviewRound(roundId, action);
        } catch (error) {
            alert('Operation failed');
        }
    };

    const handleSettle = async (groupId: string) => {
        if (!confirm('Checkout and Settle this table? This will archive the group.')) return;
        try {
            await settleGroupById(groupId);
        } catch (error) {
            alert('Settlement failed');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Merchant Dashboard</h1>
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('tables')}
                        className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'tables' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                    >
                        Table Management
                    </button>
                    <button
                        onClick={() => setActiveTab('menu')}
                        className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'menu' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                    >
                        Menu Control
                    </button>
                </div>
            </header>

            {activeTab === 'tables' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Active Tables */}
                    {activeGroups.map(group => {
                        const groupPendingRounds = pendingRounds.filter(r => r.groupId === group.id);
                        const status = groupPendingRounds.length > 0
                            ? 'Action Required'
                            : 'Dining';

                        return (
                            <div key={group.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${status === 'Action Required' ? 'border-red-500' : 'border-green-500'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">Table {group.tableNo || group.id.slice(0, 4)}</h3>
                                        <p className="text-sm text-gray-500">ID: {group.id}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${status === 'Action Required' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        {status}
                                    </span>
                                </div>

                                {/* Pending Confirmations */}
                                {groupPendingRounds.length > 0 && (
                                    <div className="mb-4 bg-orange-50 p-3 rounded-lg border border-orange-100">
                                        <p className="text-sm font-semibold text-orange-800 mb-2">New Order Pending!</p>
                                        <div className="flex flex-col gap-2">
                                            {groupPendingRounds.map(round => (
                                                <div key={round.id} className="flex gap-2 items-center">
                                                    <span className="text-xs text-orange-600 font-mono">Round {round.id.split('_R')[1] || '?'}</span>
                                                    <div className="flex flex-1 gap-2">
                                                        <button
                                                            onClick={() => handleReview(round.id, 'confirm')}
                                                            className="flex-1 bg-green-600 text-white py-1 rounded hover:bg-green-700 font-medium text-xs"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={() => handleReview(round.id, 'reject')}
                                                            className="flex-1 bg-red-100 text-red-600 py-1 rounded hover:bg-red-200 font-medium text-xs"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                                    <button
                                        onClick={() => handleSettle(group.id)}
                                        className="text-sm text-gray-500 hover:text-red-600 underline"
                                    >
                                        Checkout & Settle
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Empty State */}
                    {activeGroups.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-400">
                            No active tables.
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'menu' && (
                <div className="bg-white rounded-xl shadow p-6">
                    <h2 className="text-lg font-bold mb-4">Menu Availability</h2>
                    {/* Group by category */}
                    <div className="space-y-6">
                        {Array.from(new Set(merchantMenu.map(i => i.category))).map(cat => (
                            <div key={cat}>
                                <h3 className="font-semibold text-gray-900 mb-2">{cat}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {merchantMenu.filter(i => i.category === cat).map(item => {
                                        // Use nameJa as ID since we don't have explicit ID
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
