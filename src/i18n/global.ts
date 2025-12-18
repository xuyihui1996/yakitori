import { messages, type Locale, type MessageKey } from '@/i18n/messages';
import { getDefaultLocale } from '@/i18n';

function format(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return v === undefined || v === null ? `{${k}}` : String(v);
  });
}

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>) {
  const template = (messages as any)[locale]?.[key] ?? (messages as any).zh?.[key] ?? String(key);
  return format(template, params);
}

export function tGlobal(key: MessageKey, params?: Record<string, string | number>) {
  return translate(getDefaultLocale(), key, params);
}

