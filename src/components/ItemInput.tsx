/**
 * 菜品录入组件
 * 用于新建菜品：名称+价格+数量+备注
 */

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useI18n } from '@/i18n';

interface ItemInputProps {
  onSubmit: (item: {
    nameDisplay: string;
    price: number;
    qty: number;
    note?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  defaultQty?: number;
}

export const ItemInput: React.FC<ItemInputProps> = ({
  onSubmit,
  onCancel,
  defaultQty = 1
}) => {
  const { t } = useI18n();
  const [nameDisplay, setNameDisplay] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState(defaultQty);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nameDisplay.trim() || !price) {
      alert(t('itemInput.needNamePrice'));
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert(t('itemInput.invalidPrice'));
      return;
    }

    if (qty <= 0) {
      alert(t('itemInput.invalidQty'));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        nameDisplay: nameDisplay.trim(),
        price: priceNum,
        qty,
        note: note.trim() || undefined
      });
      
      // 清空表单
      setNameDisplay('');
      setPrice('');
      setQty(defaultQty);
      setNote('');
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{t('itemInput.title')}</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* 菜名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('itemInput.name')}
          </label>
          <input
            type="text"
            value={nameDisplay}
            onChange={(e) => setNameDisplay(e.target.value)}
            placeholder="例：かしわ"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>

        {/* 价格和数量 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('itemInput.price')}
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="165"
              step="1"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('itemInput.qty')}
            </label>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100"
              >
                -
              </button>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min="1"
              />
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* 备注 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('itemInput.note')}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：鸡肉串"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
        >
          <Plus size={20} />
          <span>{submitting ? t('itemInput.adding') : t('itemInput.add')}</span>
        </button>
      </div>
    </form>
  );
};
