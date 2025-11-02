/**
 * 结账确认弹窗
 * 显示成员合并后的订单，允许成员确认和调整数量
 */

import React, { useState, useMemo } from 'react';
import { X, Check, Plus, Minus } from 'lucide-react';
import { RoundItem, MergedOrderItem } from '@/types';
import { formatMoney } from '@/utils/money';

interface CheckoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  userName: string;
  allItems: RoundItem[]; // 用户在所有轮次中的订单项（不包括Extra round）
  extraRoundItems: RoundItem[]; // Extra round中的调整项
  onAddExtraItem: (nameDisplay: string, price: number, qty: number) => Promise<void>;
  onUpdateExtraItem: (itemId: string, newQty: number) => Promise<void>;
  onDeleteExtraItem: (itemId: string) => Promise<void>;
  disabled?: boolean;
}

export const CheckoutConfirmModal: React.FC<CheckoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
  allItems,
  extraRoundItems,
  onAddExtraItem,
  onUpdateExtraItem,
  onDeleteExtraItem,
  disabled = false
}) => {
  const [showExtraRound, setShowExtraRound] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<string>('');
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('remove');
  const [loading, setLoading] = useState(false);

  // 计算合并后的订单项（所有轮次，按名称和价格合并）
  const mergedItems = useMemo<MergedOrderItem[]>(() => {
    const merged: Record<string, MergedOrderItem> = {};

    // 合并所有正常轮次的订单项
    allItems
      .filter(item => !item.deleted)
      .forEach((item) => {
        const key = `${item.nameDisplay}_${item.price}`;
        if (merged[key]) {
          merged[key].totalQty += item.qty;
          merged[key].originalItems.push(item);
          if (item.note && !merged[key].notes.includes(item.note)) {
            merged[key].notes.push(item.note);
          }
        } else {
          merged[key] = {
            nameDisplay: item.nameDisplay,
            price: item.price,
            totalQty: item.qty,
            notes: item.note ? [item.note] : [],
            originalItems: [item]
          };
        }
      });

    return Object.values(merged);
  }, [allItems]);

  // 应用Extra round调整后的最终数量
  const finalItems = useMemo(() => {
    return mergedItems.map(item => {
      // 找到Extra round中该菜品的调整项
      const extraAdjustments = extraRoundItems
        .filter(extra => 
          extra.nameDisplay === item.nameDisplay && 
          extra.price === item.price &&
          !extra.deleted
        );
      
      // 计算总调整数量（正数=多吃，负数=未上）
      const totalAdjustment = extraAdjustments.reduce((sum, extra) => sum + extra.qty, 0);
      
      return {
        ...item,
        finalQty: item.totalQty + totalAdjustment, // 原始数量 + 调整
        adjustmentQty: totalAdjustment,
        extraAdjustments
      };
    });
  }, [mergedItems, extraRoundItems]);

  // 计算总金额（使用最终数量）
  const grandTotal = useMemo(() => {
    return finalItems.reduce((sum, item) => sum + item.price * item.finalQty, 0);
  }, [finalItems]);

  // 获取用户点过的所有菜品（用于Extra round选择）
  const userOrderedItems = useMemo(() => {
    return mergedItems.map(item => ({
      nameDisplay: item.nameDisplay,
      price: item.price,
      totalQty: item.totalQty
    }));
  }, [mergedItems]);

  // 添加Extra round调整项
  const handleAddExtraItem = async () => {
    if (!selectedMenuItem || adjustmentQty === 0) {
      alert('请选择菜品并输入调整数量');
      return;
    }

    const [nameDisplay, priceStr] = selectedMenuItem.split('|');
    const price = parseFloat(priceStr);

    // 如果是"未上"，检查数量不能超过原始总数
    if (adjustmentType === 'remove') {
      const originalItem = mergedItems.find(
        m => m.nameDisplay === nameDisplay && m.price === price
      );
      if (!originalItem) {
        alert('找不到原始订单项');
        return;
      }
      if (Math.abs(adjustmentQty) > originalItem.totalQty) {
        alert(`未上的数量不能超过原始订单总数（${originalItem.totalQty}）`);
        return;
      }
    }

    setLoading(true);
    try {
      await onAddExtraItem(nameDisplay, price, adjustmentType === 'add' ? adjustmentQty : -Math.abs(adjustmentQty));
      setSelectedMenuItem('');
      setAdjustmentQty(0);
      setAdjustmentType('remove');
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 更新Extra round调整项数量
  const handleUpdateExtraItem = async (itemId: string, newQty: number) => {
    setLoading(true);
    try {
      // 如果是减少（负数），检查是否超过原始总数
      if (newQty < 0) {
        const extraItem = extraRoundItems.find(item => item.id === itemId);
        if (extraItem) {
          const originalItem = mergedItems.find(
            m => m.nameDisplay === extraItem.nameDisplay && m.price === extraItem.price
          );
          if (originalItem && Math.abs(newQty) > originalItem.totalQty) {
            alert(`未上的数量不能超过原始订单总数（${originalItem.totalQty}）`);
            setLoading(false);
            return;
          }
        }
      }
      
      await onUpdateExtraItem(itemId, newQty);
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 删除Extra round调整项
  const handleDeleteExtraItem = async (itemId: string) => {
    if (!window.confirm('确认删除此调整项？')) return;
    
    setLoading(true);
    try {
      await onDeleteExtraItem(itemId);
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 确认订单
  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">请确认您的订单</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading || disabled}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 内容区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 合并后的订单列表 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              【{userName} 的账单汇总】
            </h3>
            
            {finalItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                暂无订单
              </div>
            ) : (
              <div className="space-y-3">
                {finalItems.map((item, index) => (
                  <div key={`${item.nameDisplay}-${item.price}-${index}`} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{item.nameDisplay}</h4>
                          {item.adjustmentQty !== 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              item.adjustmentQty > 0 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {item.adjustmentQty > 0 ? '+' : ''}{item.adjustmentQty}
                            </span>
                          )}
                        </div>
                        {item.notes.length > 0 && (
                          <p className="text-sm text-gray-500 mt-0.5">
                            {item.notes.join(' / ')}
                          </p>
                        )}
                        <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
                          <span>原始: {item.totalQty}</span>
                          {item.adjustmentQty !== 0 && (
                            <>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium text-gray-900">最终: {item.finalQty}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatMoney(item.price)} × {item.finalQty} = {formatMoney(item.price * item.finalQty)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 总计 */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">总计</span>
                <span className="text-xl font-bold text-primary-600">
                  {formatMoney(grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Extra Round 调整区域 */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">数量调整（Extra Round）</h3>
              <button
                onClick={() => setShowExtraRound(!showExtraRound)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {showExtraRound ? '收起' : '展开'}
              </button>
            </div>

            {showExtraRound && (
              <div className="space-y-4">
                {/* 添加调整项表单 */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">添加调整</h4>
                  
                  <div className="space-y-3">
                    {/* 选择菜品 */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">选择菜品</label>
                      <select
                        value={selectedMenuItem}
                        onChange={(e) => setSelectedMenuItem(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading || disabled}
                      >
                        <option value="">请选择...</option>
                        {userOrderedItems.map((item) => (
                          <option key={`${item.nameDisplay}_${item.price}`} value={`${item.nameDisplay}|${item.price}`}>
                            {item.nameDisplay} (¥{item.price}) - 原始数量: {item.totalQty}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 调整类型 */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">调整类型</label>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => setAdjustmentType('remove')}
                          className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                            adjustmentType === 'remove'
                              ? 'bg-red-50 border-red-300 text-red-700'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          disabled={loading || disabled}
                        >
                          未上（减少）
                        </button>
                        <button
                          onClick={() => setAdjustmentType('add')}
                          className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                            adjustmentType === 'add'
                              ? 'bg-green-50 border-green-300 text-green-700'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          disabled={loading || disabled}
                        >
                          多吃（增加）
                        </button>
                      </div>
                    </div>

                    {/* 调整数量 */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">调整数量</label>
                      <input
                        type="number"
                        min="1"
                        value={adjustmentQty || ''}
                        onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading || disabled}
                      />
                    </div>

                    {/* 添加按钮 */}
                    <button
                      onClick={handleAddExtraItem}
                      disabled={loading || disabled || !selectedMenuItem || adjustmentQty <= 0}
                      className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      添加调整
                    </button>
                  </div>
                </div>

                {/* 现有调整项列表 */}
                {extraRoundItems.filter(item => !item.deleted).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">当前调整</h4>
                    <div className="space-y-2">
                      {extraRoundItems
                        .filter(item => !item.deleted)
                        .map((item) => (
                          <div key={item.id} className="border rounded-lg p-3 flex items-center justify-between">
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{item.nameDisplay}</span>
                              <span className={`ml-2 text-sm ${item.qty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {item.qty > 0 ? '+' : ''}{item.qty}
                              </span>
                              <span className="text-sm text-gray-500 ml-2">
                                {formatMoney(item.price)} × {Math.abs(item.qty)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleUpdateExtraItem(item.id, item.qty + (item.qty > 0 ? 1 : -1))}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                disabled={loading || disabled}
                                title="增加调整量"
                              >
                                <Plus size={16} className="text-gray-600" />
                              </button>
                              <button
                                onClick={() => handleUpdateExtraItem(item.id, item.qty - (item.qty > 0 ? 1 : -1))}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                disabled={loading || disabled || (item.qty < 0 && Math.abs(item.qty) >= (mergedItems.find(m => m.nameDisplay === item.nameDisplay && m.price === item.price)?.totalQty || 0))}
                                title="减少调整量"
                              >
                                <Minus size={16} className="text-gray-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteExtraItem(item.id)}
                                className="p-1 hover:bg-red-50 rounded transition-colors"
                                disabled={loading || disabled}
                                title="删除"
                              >
                                <X size={16} className="text-red-600" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-6 border-t bg-gray-50 flex space-x-3">
          <button
            onClick={onClose}
            disabled={loading || disabled}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || disabled}
            className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>确认中...</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>确认订单</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
