import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getHorsesWithLastSession } from '@/services/sessionListService';
import { CommandCenter } from '@/components/command/CommandCenter';
import type { HorseLastSession } from '@/types/view';

type LoadResult =
  | { status: 'ok'; horses: HorseLastSession[] }
  | { status: 'error' }
  | { status: 'no-org' };

async function load(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const horses = await getHorsesWithLastSession(supa, ctx.org.id);
    return { status: 'ok', horses };
  } catch {
    return { status: 'error' };
  }
}

export default async function CommandCenterPage() {
  const result = await load();

  return (
    <>
      <PageHeader
        title="Command center"
        description="Your stable at a glance — horses by location with their latest session."
      />
      {result.status === 'error' ? (
        <ErrorState description="Could not load your stable. Check your connection and try again." />
      ) : result.status === 'no-org' || result.horses.length === 0 ? (
        <EmptyState
          icon={<LayoutDashboard size={28} />}
          title="No horses yet"
          description="Add your first horse to start tracking. Recording happens in the mobile app."
        />
      ) : (
        <CommandCenter horses={result.horses} />
      )}
    </>
  );
}
