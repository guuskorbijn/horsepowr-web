import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/StatusPill';
import { SessionsList } from '@/components/sessions/SessionsList';
import { HorseAnalytics } from '@/components/horse/HorseAnalytics';
import { HorseDetailsCard } from '@/components/horse/HorseDetailsCard';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getHorse } from '@/data/horseRepository';
import { listSessionsForHorse } from '@/data/sessionRepository';
import { getServerT } from '@/i18n/server';
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
  const [result, t] = await Promise.all([load(id), getServerT()]);

  if (result.status === 'not-found') notFound();
  if (result.status === 'error') {
    return (
      <>
        <BackLink label={t('nav.commandCenter')} />
        <ErrorState description={t('horses.detailErrorLoad')} />
      </>
    );
  }

  const { horse, sessions } = result;
  return (
    <>
      <BackLink label={t('nav.commandCenter')} />
      <PageHeader
        title={horse.name}
        description={horse.discipline ?? t('horses.noDisciplineSet')}
        action={horse.active ? undefined : <StatusPill tone="muted">{t('horses.inactive')}</StatusPill>}
      />
      <div className="space-y-6">
        <HorseDetailsCard horse={horse} />
        {sessions.length === 0 ? (
          <EmptyState
            title={t('horses.noSessionsTitle')}
            description={t('horses.noSessionsDescription')}
          />
        ) : (
          <>
            <HorseAnalytics horseId={horse.id} maxHr={horse.max_hr} />
            <SessionsList sessions={sessions.map((session) => ({ session, horse }))} />
          </>
        )}
      </div>
    </>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/"
      className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary"
    >
      <ArrowLeft size={15} /> {label}
    </Link>
  );
}
