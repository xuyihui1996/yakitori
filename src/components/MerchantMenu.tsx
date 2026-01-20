import React, { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { MerchantMenuItem } from '@/data/merchantMenu';
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
    let closest = activeCategory;

    for (const { id, el } of categoryElements) {
      if (!el) continue;
      // relative top to the scroll parent
      const relativeTop = el.offsetTop - container.offsetTop;
      const height = el.offsetHeight;

      // If the section top is above the middle of viewport, or slightly below top
      if (relativeTop <= container.scrollTop + 50 && relativeTop + height > container.scrollTop + 50) {
        closest = id;
        break;
      }
    }

    if (closest && closest !== activeCategory) {
      setActiveCategory(closest);
      const sidebarEl = document.getElementById(`sidebar-cat-${closest}`);
      sidebarEl?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    isScrollingRef.current = false;
  };

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    const el = document.getElementById(`category-${cat}`);
    if (el) {
      isScrollingRef.current = true;
      // const navHeight = 0; // Adjusted for sticky header
      // const y = el.getBoundingClientRect().top + window.scrollY - navHeight;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { isScrollingRef.current = false; }, 800);
    }
  };

  // Modern Styles
  const pillActiveClass = "bg-primary-600 text-white shadow-lg shadow-primary-500/30 transform scale-105";
  const pillInactiveClass = "text-slate-500 hover:bg-slate-100 hover:text-primary-600";

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden rounded-2xl shadow-sm border border-slate-100">
      {/* Sidebar: Categories */}
      <div className="w-24 flex-shrink-0 flex flex-col bg-white border-r border-slate-100 overflow-y-auto hide-scrollbar py-2 pb-20 z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
        {categories.map((cat) => (
          <button
            key={cat}
            id={`sidebar-cat-${cat}`}
            onClick={() => scrollToCategory(cat)}
            className={`
              relative mx-2 my-1.5 p-3 text-xs font-medium rounded-xl transition-all duration-300
              flex flex-col items-center justify-center gap-1
              ${activeCategory === cat ? pillActiveClass : pillInactiveClass}
            `}
          >
            <span className="text-center leading-relaxed tracking-wide">{cat}</span>
            {activeCategory === cat && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 bg-white/20 rounded-r-full" />
            )}
          </button>
        ))}
        <div className="h-24"></div>
      </div>

      {/* Main Content: Menu Items */}
      <div
        className="flex-1 overflow-y-auto pb-24 scroll-smooth"
        onScroll={handleScroll}
        ref={listRef}
      >
        <div className="px-4 py-4 space-y-6">
          {categories.map((cat) => (
            <div key={cat} id={`category-${cat}`} className="scroll-mt-4">
              <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm py-3 mb-2 flex items-center">
                <div className="w-1 h-4 bg-primary-500 rounded-full mr-2"></div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                  {cat}
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {groupedItems[cat]?.map((item) => (
                  <div
                    key={item.nameJa}
                    className="premium-card p-4 flex gap-4 premium-shadow hover-lift bg-white relative group border border-slate-100/60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-800 text-base leading-tight">
                            {locale === 'zh' ? item.nameZh : item.nameJa}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 font-medium">
                            {locale === 'zh' ? item.nameJa : item.nameZh}
                          </p>
                        </div>
                        <div className="text-primary-600 font-bold text-lg tabular-nums">
                          {item.priceYen ? `¥${item.priceYen}` : '-'}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        {!item.priceYen && (
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                            <input
                              type="number"
                              placeholder="0"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-6 pr-2 text-sm font-semibold focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all outline-none"
                              value={priceInputs[item.nameJa] || ''}
                              onChange={(e) => setPriceInputs(prev => ({ ...prev, [item.nameJa]: e.target.value }))}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-3 ml-auto">
                          {/* Quantity Selector */}
                          <div className="flex items-center bg-slate-100 rounded-lg p-1">
                            <button
                              onClick={() => setQtyInputs(prev => ({ ...prev, [item.nameJa]: Math.max(1, (prev[item.nameJa] || 1) - 1) }))}
                              className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 hover:text-primary-600 active:scale-95 transition-all disabled:opacity-50"
                              disabled={disabled}
                            >
                              <span className="text-lg font-bold mb-0.5">-</span>
                            </button>
                            <span className="w-10 text-center font-bold text-slate-700">
                              {qtyInputs[item.nameJa] || 1}
                            </span>
                            <button
                              onClick={() => setQtyInputs(prev => ({ ...prev, [item.nameJa]: (prev[item.nameJa] || 1) + 1 }))}
                              className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 hover:text-primary-600 active:scale-95 transition-all disabled:opacity-50"
                              disabled={disabled}
                            >
                              <Plus size={16} strokeWidth={3} />
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              const price = item.priceYen ?? parseInt(priceInputs[item.nameJa] || '0');
                              if (!price) return;

                              const qty = qtyInputs[item.nameJa] || 1;

                              onAdd({
                                nameDisplay: locale === 'zh' ? item.nameZh : item.nameJa,
                                price,
                                qty
                              });
                              // Reset
                              if (!item.priceYen) setPriceInputs(prev => ({ ...prev, [item.nameJa]: '' }));
                              setQtyInputs(prev => ({ ...prev, [item.nameJa]: 1 }));
                            }}
                            disabled={disabled || (!item.priceYen && !priceInputs[item.nameJa])}
                            className={`
                                flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all
                                ${disabled || (!item.priceYen && !priceInputs[item.nameJa])
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 hover:bg-primary-700 active:scale-95'}
                              `}
                          >
                            <span>{t('menu.add')}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="h-28"></div>
      </div>
    </div>
  );
};
