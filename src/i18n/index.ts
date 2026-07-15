/**
 * i18n — dependency-free, SSR-safe translation layer for the web companion.
 *
 *   translate(key, locale)   pure resolver (locale → en → key fallback)
 *   getServerLocale()        reads the locale cookie (server components) — see server.ts
 *   useTranslation()         client hook (see LocaleProvider.tsx)
 *
 * English is the source/default. A missing key falls back to English, then the
 * key itself — never an empty string. Locale is stored in a cookie so both
 * server components (page headers, empty states) and client components read the
 * same value with no hydration mismatch.
 */

import { en } from './en';
import { nl } from './nl';
import { es } from './es';

export type SupportedLocale = 'en' | 'nl' | 'es';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** Cookie the locale is persisted in (readable server + client). */
export const LOCALE_COOKIE = 'hp_locale';

const TRANSLATIONS: Record<SupportedLocale, unknown> = { en, nl, es };

/** Ordered list for the language switcher, with native display names. */
export const SUPPORTED_LOCALES: ReadonlyArray<{
  code: SupportedLocale;
  label: string;
}> = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'es', label: 'Español' },
];

export function isSupportedLocale(value: string | undefined | null): value is SupportedLocale {
  return value === 'en' || value === 'nl' || value === 'es';
}

function resolve(obj: unknown, parts: string[]): string | null {
  if (parts.length === 0 || obj === null || typeof obj !== 'object') return null;
  const [head, ...rest] = parts;
  if (head === undefined) return null;
  const next = (obj as Record<string, unknown>)[head];
  if (rest.length === 0) return typeof next === 'string' ? next : null;
  return resolve(next, rest);
}

/** Resolves a dot-notation key against a locale, falling back to en, then the key. */
export function translate(key: string, locale: SupportedLocale): string {
  const segments = key.split('.');
  return resolve(TRANSLATIONS[locale], segments) ?? resolve(TRANSLATIONS.en, segments) ?? key;
}

/** A bound translator: `const t = translator(locale); t('nav.horses')`. */
export function translator(locale: SupportedLocale): (key: string) => string {
  return (key: string) => translate(key, locale);
}
