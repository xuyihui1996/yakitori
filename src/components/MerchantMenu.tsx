import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Plus, Users } from 'lucide-react';
import { MerchantMenuItem } from '@/data/merchantMenu';
import { useI18n } from '@/i18n';

interface Props {
  items: MerchantMenuItem[];
  onAdd: (payload: { nameDisplay: string; price: number; qty: number; note?: string }) => Promise<void> | void;
  onShare?: (payload: { nameDisplay: string; price: number; qty: number; note?: string }) => void;
  disabled?: boolean;
}

export const MerchantMenu: React.FC<Props> = ({ items, onAdd, onShare, disabled }) => {
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

  // Scroll Spy Logic - Window based
  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingRef.current) return;

      // Sticky header offset (approx 80px for header + some padding)
      const offset = 100;

      let closest = activeCategory;
      let minDistance = Infinity;

      for (const cat of categories) {
        const el = document.getElementById(`category-${cat}`);
        if (!el) {
          continue;
        }

        const rect = el.getBoundingClientRect();
        // Distance of the element's top to the target offset
        const distance = Math.abs(rect.top - offset);

        // Check if the section is currently active (top is above offset, bottom is below offset)
        if (rect.top <= offset && rect.bottom > offset) {
          closest = cat;
          minDistance = 0; // Found exact match
          break;
        }

        // Fallback: find closest one if none match exact (rare but safe)
        if (rect.top > offset && distance < minDistance) {
          // This logic prefers upcoming sections, might not be ideal.
          // Better logic: Last section that passed the threshold.
        }
      }

      // Improved logic: find the last category whose top is <= offset
      let active = categories[0];
      for (const cat of categories) {
        const el = document.getElementById(`category-${cat}`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= offset + 50) { // +50 tolerance
          active = cat;
        } else {
          break; // Since they are ordered, once we find one below, we stop
        }
      }
      closest = active;

      if (closest && closest !== activeCategory) {
        setActiveCategory(closest);
        // Also scroll sidebar processing
        const sidebarEl = document.getElementById(`sidebar-cat-${closest}`);
        // Only scroll sidebar if it's not visible? Or always center it?
        // Since sidebar is sticky, we might not need to scroll it much if it fits?
        // But if sidebar is long (scrollable within sticky), we might need it.
        // Let's keep it simple: just set active state. 
        // If sidebar overflows screen height, we might need to scroll it.
        sidebarEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories, activeCategory]);

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    const el = document.getElementById(`category-${cat}`);
    if (el) {
      isScrollingRef.current = true;
      const navHeight = 80; // Header height
      // Use window scrollTo
      const y = el.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top: y, behavior: 'smooth' });

      setTimeout(() => { isScrollingRef.current = false; }, 800);
    }
  };

  // Modern Styles
  const pillActiveClass = "bg-primary-600 text-white shadow-lg shadow-primary-500/30 transform scale-105";
  const pillInactiveClass = "text-slate-500 hover:bg-slate-100 hover:text-primary-600";

  return (
    <div className="flex relative items-start">
      {/* Sidebar: Categories - Sticky */}
      <div className="w-24 flex-shrink-0 flex flex-col bg-white border border-slate-100 rounded-2xl mr-3 sticky top-24 overflow-y-auto max-h-[calc(100vh-8rem)] hide-scrollbar z-10 shadow-sm py-2">
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
      </div>

      {/* Main Content: Menu Items */}
      <div className="flex-1 min-w-0" ref={listRef}>
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat} id={`category-${cat}`} className="scroll-mt-24">
              {/* Category Header */}
              <div className="sticky top-[72px] z-10 bg-slate-50/95 backdrop-blur-sm py-3 mb-2 flex items-center rounded-lg">
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

                          <div className="flex items-center gap-2">
                            {onShare && (
                              <button
                                onClick={() => {
                                  const price = item.priceYen ?? parseInt(priceInputs[item.nameJa] || '0');
                                  if (!price) return;

                                  const qty = qtyInputs[item.nameJa] || 1;

                                  onShare({
                                    nameDisplay: locale === 'zh' ? item.nameZh : item.nameJa,
                                    price,
                                    qty
                                  });
                                }}
                                disabled={disabled || (!item.priceYen && !priceInputs[item.nameJa])}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title={t('home.newShared')}
                              >
                                <Users size={18} />
                              </button>
                            )}

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
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
