'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useState that persists to localStorage (analyst filter ergonomics, W19). SSR-
 * safe: starts from `initial`, then hydrates from storage on mount. This is a
 * real app, so localStorage is the right home for per-user view state.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // One-time hydration from storage; not a render-driven state cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Ignore unreadable/blocked storage — fall back to the in-memory default.
    }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota/blocked storage; state still works in-memory this session.
    }
  }, [key, value]);

  return [value, setValue];
}
