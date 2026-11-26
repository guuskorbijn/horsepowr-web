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

type LoadResult =
  | { status: 'ok'; horses: HorseLastSession[]; reminders: HealthReminder[] }
  | { status: 'error' }
  | { status: 'no-org' };

async function load(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const [horses, candidates] = await Promise.all([
      getHorsesWithLastSession(supa, ctx.org.id),
      // Reminders are an extra on this page, never a reason it fails.
      listExpiringCandidates(supa, ctx.org.id).catch((err: unknown) => {
        log.error('dashboard: health reminders unavailable', {
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return { status: 'ok', horses, reminders: expiringRecords(candidates, today) };
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
