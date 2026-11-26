import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, FileText } from 'lucide-react';
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
import { listHealthRecordsForHorse } from '@/data/healthRecordRepository';
import { listContacts, listHorseContactLinks } from '@/data/contactRepository';
import { HorseHealthCard } from '@/components/horse/HorseHealthCard';
import { HorseContactsCard } from '@/components/horse/HorseContactsCard';
import { TrainingCalendarCard } from '@/components/horse/TrainingCalendarCard';
import { buildTrainingCalendar } from '@/services/trainingCalendar';
import { getServerT } from '@/i18n/server';
import type { ContactRow, HealthRecordRow, HorseRow, LocationRow, SessionRow } from '@/types/db';

type LoadResult =
  | {
      status: 'ok';
      horse: HorseRow;
      sessions: SessionRow[];
      locations: LocationRow[];
      health: HealthRecordRow[];
      contacts: ContactRow[];
      orgId: string;
      userId: string;
      canEdit: boolean;
    }
  | { status: 'not-found' }
  | { status: 'error' };

async function load(id: string): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  try {
    const supa = await getServerSupabase();
    const horse = await getHorse(supa, id);
    if (!horse) return { status: 'not-found' };
    const [sessions, health, allContacts, links] = await Promise.all([
      listSessionsForHorse(supa, id),
      listHealthRecordsForHorse(supa, id),
      listContacts(supa, horse.org_id),
      listHorseContactLinks(supa),
    ]);
    const linked = new Set(links.filter((l) => l.horse_id === id).map((l) => l.contact_id));
    return {
      status: 'ok',
      horse,
      sessions,
      locations: ctx.locations,
      health,
      contacts: allContacts.filter((c) => linked.has(c.id)),
      orgId: horse.org_id,
      userId: ctx.userId,
      canEdit: ctx.capabilities.canEdit,
    };
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

  const { horse, sessions, locations, health, contacts, orgId, userId, canEdit } = result;
  return (
    <>
      <BackLink label={t('nav.commandCenter')} />
      <PageHeader
        title={horse.name}
        description={horse.discipline ?? t('horses.noDisciplineSet')}
        action={
          <div className="flex items-center gap-3">
            {horse.active ? null : (
              <StatusPill tone="muted">{t('horses.inactive')}</StatusPill>
            )}
            <Link
              href={`/horses/${horse.id}/agenda`}
              className="inline-flex h-11 items-center gap-1.5 rounded-md border border-line-strong px-3 text-[13px] font-medium text-text-primary hover:bg-surface-muted"
            >
              <CalendarDays size={15} />
              {t('agenda.title')}
            </Link>
            {/* The record that leaves with the horse: sale, insurer, vet. */}
            <Link
              href={`/horses/${horse.id}/dossier`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-[13px] font-medium text-text-primary hover:bg-surface-muted"
            >
              <FileText size={15} />
              {t('dossier.title')}
            </Link>
          </div>
        }
      />
      <div className="space-y-6">
        <HorseDetailsCard horse={horse} locations={locations} />
        <TrainingCalendarCard
          calendar={buildTrainingCalendar(sessions, new Date().toISOString().slice(0, 10))}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
          <HorseHealthCard
            horseId={horse.id}
            horseName={horse.name}
            orgId={orgId}
            userId={userId}
            canEdit={canEdit}
            records={health}
          />
          <HorseContactsCard contacts={contacts} />
        </div>
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
