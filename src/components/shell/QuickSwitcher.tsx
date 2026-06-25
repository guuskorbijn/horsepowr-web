'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { listHorses } from '@/data/horseRepository';
import { HorseIcon } from '@/components/icons/HorseIcon';
import type { HorseRow } from '@/types/db';

/**
 * "Jump to horse" quick-switcher (W19). Cmd/Ctrl+K opens it anywhere; type to
 * filter, ↑/↓ to move, Enter to open the horse, Esc to close. Horses load
 * lazily on first open.
 */
export function QuickSwitcher() {
  const { org } = useOrg();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [horses, setHorses] = useState<HorseRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global open shortcut. Resets live here (event handler) so we never setState
  // synchronously inside an effect.
  useEffect(() => {
    function reset() {
      setQuery('');
      setActive(0);
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        reset();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lazy-load horses the first time it opens.
  useEffect(() => {
    if (!open || horses !== null || !org) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listHorses(getBrowserSupabase(), org.id);
        if (!cancelled) setHorses(rows);
      } catch {
        if (!cancelled) setHorses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, horses, org]);

  useEffect(() => {
    if (!open) return undefined;
    // Focus after the dialog paints (no setState here).
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const term = query.trim().toLowerCase();
  const matches = (horses ?? []).filter((h) => term === '' || h.name.toLowerCase().includes(term));
  const clampedActive = Math.min(active, Math.max(0, matches.length - 1));

  function go(horse: HorseRow | undefined) {
    if (!horse) return;
    setOpen(false);
    router.push(`/horses/${horse.id}`);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(matches[clampedActive]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Jump to horse"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-raised)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={16} className="text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Jump to horse…"
            className="h-11 flex-1 bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-tertiary"
            aria-label="Search horses"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {horses === null ? (
            <li className="px-4 py-3 text-[13px] text-text-tertiary">Loading horses…</li>
          ) : matches.length === 0 ? (
            <li className="px-4 py-3 text-[13px] text-text-tertiary">No horses match.</li>
          ) : (
            matches.map((h, i) => (
              <li key={h.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] ${
                    i === clampedActive ? 'bg-surface-muted text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <HorseIcon size={15} />
                  </span>
                  <span className="truncate">{h.name}</span>
                  {h.discipline ? (
                    <span className="ml-auto truncate text-[12px] text-text-tertiary">{h.discipline}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-line px-4 py-2 text-[11px] text-text-tertiary">
          ↑↓ to move · Enter to open · Esc to close · ⌘K toggles
        </div>
      </div>
    </div>
  );
}
