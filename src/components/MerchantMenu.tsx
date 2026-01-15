import React, { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
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

  // Group items by category for continuous rendering
  const groupedItems = useMemo(() => {
    const groups: Record<string, MerchantMenuItem[]> = {};
    categories.forEach(cat => {
      groups[cat] = items.filter(it => it.category === cat);
    });
    return groups;
  }, [items, categories]);

  const listRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Scroll Spy Logic
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingRef.current) return; // Skip if mechanically scrolling

    const container = e.currentTarget;
    const categoryElements = categories.map(cat => ({
      id: cat,
      el: document.getElementById(`category-${cat}`)
    }));

    // Find the category that is currently most visible or at top
    // Simple heuristic: find the first category whose top is >= container top - offset
    // Or better: find closest to top

    // We add a small offset to account for padding
    // const containerTop = container.scrollTop + container.offsetTop; 

    // Find the section that covers the top of the viewport
    let currentCat = activeCategory;

    for (const { id, el } of categoryElements) {
      if (!el) continue;
      // relative top to the scroll parent
      const relativeTop = el.offsetTop - container.offsetTop;
      const height = el.offsetHeight;

      // If the section top is above the middle of viewport, or slightly below top
      // We want the section that is "active" at the top of the container
      if (relativeTop <= container.scrollTop + 50 && relativeTop + height > container.scrollTop + 50) {
        currentCat = id;
        break;
      }
    }

    if (currentCat !== activeCategory) {
      setActiveCategory(currentCat);
    }
  };

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    const el = document.getElementById(`category-${cat}`);
    if (el && listRef.current) {
      isScrollingRef.current = true;
      // Smooth scroll
      listRef.current.scrollTo({
        top: el.offsetTop - listRef.current.offsetTop,
        behavior: 'smooth'
      });
      // Re-enable scroll spy after animation
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    }
  };

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

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-3 sm:p-4 h-[calc(100vh-200px)] min-h-[500px] flex flex-col">
      <div className="flex gap-3 h-full overflow-hidden">
        {/* 左侧分类 */}
        <div className="w-28 sm:w-32 shrink-0 border-r h-full overflow-y-auto">
          <div className="space-y-2 pr-2 pb-20">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeCategory === cat
                  ? 'bg-primary-50 text-primary-700 font-bold border-l-4 border-primary-500'
                  : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
              >
                <span className="truncate block">{cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧菜品列表 */}
        <div
          className="flex-1 overflow-y-auto pr-1 pb-20 scroll-smooth"
          onScroll={handleScroll}
          ref={listRef}
        >
          <div className="space-y-6">
            {categories.map((cat) => {
              const items = groupedItems[cat] || [];
              if (items.length === 0) return null;

              return (
                <div key={cat} id={`category-${cat}`}>
                  <h3 className="font-bold text-gray-500 text-sm mb-3 sticky top-0 bg-white/95 backdrop-blur py-2 z-10">
                    {cat}
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {items.map((item) => {
                      const isCustomPrice = item.priceYen == null;
                      const key = item.nameZh;
                      const qty = Math.max(1, qtyInputs[key] ?? 1);
                      const primaryName = locale === 'ja' ? item.nameJa : item.nameZh;
                      const secondaryName = locale === 'ja' ? '' : item.nameJa;
                      return (
                        <div
                          key={`${item.category}-${item.nameZh}`}
                          className="border rounded-xl p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow bg-white"
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
                                className="w-8 h-8 rounded-full border text-lg leading-none flex items-center justify-center disabled:opacity-40 hover:bg-gray-50"
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
                                className="w-14 text-center border rounded-lg py-1 text-sm bg-transparent"
                                disabled={disabled}
                              />
                              <button
                                type="button"
                                className="w-8 h-8 rounded-full border text-lg leading-none flex items-center justify-center disabled:opacity-40 hover:bg-gray-50"
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
                              className="inline-flex items-center gap-2 bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                            >
                              <Plus size={16} />
                              <span>{t('menu.add')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
