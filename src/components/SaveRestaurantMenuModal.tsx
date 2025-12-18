/**
 * 结账后保存为店铺菜单的弹窗
 */

import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useI18n } from '@/i18n';

interface SaveRestaurantMenuModalProps {
  isOpen: boolean;
  onSave: (displayName: string) => Promise<void>;
  onSkip: () => void;
}

export const SaveRestaurantMenuModal: React.FC<SaveRestaurantMenuModalProps> = ({
  isOpen,
  onSave,
  onSkip
}) => {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!displayName.trim()) {
      alert(t('saveMenu.needName'));
      return;
    }

    setSaving(true);
    try {
      await onSave(displayName.trim());
      setDisplayName('');
    } catch (error) {
      alert(t('saveMenu.failed', { message: (error as Error).message }));
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setDisplayName('');
    onSkip();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {t('saveMenu.title')}
          </h3>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {t('saveMenu.desc')}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('saveMenu.nameLabel')}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('saveMenu.namePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !saving) {
                handleSave();
              }
            }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
          >
            <span>{t('common.skip')}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
            className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
          >
            <Save size={18} />
            <span>{saving ? t('saveMenu.saving') : t('common.save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
