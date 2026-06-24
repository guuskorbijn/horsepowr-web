import { Activity } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getOrgSessions } from '@/services/sessionListService';
import { SessionsList } from '@/components/sessions/SessionsList';
import type { SessionWithHorse } from '@/types/view';

type LoadResult =
  | { status: 'ok'; sessions: SessionWithHorse[] }
  | { status: 'error' }
  | { status: 'no-org' };

async function loadSessions(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const sessions = await getOrgSessions(supa, ctx.org.id, { finishedOnly: false });
    return { status: 'ok', sessions };
  } catch {
    return { status: 'error' };
  }
}

export default async function SessionsPage() {
  const result = await loadSessions();

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Every recorded session, newest first. Open one for the deep view."
      />
      {result.status === 'error' ? (
        <ErrorState description="Could not load sessions. Check your connection and try again." />
      ) : result.status === 'no-org' || result.sessions.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} />}
          title="No sessions yet"
          description="Sessions recorded on the mobile app and synced to Supabase appear here."
        />
      ) : (
        <SessionsList sessions={result.sessions} />
      )}
    </>
  );
}
