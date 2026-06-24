'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'horsepowr-theme';
const listeners = new Set<() => void>();

/** Inline pre-paint script: sets the .dark class before React hydrates so there
 *  is no flash of the wrong theme. Stringified and injected in <head>. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Snapshot reads the live DOM class (set pre-paint), so it never disagrees with
 *  what the user actually sees. */
function getSnapshot(): ThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getServerSnapshot(): ThemeMode {
  return 'light';
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage can be unavailable (private mode) — theme still applies for the session.
  }
  for (const listener of listeners) listener();
}

/**
 * Theme is an external system (a DOM class + localStorage), so we read it with
 * useSyncExternalStore rather than React state. That avoids a setState-in-effect
 * reconciliation and hydrates without a flash or mismatch.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setTheme = useCallback((mode: ThemeMode) => applyTheme(mode), []);
  const toggle = useCallback(
    () => applyTheme(getSnapshot() === 'dark' ? 'light' : 'dark'),
    [],
  );
  return { theme, setTheme, toggle };
}

/** Kept as a passthrough so the root layout has a stable mount point and the
 *  API stays familiar; the theme itself lives in the external store above. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
