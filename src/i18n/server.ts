import { cookies } from 'next/headers';

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isSupportedLocale,
  translator,
  type SupportedLocale,
} from './index';

/** Reads the active locale from the cookie (server components / route handlers). */
export async function getServerLocale(): Promise<SupportedLocale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

/** A bound translator for server components: `const t = await getServerT()`. */
export async function getServerT(): Promise<(key: string) => string> {
  return translator(await getServerLocale());
}
