'use client';

import type { CSSProperties, ReactNode } from 'react';
import { motion } from '@/theme/motion';
import { cn } from '@/lib/cn';

/**
 * Content arriving, rather than appearing.
 *
 * The web twin of the app's FadeIn, on the SAME duration token — a short fade
 * with a few pixels of rise, staggered down a list so it assembles instead of
 * flashing in as a block. Especially needed next to a skeleton: swapping a
 * placeholder instantly for real content is a jarring trade.
 *
 * The stagger is capped at eight. Past that a twentieth row waiting half a
 * second is not elegant, it is slow — and a seven-day agenda grid would
 * otherwise take most of a second to finish drawing.
 *
 * Reduced motion is honoured in CSS: the animation simply does not run, which
 * leaves the element at its final state rather than removing it. `backwards`
 * fill means a delayed row stays invisible until its turn instead of flashing
 * at full opacity first.
 */

const STAGGER_MS = 35;
const MAX_STAGGERED = 8;

export function FadeIn({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const style: CSSProperties = {
    animationDuration: `${motion.quick}ms`,
    animationDelay: `${Math.min(index, MAX_STAGGERED) * STAGGER_MS}ms`,
  };

  return (
    <div style={style} className={cn('hp-fade-in', className)}>
      {children}
    </div>
  );
}
