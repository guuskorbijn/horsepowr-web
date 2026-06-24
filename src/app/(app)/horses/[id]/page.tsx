import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/StatusPill';
import { SessionsList } from '@/components/sessions/SessionsList';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getHorse } from '@/data/horseRepository';
import { listSessionsForHorse } from '@/data/sessionRepository';
import type { HorseRow, SessionRow } from '@/types/db';

type LoadResult =
  | { status: 'ok'; horse: HorseRow; sessions: SessionRow[] }
  | { status: 'not-found' }
  | { status: 'error' };

async function load(id: string): Promise<LoadResult> {
  await requireSessionContext();
  try {
    const supa = await getServerSupabase();
    const horse = await getHorse(supa, id);
    if (!horse) return { status: 'not-found' };
    const sessions = await listSessionsForHorse(supa, id);
    return { status: 'ok', horse, sessions };
  } catch {
    return { status: 'error' };
  }
}

export default async function HorseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await load(id);

  if (result.status === 'not-found') notFound();
  if (result.status === 'error') {
    return (
      <>
        <BackLink />
        <ErrorState description="Could not load this horse. Try again." />
      </>
    );
  }

  const { horse, sessions } = result;
  return (
    <>
      <BackLink />
      <PageHeader
        title={horse.name}
        description={horse.discipline ?? 'No discipline set'}
        action={horse.active ? undefined : <StatusPill tone="muted">Inactive</StatusPill>}
      />
      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Sessions recorded for this horse will appear here once synced."
        />
      ) : (
        <SessionsList sessions={sessions.map((session) => ({ session, horse }))} />
      )}
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary"
    >
      <ArrowLeft size={15} /> Command center
    </Link>
  );
}
