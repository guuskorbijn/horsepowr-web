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
import { listOrgProfiles } from '@/data/profileRepository';
import { buildAgendaWeek, weekWindow } from '@/services/calendar/agendaWeekService';
import { AgendaWeekGrid } from '@/components/agenda/AgendaWeekGrid';
import type { AgendaWeek } from '@/services/calendar/agendaWeekService';
import type { HorseRow, LocationRow, ProfileRow } from '@/types/db';

interface AgendaData {
  week: AgendaWeek;
  horseNames: Record<string, string>;
  horses: HorseRow[];
  locations: LocationRow[];
  assignees: ProfileRow[];
  canEdit: boolean;
  orgId: string;
  userId: string;
}

type LoadResult =
  | ({ status: 'ok' } & AgendaData)
  | { status: 'error' }
  | { status: 'no-org' };

/**
 * The agenda, a week at a time.
 *
 * A week rather than the phone's day, because that is the one place the two
 * products should genuinely differ: a laptop has the room, and planning a week
 * is desk work while executing a day is not.
 *
 * Readable by everyone in the org, writable by a trainer — the same split RLS
 * enforces, mirrored in the UI so a read-only role is never shown a button the
 * database would refuse. The write path itself is plain and online; the
 * repository explains why it does not reproduce the phone's offline outbox.
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
    const [horses, assignees] = await Promise.all([
      listHorses(supa, ctx.org.id),
      listOrgProfiles(supa, ctx.org.id),
    ]);

    const horseNames: Record<string, string> = {};
    for (const horse of horses) horseNames[horse.id] = horse.name;

    return {
      status: 'ok',
      week: buildAgendaWeek({ window, events, overrides }),
      horseNames,
      horses,
      locations: ctx.locations,
      assignees,
      canEdit: ctx.capabilities.canEdit,
      orgId: ctx.org.id,
      userId: ctx.userId,
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
          canEdit={result.canEdit}
          orgId={result.orgId}
          userId={result.userId}
          horses={result.horses}
          locations={result.locations}
          assignees={result.assignees}
        />
      )}
    </>
  );
}
