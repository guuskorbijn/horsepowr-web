import { TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listHorses } from '@/data/horseRepository';
import { TrendsView } from '@/components/trends/TrendsView';
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
  const result = await load();

  return (
    <>
      <PageHeader
        title="Trends"
        description="Descriptive trends over time — the measured numbers, plotted. No grades, no baselines."
      />
      {result.status === 'error' ? (
        <ErrorState description="Could not load horses. Try again." />
      ) : result.status === 'no-org' || result.horses.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={28} />}
          title="No horses yet"
          description="Add horses and record sessions in the mobile app to see trends."
        />
      ) : (
        <TrendsView horses={result.horses} />
      )}
    </>
  );
}
