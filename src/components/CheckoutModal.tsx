
import React from 'react';
import { GroupBill } from '@/types';
import { tGlobal } from '@/i18n/global';
import { formatCurrency } from '@/utils/currency';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    bill: GroupBill | null;
    loading: boolean;
    tableNo: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    bill,
    loading,
    tableNo
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col shadow-xl">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-xl font-bold text-gray-800">
                        {tGlobal('merchant.checkoutConfirm')} - {tGlobal('merchant.tableNo')} {tableNo}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-2">
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading || !bill ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Grand Total */}
                            <div className="text-center py-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                <div className="text-sm text-gray-500 mb-1">{tGlobal('bill.total')}</div>
                                <div className="text-4xl font-bold text-indigo-700">
                                    {formatCurrency(bill.grandTotal)}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {tGlobal('bill.rounds', { n: bill.rounds.length })} • {tGlobal('bill.items', { n: bill.rounds.reduce((sum, r) => sum + r.items.length, 0) })}
                                </div>
                            </div>

                            {/* Round Breakdown */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-gray-700 border-b pb-2">{tGlobal('owner.roundDetail')}</h3>
                                {bill.rounds.map((round, index) => (
                                    <div key={round.roundId} className="bg-white border rounded-lg p-3 shadow-sm">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-medium text-gray-800">
                                                {tGlobal('export.round', { n: index + 1 })}
                                            </span>
                                            <span className="font-bold text-gray-900">
                                                {formatCurrency(round.totalAmount)}
                                            </span>
                                        </div>
                                        {/* Items Preview (First 3) */}
                                        <div className="space-y-1 pl-2 border-l-2 border-gray-100">
                                            {round.aggregatedItems.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-sm text-gray-600">
                                                    <span>{item.nameDisplay} ×{item.totalQty}</span>
                                                    <span>{formatCurrency(item.price * item.totalQty)}</span>
                                                </div>
                                            ))}
                                            {round.aggregatedItems.length > 3 && (
                                                <div className="text-xs text-gray-400 pl-1">
                                                    + {round.aggregatedItems.length - 3} more items...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                    >
                        {tGlobal('merchant.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading || !bill}
                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-lg shadow-green-200 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {tGlobal('merchant.checkout')}
                    </button>
                </div>
            </div>
        </div>
    );
};
