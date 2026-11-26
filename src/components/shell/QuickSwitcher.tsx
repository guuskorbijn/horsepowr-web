'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  CalendarDays,
  CalendarPlus,
  Contact,
  CornerDownLeft,
  FileUp,
  HeartPulse,
  LayoutDashboard,
  Search,
  Settings,
  Trophy,
} from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { useCan } from '@/components/shell/SessionContext';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { listHorses } from '@/data/horseRepository';
import { listSessionsForHorse } from '@/data/sessionRepository';
import { HorseIcon } from '@/components/icons/HorseIcon';
import { useTranslation } from '@/i18n/LocaleProvider';
import { rankCommands, type Command } from '@/services/commandSearch';
import { log } from '@/lib/log';
import { cn } from '@/lib/cn';
import type { HorseRow } from '@/types/db';

/**
 * ⌘K: one keyboard-first entry to everything. Actions ("Plan something…",
 * "Import a ride"), pages, and per horse its profile, agenda and LATEST
 * session. Ranked by a small pure scorer (prefix > word start > contains).
 */

type IconType = ComponentType<{ size?: number; className?: string }>;
interface PaletteItem extends Command {
  icon: IconType;
  group: 'actions' | 'pages' | 'horses';
  run: () => void | Promise<void>;
}

export function QuickSwitcher() {
  const { org } = useOrg();
  const canEdit = useCan('canEdit');
  const canImport = useCan('canImport');
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [horses, setHorses] = useState<HorseRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuery('');
        setActive(0);
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open || horses !== null || !org) return;
    let cancelled = false;
    listHorses(getBrowserSupabase(), org.id)
      .then((rows) => {
        if (!cancelled) setHorses(rows);
      })
      .catch((err: unknown) => {
        log.warn('palette: horses unavailable', { error: err instanceof Error ? err.message : String(err) });
        if (!cancelled) setHorses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, horses, org]);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => router.push(href);
    const list: PaletteItem[] = [];
    if (canEdit) {
      list.push({
        id: 'plan', label: t('palette.plan'), keywords: 'new nieuw plan training afspraak add toevoegen',
        icon: CalendarPlus, group: 'actions', run: go('/agenda?compose=1'),
      });
    }
    if (canImport) {
      list.push({
        id: 'import', label: t('palette.import'), keywords: 'polar tcx gpx fit csv import rit ride',
        icon: FileUp, group: 'actions', run: go('/sessions/import'),
      });
    }
    const pages: Array<[string, string, IconType, string]> = [
      ['/', t('nav.commandCenter'), LayoutDashboard, 'home dashboard'],
      ['/agenda', t('nav.agenda'), CalendarDays, 'calendar kalender week'],
      ['/competitions', t('nav.competitions'), Trophy, 'wedstrijd show concours'],
      ['/sessions', t('nav.sessions'), Activity, 'trainingen ritten'],
      ['/contacts', t('nav.contacts'), Contact, 'dierenarts hoefsmid eigenaar vet farrier'],
      ['/settings', t('nav.settings'), Settings, 'instellingen polar'],
    ];
    for (const [href, label, icon, keywords] of pages) {
      list.push({ id: `page:${href}`, label, keywords, icon, group: 'pages', run: go(href) });
    }
    for (const h of horses ?? []) {
      list.push(
        { id: `h:${h.id}`, label: h.name, hint: t('palette.profile'), keywords: h.discipline ?? '', icon: HorseIcon, group: 'horses', run: go(`/horses/${h.id}`) },
        { id: `ha:${h.id}`, label: `${h.name} → ${t('nav.agenda')}`, keywords: 'agenda', icon: CalendarDays, group: 'horses', run: go(`/horses/${h.id}/agenda`) },
        {
          id: `hs:${h.id}`, label: `${h.name} → ${t('palette.latestSession')}`, keywords: 'laatste latest sessie session',
          icon: HeartPulse, group: 'horses',
          run: async () => {
            try {
              const [latest] = await listSessionsForHorse(getBrowserSupabase(), h.id, { limit: 1 });
              router.push(latest ? `/sessions/${latest.id}` : `/horses/${h.id}`);
            } catch (err) {
              log.warn('palette: latest session lookup failed', { error: err instanceof Error ? err.message : String(err) });
              router.push(`/horses/${h.id}`);
            }
          },
        },
      );
    }
    return list;
  }, [canEdit, canImport, horses, router, t]);

  if (!open) return null;

  const ranked = rankCommands(items, query, query.trim() === '' ? 12 : 30);
  const clamped = Math.min(active, Math.max(0, ranked.length - 1));
  const run = (item: PaletteItem | undefined): void => {
    if (!item) return;
    setOpen(false);
    void item.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={t('palette.label')}
    >
      <div
        className="hp-toast-in w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-raised)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={16} className="text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, ranked.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(ranked[clamped]);
              }
            }}
            placeholder={t('palette.placeholder')}
            className="h-12 flex-1 bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-tertiary"
            aria-label={t('palette.label')}
          />
        </div>
        <ul className="max-h-80 overflow-y-auto py-1.5">
          {ranked.length === 0 ? (
            <li className="px-4 py-3 text-[13px] text-text-tertiary">{t('palette.noMatch')}</li>
          ) : (
            ranked.map((item, i) => {
              const Icon = item.icon;
              const showGroup = i === 0 || ranked[i - 1]?.group !== item.group;
              return (
                <li key={item.id}>
                  {showGroup ? (
                    <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                      {t(`palette.group.${item.group}`)}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(item)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left text-[14px]',
                      i === clamped ? 'bg-primary-soft text-text-primary' : 'text-text-secondary',
                    )}
                  >
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', i === clamped ? 'bg-primary text-on-primary' : 'bg-surface-muted text-text-secondary')}>
                      <Icon size={15} />
                    </span>
                    <span className="truncate">{item.label}</span>
                    {item.hint ? <span className="ml-auto truncate text-[12px] text-text-tertiary">{item.hint}</span> : null}
                    {i === clamped ? <CornerDownLeft size={13} className="ml-auto shrink-0 text-text-tertiary" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex gap-4 border-t border-line px-4 py-2 text-[11px] text-text-tertiary">
          <span>↑↓ {t('palette.move')}</span>
          <span>↵ {t('palette.open')}</span>
          <span>Esc {t('palette.close')}</span>
          <span className="ml-auto">⌘K</span>
        </div>
      </div>
    </div>
  );
}
