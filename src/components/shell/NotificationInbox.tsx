'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CalendarClock, Syringe, Watch } from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { useLive } from '@/components/live/LiveProvider';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { listPendingInbox } from '@/data/polarRepository';
import { listExpiringCandidates } from '@/data/healthRecordRepository';
import { listHorses } from '@/data/horseRepository';
import { loadAgenda } from '@/services/calendar/agendaLoader';
import { expiringRecords } from '@/services/health/healthReminders';
import { buildInbox, type InboxEntry } from '@/services/inboxService';
import { useReaderTimeZone } from '@/lib/readerTimeZoneContext';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatDayKey } from '@/services/format';
import { log } from '@/lib/log';
import { cn } from '@/lib/cn';

/**
 * One place for what needs attention: rides from Polar waiting for a horse,
 * vaccinations expiring, and your own items in the next 48 hours. Unseen
 * entries make the bell show a count; opening the panel marks them seen
 * (per browser — a convenience, not a record). Refreshes on live changes.
 */

const SEEN_KEY = 'hp:inbox-seen';

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Iterable<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-300)));
  } catch {
    // Private mode / blocked storage: the badge just stays honest per session.
  }
}

const ICONS = { polar: Watch, health: Syringe, task: CalendarClock } as const;

export function NotificationInbox({ userId }: { userId: string }) {
  const { org } = useOrg();
  const { recent } = useLive();
  const { t } = useTranslation();
  const timeZone = useReaderTimeZone();
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (): Promise<InboxEntry[]> => {
    if (!org) return [];
    const supa = getBrowserSupabase();
    const today = new Date().toISOString().slice(0, 10);
    const [polar, health, horses, week] = await Promise.all([
      listPendingInbox(supa, 20).catch(() => []),
      listExpiringCandidates(supa, org.id).catch(() => []),
      listHorses(supa, org.id).catch(() => []),
      loadAgenda(supa, {
        orgId: org.id,
        view: 'week',
        anchorDayKey: null,
        filters: { assigneeId: userId },
        readerTimeZone: timeZone,
        nowIso: new Date().toISOString(),
      }).catch((err: unknown) => {
        log.warn('inbox: agenda unavailable', { error: err instanceof Error ? err.message : String(err) });
        return null;
      }),
    ]);
    return buildInbox({
      todayKey: today,
      polar,
      reminders: expiringRecords(health, today, 21),
      agendaDays: week?.agenda.days ?? [],
      horseNames: new Map(horses.map((h) => [h.id, h.name])),
      t,
    });
  }, [org, userId, timeZone, t]);

  useEffect(() => {
    let alive = true;
    void load().then((next) => {
      if (!alive) return;
      setEntries(next);
      setSeen(readSeen());
    });
    return () => {
      alive = false;
    };
  }, [load, recent.size]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const unseen = entries.filter((e) => !seen.has(e.id)).length;

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        aria-label={t('inbox.label')}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          const all = new Set([...seen, ...entries.map((e) => e.id)]);
          writeSeen(all);
          setSeen(all);
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted hover:text-text-primary"
      >
        <Bell size={18} />
        {unseen > 0 ? (
          <span className="hp-toast-in absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-on-accent">
            {unseen > 9 ? '9+' : unseen}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="hp-toast-in absolute right-0 top-12 z-40 w-[22rem] overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-raised)]">
          <p className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-text-primary">{t('inbox.title')}</p>
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-text-secondary">{t('inbox.empty')}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {entries.map((entry) => {
                const Icon = ICONS[entry.kind];
                return (
                  <li key={entry.id}>
                    <Link
                      href={entry.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-muted"
                    >
                      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md', entry.urgent ? 'bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)]' : 'bg-primary-soft text-primary')}>
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-text-primary">{entry.title}</span>
                        <span className="block truncate text-[12px] text-text-secondary">
                          {entry.dayKey ? `${formatDayKey(entry.dayKey)} · ` : ''}
                          {entry.detail}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
