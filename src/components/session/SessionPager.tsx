'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Prev/next navigation between a horse's consecutive sessions (W19). Older =
 * back in time, Newer = forward. ←/→ walk them, ignored while typing in a field.
 */
export function SessionPager({
  olderId,
  newerId,
}: {
  olderId: string | null;
  newerId: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft' && olderId) router.push(`/sessions/${olderId}`);
      else if (e.key === 'ArrowRight' && newerId) router.push(`/sessions/${newerId}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [olderId, newerId, router]);

  if (!olderId && !newerId) return null;

  const base =
    'inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 h-9 text-[13px] font-medium transition-colors';
  const enabled = 'text-text-primary hover:bg-surface-muted';
  const disabled = 'cursor-not-allowed text-text-tertiary opacity-60';

  return (
    <div className="no-print flex items-center gap-2">
      {olderId ? (
        <Link href={`/sessions/${olderId}`} className={`${base} ${enabled}`} aria-label="Older session">
          <ChevronLeft size={15} /> Older
        </Link>
      ) : (
        <span className={`${base} ${disabled}`} aria-disabled>
          <ChevronLeft size={15} /> Older
        </span>
      )}
      {newerId ? (
        <Link href={`/sessions/${newerId}`} className={`${base} ${enabled}`} aria-label="Newer session">
          Newer <ChevronRight size={15} />
        </Link>
      ) : (
        <span className={`${base} ${disabled}`} aria-disabled>
          Newer <ChevronRight size={15} />
        </span>
      )}
    </div>
  );
}
