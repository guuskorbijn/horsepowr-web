'use client';

import { prefersReducedMotion } from '@/lib/reducedMotion';
import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up to its value once, when it first renders, and
 * glides when the value changes later (a live update). Server-rendered with
 * the FINAL value, so there is no flash of zero without JavaScript, and
 * reduced motion simply shows the value.
 */
export function CountUp({ value, durationMs = 700 }: { value: number; durationMs?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = value;
      return;
    }
    const start = first.current ? 0 : from.current;
    first.current = false;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className="tabular-nums">{shown}</span>;
}
