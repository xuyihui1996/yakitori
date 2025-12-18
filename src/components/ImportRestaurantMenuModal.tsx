/**
 * 创建组后导入历史菜单的弹窗
 */

import React, { useState } from 'react';
import { X, Download, Clock } from 'lucide-react';
import { UserRestaurantMenuLink, RestaurantMenu, RestaurantMenuItem } from '@/types';
import { useI18n } from '@/i18n';

interface ImportRestaurantMenuModalProps {
  isOpen: boolean;
  menus: Array<{
    link: UserRestaurantMenuLink;
    menu: RestaurantMenu;
    items: RestaurantMenuItem[];
  }>;
  onImport: (restaurantMenuId: string) => Promise<{
    imported: number;
    conflicts: Array<{ nameDisplay: string; price: number; note?: string }>;
  }>;
  onSkip: () => void;
}

export const ImportRestaurantMenuModal: React.FC<ImportRestaurantMenuModalProps> = ({
  isOpen,
  menus,
  onImport,
  onSkip
}) => {
  const { locale, t } = useI18n();
  const [importing, setImporting] = useState<string | null>(null);

  if (!isOpen || menus.length === 0) return null;

  const handleImport = async (restaurantMenuId: string) => {
    setImporting(restaurantMenuId);
    try {
      const result = await onImport(restaurantMenuId);
      alert(
        result.conflicts.length > 0
          ? t('importMenu.resultWithConflicts', { imported: result.imported, conflicts: result.conflicts.length })
          : t('importMenu.resultNoConflicts', { imported: result.imported })
      );
      
      onSkip(); // 导入成功后关闭弹窗
    } catch (error) {
      alert(t('importMenu.failed', { message: (error as Error).message }));
    } finally {
      setImporting(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {t('importMenu.title')}
            </h3>
            <button
              onClick={onSkip}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3 mb-4">
            {menus.map(({ link, items }) => (
              <div
                key={link.restaurantMenuId}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{link.displayName}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('importMenu.itemsCount', { n: items.length })}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 flex items-center space-x-1">
                    <Clock size={12} />
                    <span>{formatDate(link.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleImport(link.restaurantMenuId)}
                  disabled={importing === link.restaurantMenuId}
                  className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm font-medium"
                >
                  <Download size={16} />
                  <span>
                    {importing === link.restaurantMenuId ? t('importMenu.importing') : t('importMenu.importThis')}
                  </span>
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={onSkip}
            className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            {t('importMenu.skip')}
          </button>
        </div>
      </div>
    </div>
  );
};
