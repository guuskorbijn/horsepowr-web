import { TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listHorses } from '@/data/horseRepository';
import { TrendsView } from '@/components/trends/TrendsView';
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

export default async function TrendsPage() {
  const [result, t] = await Promise.all([load(), getServerT()]);

  return (
    <>
      <PageHeader title={t('trendsPage.title')} description={t('trendsPage.description')} />
      {result.status === 'error' ? (
        <ErrorState description={t('trendsPage.errorLoad')} />
      ) : result.status === 'no-org' || result.horses.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={28} />}
          title={t('trendsPage.emptyTitle')}
          description={t('trendsPage.emptyDescription')}
        />
      ) : (
        <TrendsView horses={result.horses} />
      )}
    </>
  );
}
