import { GitCompareArrows } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listHorses } from '@/data/horseRepository';
import { CompareView } from '@/components/compare/CompareView';
import { LogoWordmark } from '@/components/brand/Logo';
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
  const result = await load();

  return (
    <>
      <div className="print-only mb-4">
        <LogoWordmark />
      </div>
      <PageHeader
        title="Compare"
        description="Overlay two or more sessions of the same horse on a shared elapsed-time axis."
      />
      {result.status === 'error' ? (
        <ErrorState description="Could not load horses. Try again." />
      ) : result.status === 'no-org' || result.horses.length === 0 ? (
        <EmptyState
          icon={<GitCompareArrows size={28} />}
          title="No horses to compare yet"
          description="Add horses and record sessions in the mobile app first."
        />
      ) : (
        <CompareView horses={result.horses} />
      )}
    </>
  );
}
