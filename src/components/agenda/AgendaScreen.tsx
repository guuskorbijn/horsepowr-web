import { CalendarDays } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { AgendaBoard } from '@/components/agenda/AgendaBoard';
import { AgendaToolbar } from '@/components/agenda/AgendaToolbar';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getReaderTimeZone } from '@/lib/readerTimeZone.server';
import { getServerT } from '@/i18n/server';
import { log } from '@/lib/log';
import { loadAgenda, type AgendaPayload } from '@/services/calendar/agendaLoader';
import type { AgendaQuery } from '@/services/calendar/agendaQuery';
import type { LocationRow } from '@/types/db';

type LoadResult =
  | ({ status: 'ok' } & AgendaPayload & {
      locations: LocationRow[];
      canEdit: boolean;
      orgId: string;
      userId: string;
      readerTimeZoneIsFallback: boolean;
    })
  | { status: 'error' }
  | { status: 'no-org' };

async function load(query: AgendaQuery): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const [supa, reader] = await Promise.all([getServerSupabase(), getReaderTimeZone()]);
    const payload = await loadAgenda(supa, {
      orgId: ctx.org.id,
      view: query.view,
      anchorDayKey: query.date,
      filters: {
        ...(query.horseId !== null ? { horseId: query.horseId } : {}),
        ...(query.assigneeId !== null ? { assigneeId: query.assigneeId } : {}),
      },
      readerTimeZone: reader.timeZone,
      nowIso: new Date().toISOString(),
    });
    return {
      status: 'ok',
      ...payload,
      locations: ctx.locations,
      canEdit: ctx.capabilities.canEdit,
      orgId: ctx.org.id,
      userId: ctx.userId,
      readerTimeZoneIsFallback: reader.isFallback,
    };
  } catch (err: unknown) {
    log.error('agenda: could not load', { error: err instanceof Error ? err.message : String(err) });
    return { status: 'error' };
  }
}

/**
 * The agenda body shared by the stable agenda and a horse's own agenda.
 *
 * Readable by everyone in the org, writable by a trainer — the split RLS
 * enforces, mirrored here so a read-only role is never shown a button the
 * database would refuse. Data is fetched here (server); the board and the
 * toolbar are the only client components.
 */
export async function AgendaScreen({
  basePath,
  query,
  lockedHorse,
}: {
  basePath: string;
  query: AgendaQuery;
  lockedHorse: boolean;
}) {
  const [result, t] = await Promise.all([load(query), getServerT()]);

  if (result.status === 'error') return <ErrorState description={t('agenda.errorLoad')} />;
  if (result.status === 'no-org') {
    return (
      <EmptyState
        icon={<CalendarDays size={28} />}
        title={t('agenda.emptyTitle')}
        description={t('agenda.emptyDescription')}
      />
    );
  }

  const horseNames: Record<string, string> = {};
  for (const horse of result.horses) horseNames[horse.id] = horse.name;

  return (
    <>
      <AgendaToolbar
        basePath={basePath}
        query={query}
        span={result.agenda.window}
        showsToday={result.agenda.days.some((day) => day.isToday)}
        horses={result.horses.map((horse) => ({ id: horse.id, label: horse.name }))}
        people={result.assignees.map((person) => ({
          id: person.id,
          label: person.name ?? person.email ?? person.id,
        }))}
        lockedHorse={lockedHorse}
      />
      <AgendaBoard
        agenda={result.agenda}
        horseNames={horseNames}
        readerTimeZoneIsFallback={result.readerTimeZoneIsFallback}
        defaults={{ horseId: query.horseId, assigneeId: query.assigneeId }}
        canEdit={result.canEdit}
        orgId={result.orgId}
        userId={result.userId}
        horses={result.horses}
        locations={result.locations}
        assignees={result.assignees}
      />
    </>
  );
}
