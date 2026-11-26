'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Route content enters with a short rise-and-fade instead of swapping whole.
 * Keyed on the pathname only, so a live refresh of the SAME page (which
 * keeps the path) never replays the entrance.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="hp-page-in">
      {children}
    </div>
  );
}
