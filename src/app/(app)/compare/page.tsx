import { GitCompareArrows } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listHorses } from '@/data/horseRepository';
import { CompareView } from '@/components/compare/CompareView';
import { LogoWordmark } from '@/components/brand/Logo';
import { getServerT } from '@/i18n/server';
import { resolveStartingHorse } from '@/services/startingHorse';
import { log } from '@/lib/log';
import type { HorseRow } from '@/types/db';

type LoadResult =
  | { status: 'ok'; horses: HorseRow[]; startingHorseId: string | null }
  | { status: 'error' }
  | { status: 'no-org' };

async function load(requestedHorse: string | null): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const horses = await listHorses(supa, ctx.org.id);
    const startingHorseId = await resolveStartingHorse(supa, horses, requestedHorse);
    return { status: 'ok', horses, startingHorseId };
  } catch (err: unknown) {
    log.error('analysis page: could not load', { error: err instanceof Error ? err.message : String(err) });
    return { status: 'error' };
  }
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ horse?: string }>;
}) {
  const params = await searchParams;
  const [result, t] = await Promise.all([load(params.horse ?? null), getServerT()]);

  return (
    <>
      <div className="print-only mb-4">
        <LogoWordmark />
      </div>
      <PageHeader title={t('comparePage.title')} description={t('comparePage.description')} />
      {result.status === 'error' ? (
        <ErrorState description={t('comparePage.errorLoad')} />
      ) : result.status === 'no-org' || result.horses.length === 0 ? (
        <EmptyState
          icon={<GitCompareArrows size={28} />}
          title={t('comparePage.emptyTitle')}
          description={t('comparePage.emptyDescription')}
        />
      ) : (
        <CompareView horses={result.horses} startingHorseId={result.startingHorseId} />
      )}
    </>
  );
}
