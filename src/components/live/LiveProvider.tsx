'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { useTranslation } from '@/i18n/LocaleProvider';
import { log } from '@/lib/log';
import { describeLiveChange, toLiveChange, type LiveChange, type LiveTable } from '@/services/live/liveChange';

/**
 * Live collaboration for the whole web app.
 *
 * One Realtime channel per signed-in org. When someone ELSE changes the
 * agenda, a session, the Polar inbox or a health note, the current page is
 * re-rendered from the server (debounced, so a burst of writes is one
 * refresh) and a quiet toast says who did what. Items changed in the last
 * few seconds are exposed so a card can glow "just now · Maud".
 *
 * Realtime applies each table's RLS per subscriber, so nobody receives a row
 * they could not read anyway. Own writes are ignored (the page that made
 * them already shows them).
 */

const TABLES: readonly LiveTable[] = [
  'calendar_events',
  'calendar_event_overrides',
  'sessions',
  'polar_inbox',
  'horse_health_records',
  'event_checklist_items',
];
const REFRESH_DEBOUNCE_MS = 350;
const RECENT_MS = 6000;
const TOAST_MS = 4500;

interface LiveContextValue {
  connected: boolean;
  /** Entity id -> who changed it, for ~6 s after the change. */
  recent: ReadonlyMap<string, { by: string | null; at: number }>;
}

const LiveContext = createContext<LiveContextValue>({ connected: false, recent: new Map() });

export function useLive(): LiveContextValue {
  return useContext(LiveContext);
}

interface Toast {
  id: number;
  text: string;
}

export function LiveProvider({
  orgId,
  userId,
  people,
  children,
}: {
  orgId: string | null;
  userId: string;
  people: ReadonlyArray<{ id: string; label: string }>;
  children: ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [recent, setRecent] = useState<Map<string, { by: string | null; at: number }>>(new Map());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);
  const names = useMemo(() => new Map(people.map((p) => [p.id, p.label])), [people]);
  const latest = useRef({ t, names, userId });
  useEffect(() => {
    latest.current = { t, names, userId };
  });

  const onChange = useCallback(
    (change: LiveChange) => {
      const { t: tr, names: nm, userId: me } = latest.current;
      if (change.actorId !== null && change.actorId === me) return;
      const now = Date.now();
      setRecent((prev) => {
        const next = new Map([...prev].filter(([, v]) => now - v.at < RECENT_MS));
        if (change.entityId !== null) next.set(change.entityId, { by: change.actorId, at: now });
        return next;
      });
      const text = describeLiveChange(change, (id) => (id === null ? null : (nm.get(id) ?? null)), tr);
      if (text !== null) {
        const id = nextId.current++;
        setToasts((prev) => [...prev.slice(-2), { id, text }]);
        setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), TOAST_MS);
      }
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    },
    [router],
  );

  useEffect(() => {
    if (orgId === null) return;
    const supa = getBrowserSupabase();
    let channel = supa.channel(`live:${orgId}`);
    for (const table of TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          const row = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) as Record<
            string,
            unknown
          >;
          onChange(toLiveChange({ table, kind: payload.eventType, row }));
        },
      );
    }
    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        log.warn('live: realtime channel unavailable', { status });
      }
    });
    return () => {
      void supa.removeChannel(channel);
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [orgId, onChange]);

  const value = useMemo(() => ({ connected, recent }), [connected, recent]);

  return (
    <LiveContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="hp-toast-in pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] text-text-primary shadow-lg"
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </LiveContext.Provider>
  );
}

/** "● Live" in the top bar: the proof that what you see is current. */
export function LiveBadge() {
  const { connected } = useLive();
  const { t } = useTranslation();
  return (
    <span
      title={connected ? t('live.connectedHint') : t('live.offlineHint')}
      className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-text-secondary sm:inline-flex"
    >
      <span className="relative flex h-2 w-2">
        {connected ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /> : null}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-success' : 'bg-text-tertiary'}`} />
      </span>
      {connected ? t('live.connected') : t('live.offline')}
    </span>
  );
}
