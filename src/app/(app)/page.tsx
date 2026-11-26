import { LayoutDashboard } from 'lucide-react';
import { DashboardHero } from '@/components/command/DashboardHero';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getHorsesWithLastSession } from '@/services/sessionListService';
import { CommandCenter } from '@/components/command/CommandCenter';
import { getServerT } from '@/i18n/server';
import type { HorseLastSession } from '@/types/view';
import { HealthRemindersCard } from '@/components/command/HealthRemindersCard';
import { listExpiringCandidates } from '@/data/healthRecordRepository';
import { expiringRecords, type HealthReminder } from '@/services/health/healthReminders';
import { log } from '@/lib/log';
import { HomeOverview } from '@/components/command/HomeOverview';
import { loadAgenda } from '@/services/calendar/agendaLoader';
import { buildHomeOverview, type HomeOverview as Overview } from '@/services/home/homeService';
import { getReaderTimeZone } from '@/lib/readerTimeZone.server';

type LoadResult =
  | {
      status: 'ok';
      horses: HorseLastSession[];
      reminders: HealthReminder[];
      overview: Overview | null;
      horseNames: Record<string, string>;
      peopleNames: Record<string, string>;
    }
  | { status: 'error' }
  | { status: 'no-org' };

async function load(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const reader = await getReaderTimeZone();
    const [horses, candidates, week] = await Promise.all([
      getHorsesWithLastSession(supa, ctx.org.id),
      // Reminders are an extra on this page, never a reason it fails.
      listExpiringCandidates(supa, ctx.org.id).catch((err: unknown) => {
        log.error('dashboard: health reminders unavailable', {
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
      // The overview is the top of the page; the horse cards still render if it fails.
      loadAgenda(supa, {
        orgId: ctx.org.id,
        view: 'week',
        anchorDayKey: null,
        filters: {},
        readerTimeZone: reader.timeZone,
        nowIso: new Date().toISOString(),
      }).catch((err: unknown) => {
        log.error('dashboard: week overview unavailable', {
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const overview =
      week === null
        ? null
        : buildHomeOverview({
            agenda: week.agenda,
            userId: ctx.userId,
            horses: week.horses.map((h) => ({ id: h.id, name: h.name, active: h.active })),
          });
    return {
      status: 'ok',
      horses,
      reminders: expiringRecords(candidates, today),
      overview,
      horseNames: Object.fromEntries((week?.horses ?? []).map((h) => [h.id, h.name])),
      peopleNames: Object.fromEntries(
        (week?.assignees ?? []).map((p) => [p.id, p.name ?? p.email ?? '']),
      ),
    };
  } catch {
    return { status: 'error' };
  }
}

export default async function CommandCenterPage() {
  const [result, t, ctx] = await Promise.all([
    load(),
    getServerT(),
    requireSessionContext(),
  ]);
  const orgName = ctx.org?.name ?? null;
  const orgLogoUrl = ctx.org?.logo_url ?? null;

  return (
    <>
      <DashboardHero
        title={t('command.title')}
        description={t('command.description')}
        orgName={orgName}
        orgLogoUrl={orgLogoUrl}
      />
      {result.status === 'error' ? (
        <ErrorState description={t('command.errorLoad')} />
      ) : result.status === 'no-org' || result.horses.length === 0 ? (
        <EmptyState
          icon={<LayoutDashboard size={28} />}
          title={t('command.emptyTitle')}
          description={t('command.emptyDescription')}
        />
      ) : (
        <>
          {result.overview !== null ? (
            <HomeOverview
              overview={result.overview}
              horseNames={result.horseNames}
              peopleNames={result.peopleNames}
            />
          ) : null}
          <HealthRemindersCard
            reminders={result.reminders}
            horseNames={new Map(result.horses.map((h) => [h.horse.id, h.horse.name]))}
            t={t}
          />
          <CommandCenter horses={result.horses} />
        </>
      )}
    </>
  );
}
