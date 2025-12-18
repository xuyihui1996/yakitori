import React, { createContext, useContext, useMemo, useState } from 'react';
import { Locale, MessageKey, messages } from '@/i18n/messages';

const STORAGE_KEY = 'ordered_locale';

export function getStoredLocale(): Locale | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'zh' || raw === 'ja') return raw;
  return null;
}

export function getDefaultLocale(): Locale {
  const stored = getStoredLocale();
  if (stored) return stored;
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('ja')) return 'ja';
  return 'zh';
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale);
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function format(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return v === undefined || v === null ? `{${k}}` : String(v);
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getDefaultLocale());

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
  };

  const t = useMemo(() => {
    return (key: MessageKey, params?: Record<string, string | number>) => {
      const template = messages[locale][key] ?? messages.zh[key] ?? key;
      return format(template, params);
    };
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

