import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/states';
import { AgendaScreen } from '@/components/agenda/AgendaScreen';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getHorse } from '@/data/horseRepository';
import { getServerT } from '@/i18n/server';
import { log } from '@/lib/log';
import { parseAgendaQuery, type SearchParamValue } from '@/services/calendar/agendaQuery';
import type { HorseRow } from '@/types/db';

type LoadResult = { status: 'ok'; horse: HorseRow } | { status: 'not-found' } | { status: 'error' };

async function loadHorse(id: string): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  try {
    const horse = await getHorse(await getServerSupabase(), id);
    // RLS already hides other stables' horses; the org check makes a policy
    // regression a 404 here rather than another stable's agenda.
    if (!horse || horse.org_id !== ctx.org?.id) return { status: 'not-found' };
    return { status: 'ok', horse };
  } catch (err: unknown) {
    log.error('horse agenda: could not load horse', {
      horseId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 'error' };
  }
}

/**
 * One horse's agenda: its own items plus the stable-wide ones (a farrier
 * round, a yard vaccination day) that concern it too.
 */
export default async function HorseAgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const [{ id }, query, t] = await Promise.all([params, searchParams, getServerT()]);
  const result = await loadHorse(id);
  if (result.status === 'not-found') notFound();

  const back = (
    <Link
      href={`/horses/${id}`}
      className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary"
    >
      <ArrowLeft size={15} /> {result.status === 'ok' ? result.horse.name : t('nav.horses')}
    </Link>
  );
  if (result.status === 'error') {
    return (
      <>
        {back}
        <ErrorState description={t('horses.detailErrorLoad')} />
      </>
    );
  }

  return (
    <>
      {back}
      <PageHeader
        title={`${t('agenda.title')} · ${result.horse.name}`}
        description={t('agenda.horseDescription')}
      />
      <AgendaScreen
        basePath={`/horses/${id}/agenda`}
        query={{ ...parseAgendaQuery(query), horseId: result.horse.id }}
        lockedHorse
      />
    </>
  );
}
