import { LayoutGrid } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getServerT } from '@/i18n/server';
import {
  listEventsInWindow,
  listOverrides,
} from '@/data/calendarRepository';
import { listHorses } from '@/data/horseRepository';
import { listSessionsForHorses } from '@/data/sessionRepository';
import { agendaWindow, buildAgenda, todayDayKey } from '@/services/calendar/agendaService';
import { getReaderTimeZone } from '@/lib/readerTimeZone.server';
import { log } from '@/lib/log';
import { buildStableWeek } from '@/services/stable/stableWeekService';
import { StableWeekView } from '@/components/stable/StableWeekView';
import type { StableWeek } from '@/services/stable/stableWeekService';

/**
 * The stable's week.
 *
 * Reuses the agenda's own occurrence expansion rather than re-deriving which
 * plans fall in a week — a second expander would be a second set of
 * recurrence bugs.
 */
type LoadResult =
  | { status: 'ok'; week: StableWeek; startDayKey: string; endDayKey: string }
  | { status: 'error' }
  | { status: 'no-org' };

async function load(anchorDayKey: string | null): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const [supa, reader] = await Promise.all([getServerSupabase(), getReaderTimeZone()]);
    const nowIso = new Date().toISOString();
    const window = agendaWindow({
      view: 'week',
      anchorDayKey,
      readerTimeZone: reader.timeZone,
      nowIso,
    });
    const horses = await listHorses(supa, ctx.org.id);

    const [events, sessions] = await Promise.all([
      listEventsInWindow(supa, {
        orgId: ctx.org.id,
        startUtc: window.startUtc,
        endUtc: window.endUtc,
      }),
      listSessionsForHorses(
        supa,
        horses.map((horse) => horse.id),
        { since: window.startUtc, until: window.endUtc },
      ),
    ]);
    const overrides = await listOverrides(
      supa,
      events.map((event) => event.id),
    );

    const agenda = buildAgenda({
      window,
      events,
      overrides,
      todayKey: todayDayKey(nowIso, reader.timeZone),
    });
    const occurrences = agenda.days.flatMap((day) => day.items.map((item) => item.occurrence));

    return {
      status: 'ok',
      startDayKey: window.startDayKey,
      endDayKey: window.endDayKey,
      week: buildStableWeek({
        horses: horses.map((horse) => ({ id: horse.id, name: horse.name })),
        sessions,
        occurrences,
        nowMs: Date.now(),
      }),
    };
  } catch (err: unknown) {
    log.error('stable week: could not load', { error: err instanceof Error ? err.message : String(err) });
    return { status: 'error' };
  }
}

export default async function StablePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const [result, t] = await Promise.all([
    load(params.week ?? null),
    getServerT(),
  ]);

  return (
    <>
      <PageHeader title={t('stable.title')} description={t('stable.description')} />
      {result.status === 'error' ? (
        <ErrorState description={t('stable.errorLoad')} />
      ) : result.status === 'no-org' ? (
        <EmptyState
          icon={<LayoutGrid size={28} />}
          title={t('stable.emptyTitle')}
          description={t('stable.emptyDescription')}
        />
      ) : result.week.totals.horses === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={28} />}
          title={t('stable.noHorsesTitle')}
          description={t('stable.noHorsesDescription')}
        />
      ) : (
        <StableWeekView
          week={result.week}
          startDayKey={result.startDayKey}
          endDayKey={result.endDayKey}
        />
      )}
    </>
  );
}
