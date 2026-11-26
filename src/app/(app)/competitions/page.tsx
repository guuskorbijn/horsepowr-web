import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/states';
import { CompetitionBoard } from '@/components/competitions/CompetitionBoard';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listEventsInWindow } from '@/data/calendarRepository';
import { listChecklistsForEvents } from '@/data/templateRepository';
import { listHorses } from '@/data/horseRepository';
import { listOrgProfiles } from '@/data/profileRepository';
import { groupCompetitions, type CompetitionGroup } from '@/services/competitionService';
import { getServerT } from '@/i18n/server';
import { log } from '@/lib/log';

type LoadResult =
  | {
      status: 'ok';
      groups: CompetitionGroup[];
      orgId: string;
      canEdit: boolean;
      horseNames: Record<string, string>;
      peopleNames: Record<string, string>;
    }
  | { status: 'error' };

const DAY = 86_400_000;

async function load(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'error' };
  try {
    const supa = await getServerSupabase();
    const now = Date.now();
    const [events, horses, people] = await Promise.all([
      listEventsInWindow(supa, {
        orgId: ctx.org.id,
        startUtc: new Date(now - 2 * DAY).toISOString(),
        endUtc: new Date(now + 120 * DAY).toISOString(),
      }),
      listHorses(supa, ctx.org.id),
      listOrgProfiles(supa, ctx.org.id),
    ]);
    const competitions = events.filter(
      (e) => e.type === 'competition' && Date.parse(e.starts_at) >= now - 2 * DAY,
    );
    const checklists = await listChecklistsForEvents(supa, competitions.map((e) => e.id));
    return {
      status: 'ok',
      groups: groupCompetitions(competitions, checklists),
      orgId: ctx.org.id,
      canEdit: ctx.capabilities.canEdit,
      horseNames: Object.fromEntries(horses.map((h) => [h.id, h.name])),
      peopleNames: Object.fromEntries(people.map((p) => [p.id, p.name ?? p.email ?? ''])),
    };
  } catch (err) {
    log.error('competitions: load failed', { error: err instanceof Error ? err.message : String(err) });
    return { status: 'error' };
  }
}

/** Upcoming shows: entries per show, riders, and what still has to be ready. */
export default async function CompetitionsPage() {
  const [result, t] = await Promise.all([load(), getServerT()]);
  return (
    <>
      <PageHeader title={t('competitions.title')} description={t('competitions.description')} />
      {result.status === 'error' ? (
        <ErrorState description={t('competitions.errorLoad')} />
      ) : (
        <CompetitionBoard
          groups={result.groups}
          orgId={result.orgId}
          canEdit={result.canEdit}
          horseNames={result.horseNames}
          peopleNames={result.peopleNames}
        />
      )}
    </>
  );
}
