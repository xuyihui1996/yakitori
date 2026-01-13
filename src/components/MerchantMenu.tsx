import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { MerchantMenuItem } from '@/data/merchantMenu';
import { formatMoney } from '@/utils/money';
import { useI18n } from '@/i18n';

interface Props {
  items: MerchantMenuItem[];
  onAdd: (payload: { nameDisplay: string; price: number; qty: number; note?: string }) => Promise<void> | void;
  disabled?: boolean;
}

export const MerchantMenu: React.FC<Props> = ({ items, onAdd, disabled }) => {
  const { locale, t } = useI18n();
  const categories = useMemo(
    () => Array.from(new Set(items.map((it) => it.category))),
    [items]
  );
  const [activeCategory, setActiveCategory] = useState(categories[0] || '');
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [qtyInputs, setQtyInputs] = useState<Record<string, number>>({});
  const filtered = useMemo(
    () => items.filter((it) => it.category === activeCategory),
    [items, activeCategory]
  );
  const listRef = useRef<HTMLDivElement>(null);
  const lastSwitchRef = useRef(0);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [activeCategory]);

  const handleAdd = async (item: MerchantMenuItem) => {
    if (disabled) return;
    const key = item.nameZh;
    const qty = Math.max(1, qtyInputs[key] ?? 1);
    const priceInput = priceInputs[key];
    const price = item.priceYen ?? (priceInput ? Number(priceInput) : NaN);

    if (!Number.isFinite(price) || price <= 0) {
      alert(t('menu.enterPrice'));
      return;
    }

    await onAdd({
      nameDisplay: item.nameZh,
      price: Math.round(price),
      qty,
      note: item.nameJa
    });

    setQtyInputs((prev) => ({ ...prev, [key]: 1 }));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 8) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    const nearTop = el.scrollTop <= 24;
    if (!nearBottom && !nearTop) return;
    const now = Date.now();
    if (now - lastSwitchRef.current < 500) return;
    const idx = categories.indexOf(activeCategory);
    if (nearBottom && idx >= 0 && idx < categories.length - 1) {
      lastSwitchRef.current = now;
      setActiveCategory(categories[idx + 1]);
      return;
    }
    if (nearTop && idx > 0) {
      lastSwitchRef.current = now;
      setActiveCategory(categories[idx - 1]);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-3 sm:p-4">
      <div className="flex gap-3">
        {/* 左侧分类 */}
        <div className="w-28 sm:w-32 shrink-0 border-r">
          <div className="space-y-2 pr-2 max-h-[70vh] overflow-y-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${
                  activeCategory === cat
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{cat}</span>
                {activeCategory === cat && <ChevronRight size={16} />}
              </button>
            ))}
          </div>
        </div>

        {/* 右侧菜品列表 */}
        <div className="flex-1">
          <div
            className="grid grid-cols-1 gap-3 max-h-[70vh] overflow-y-auto pr-1"
            onScroll={handleScroll}
            ref={listRef}
          >
            {filtered.map((item) => {
              const isCustomPrice = item.priceYen == null;
              const key = item.nameZh;
              const qty = Math.max(1, qtyInputs[key] ?? 1);
              const primaryName = locale === 'ja' ? item.nameJa : item.nameZh;
              const secondaryName = locale === 'ja' ? '' : item.nameJa;
              return (
                <div
                  key={`${item.category}-${item.nameZh}`}
                  className="border rounded-xl p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-base truncate">
                        {primaryName}
                      </p>
                      {secondaryName ? (
                        <p className="text-xs text-gray-500 truncate">{secondaryName}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      {isCustomPrice ? (
                        <div className="text-sm text-orange-600 font-semibold">{t('menu.customPrice')}</div>
                      ) : (
                        <div className="text-lg font-bold text-gray-900">
                          {formatMoney(item.priceYen!)}
                        </div>
                      )}
                    </div>
                  </div>

                  {isCustomPrice && (
                    <input
                      type="number"
                      min={0}
                      placeholder={t('menu.pricePlaceholder')}
                      value={priceInputs[key] ?? ''}
                      onChange={(e) =>
                        setPriceInputs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      disabled={disabled}
                    />
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-8 h-8 rounded-full border text-lg leading-none flex items-center justify-center disabled:opacity-40"
                        onClick={() =>
                          setQtyInputs((prev) => ({
                            ...prev,
                            [key]: Math.max(1, (prev[key] ?? 1) - 1)
                          }))
                        }
                        disabled={disabled || qty <= 1}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) =>
                          setQtyInputs((prev) => ({
                            ...prev,
                            [key]: Math.max(1, Number(e.target.value) || 1)
                          }))
                        }
                        className="w-14 text-center border rounded-lg py-1 text-sm"
                        disabled={disabled}
                      />
                      <button
                        type="button"
                        className="w-8 h-8 rounded-full border text-lg leading-none flex items-center justify-center disabled:opacity-40"
                        onClick={() =>
                          setQtyInputs((prev) => ({
                            ...prev,
                            [key]: (prev[key] ?? 1) + 1
                          }))
                        }
                        disabled={disabled}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(item)}
                      disabled={disabled}
                      className="inline-flex items-center gap-2 bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={18} />
                      <span>{t('menu.add')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
