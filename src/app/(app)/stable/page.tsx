import { LayoutGrid } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getServerT } from '@/i18n/server';
import {
  listEventsForRange,
  listOverridesForEvents,
} from '@/data/calendarRepository';
import { listHorses } from '@/data/horseRepository';
import { listSessionsForHorses } from '@/data/sessionRepository';
import { buildAgendaWeek, weekWindow } from '@/services/calendar/agendaWeekService';
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
    const supa = await getServerSupabase();
    const window = weekWindow(anchorDayKey);
    const horses = await listHorses(supa, ctx.org.id);

    const [events, sessions] = await Promise.all([
      listEventsForRange(supa, window.startUtc, window.endUtc),
      listSessionsForHorses(
        supa,
        horses.map((horse) => horse.id),
        { since: window.startUtc, until: window.endUtc },
      ),
    ]);
    const overrides = await listOverridesForEvents(
      supa,
      events.map((event) => event.id),
    );

    const agenda = buildAgendaWeek({ window, events, overrides });
    const occurrences = agenda.days.flatMap((day) => day.occurrences);

    return {
      status: 'ok',
      startDayKey: agenda.startDayKey,
      endDayKey: agenda.endDayKey,
      week: buildStableWeek({
        horses: horses.map((horse) => ({ id: horse.id, name: horse.name })),
        sessions,
        occurrences,
        nowMs: Date.now(),
      }),
    };
  } catch {
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
