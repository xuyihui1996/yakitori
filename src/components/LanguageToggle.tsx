import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '@/i18n';

export const LanguageToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { locale, setLocale, t } = useI18n();
  const next = locale === 'zh' ? 'ja' : 'zh';

  return (
    <button
      onClick={() => setLocale(next)}
      className={
        className ??
        'px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium flex items-center gap-2'
      }
      title={locale === 'zh' ? t('lang.ja') : t('lang.zh')}
      type="button"
    >
      <Languages size={18} />
      <span>{locale === 'zh' ? t('lang.ja') : t('lang.zh')}</span>
    </button>
  );
};

