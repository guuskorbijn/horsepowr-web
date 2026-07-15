import { GitCompareArrows } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listHorses } from '@/data/horseRepository';
import { CompareView } from '@/components/compare/CompareView';
import { LogoWordmark } from '@/components/brand/Logo';
import { getServerT } from '@/i18n/server';
import type { HorseRow } from '@/types/db';

type LoadResult =
  | { status: 'ok'; horses: HorseRow[] }
  | { status: 'error' }
  | { status: 'no-org' };

async function load(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const horses = await listHorses(supa, ctx.org.id);
    return { status: 'ok', horses };
  } catch {
    return { status: 'error' };
  }
}

export default async function ComparePage() {
  const [result, t] = await Promise.all([load(), getServerT()]);

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
        <CompareView horses={result.horses} />
      )}
    </>
  );
}
