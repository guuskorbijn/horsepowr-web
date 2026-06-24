'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/** Tracks an element's content-box size via ResizeObserver. Used so SVG charts
 *  fill their container responsively without hardcoded widths. */
export function useElementSize<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  width: number;
  height: number;
} {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}
