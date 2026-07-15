'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  translate,
  type SupportedLocale,
} from './index';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Client locale provider. The active locale comes from the server (cookie) via
 * `initialLocale`, so server and client render the same language — no hydration
 * mismatch. Switching writes the cookie and refreshes so server components
 * re-render in the new locale.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: SupportedLocale;
  children: ReactNode;
}) {
  const router = useRouter();

  const setLocale = useCallback(
    (next: SupportedLocale) => {
      // 1 year, site-wide. Not HttpOnly — it only selects a language.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: initialLocale,
      setLocale,
      t: (key: string) => translate(key, initialLocale),
    }),
    [initialLocale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  // Outside a provider (isolated tests): default locale.
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => undefined,
    t: (key: string) => translate(key, DEFAULT_LOCALE),
  };
}
