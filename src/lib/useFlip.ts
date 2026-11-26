'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * FLIP layout animation: children marked `data-flip-key` glide from where
 * they were to where they are now, instead of jumping, whenever the list
 * re-renders (a drop, a live update from a colleague, a filter).
 *
 * Measure-after-render: every layout pass records each key's box; the next
 * pass compares and plays a transform from the old box to the new one with
 * the Web Animations API (compositor-only, no React state). New keys fade in.
 * Does nothing under `prefers-reduced-motion`.
 */
export function useFlip(container: RefObject<HTMLElement | null>, durationMs = 320): void {
  const boxes = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const root = container.current;
    if (root === null) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, DOMRect>();
    const first = boxes.current.size === 0;

    root.querySelectorAll<HTMLElement>('[data-flip-key]').forEach((el) => {
      const key = el.dataset.flipKey;
      if (key === undefined) return;
      const box = el.getBoundingClientRect();
      next.set(key, box);
      if (reduce || first) return;
      const before = boxes.current.get(key);
      if (before === undefined) {
        el.animate([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], {
          duration: durationMs,
          easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
        });
        return;
      }
      const dx = before.left - box.left;
      const dy = before.top - box.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: durationMs,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
    });
    boxes.current = next;
  });
}
