import { CalendarDays } from 'lucide-react';
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
import { buildAgendaWeek, weekWindow } from '@/services/calendar/agendaWeekService';
import { AgendaWeekGrid } from '@/components/agenda/AgendaWeekGrid';
import type { AgendaWeek } from '@/services/calendar/agendaWeekService';

type LoadResult =
  | { status: 'ok'; week: AgendaWeek; horseNames: Record<string, string> }
  | { status: 'error' }
  | { status: 'no-org' };

/**
 * The agenda, a week at a time.
 *
 * A week rather than the phone's day, because that is the one place the two
 * products should genuinely differ: a laptop has the room, and planning a week
 * is desk work while executing a day is not.
 *
 * Read-only in this build. Writing an agenda item from the browser is a
 * separate piece of work — not because the UI is hard, but because the mobile
 * write path is built around an offline outbox and a conflict policy, and a
 * browser needs neither. Mirroring that machinery would be mirroring the hard
 * part for none of the benefit.
 */
async function load(anchorDayKey: string | null): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const window = weekWindow(anchorDayKey);

    const events = await listEventsForRange(supa, window.startUtc, window.endUtc);
    const overrides = await listOverridesForEvents(
      supa,
      events.map((event) => event.id),
    );
    const horses = await listHorses(supa, ctx.org.id);

    const horseNames: Record<string, string> = {};
    for (const horse of horses) horseNames[horse.id] = horse.name;

    return {
      status: 'ok',
      week: buildAgendaWeek({ window, events, overrides }),
      horseNames,
    };
  } catch {
    return { status: 'error' };
  }
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const [result, t] = await Promise.all([
    load(params.week ?? null),
    getServerT(),
  ]);

  const empty =
    result.status === 'ok' &&
    result.week.days.every((day) => day.occurrences.length === 0);

  return (
    <>
      <PageHeader title={t('agenda.title')} description={t('agenda.description')} />
      {result.status === 'error' ? (
        <ErrorState description={t('agenda.errorLoad')} />
      ) : result.status === 'no-org' ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={t('agenda.emptyTitle')}
          description={t('agenda.emptyDescription')}
        />
      ) : (
        <AgendaWeekGrid
          week={result.week}
          horseNames={result.horseNames}
          empty={empty}
        />
      )}
    </>
  );
}
