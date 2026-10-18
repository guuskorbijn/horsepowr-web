import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getServerT } from '@/i18n/server';
import { getHorse } from '@/data/horseRepository';
import { listSessionsForHorse } from '@/data/sessionRepository';
import { getMeasurements } from '@/data/measurementRepository';
import { computeSessionMetrics } from '@/services/sessionMetrics';
import { buildDossier, type DossierSession } from '@/services/dossier/dossierService';
import { DossierDocument } from '@/components/dossier/DossierDocument';
import type { Dossier } from '@/services/dossier/dossierService';
import type { SessionMetrics } from '@/types/view';

/**
 * A horse's training record over a period, ready to print or hand over.
 *
 * Measurement detail is loaded for the most recent `DETAIL_LIMIT` sessions
 * only. A year of daily recordings is hundreds of thousands of sample rows,
 * and a report that times out is worth nothing to someone standing at a
 * pre-purchase exam. Every session in the period is still listed with its
 * date and duration; the bound is stated in the document rather than hidden,
 * so a mean over ten sessions is never read as a mean over sixty.
 */
const DETAIL_LIMIT = 10;

const EMPTY_METRICS: SessionMetrics = {
  durationMs: 0,
  distanceM: null,
  avgHr: null,
  peakHr: null,
  minHr: null,
  avgSpeedMs: null,
  maxSpeedMs: null,
  altitudeGainM: null,
  hrSampleCount: 0,
  gpsSampleCount: 0,
};

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

type LoadResult =
  | { status: 'ok'; dossier: Dossier }
  | { status: 'error' }
  | { status: 'not-found' };

async function load(
  horseId: string,
  range: { from: string; to: string },
): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  try {
    const supa = await getServerSupabase();
    const horse = await getHorse(supa, horseId);
    if (!horse) return { status: 'not-found' };

    const sessions = await listSessionsForHorse(supa, horseId, {
      since: `${range.from}T00:00:00.000Z`,
      until: `${range.to}T23:59:59.999Z`,
    });

    // Newest first out of the repository, so the detailed slice is the most
    // recent work — which is what a buyer or a vet asks about first.
    const detailed = new Set(sessions.slice(0, DETAIL_LIMIT).map((s) => s.id));
    const rowsById = new Map(
      await Promise.all(
        [...detailed].map(
          async (id) => [id, await getMeasurements(supa, id)] as const,
        ),
      ),
    );

    const dossierSessions: DossierSession[] = sessions.map((session) => {
      const rows = rowsById.get(session.id);
      const metrics =
        rows === undefined
          ? {
              ...EMPTY_METRICS,
              durationMs:
                session.ended_at === null
                  ? 0
                  : Math.max(
                      0,
                      Date.parse(session.ended_at) - Date.parse(session.started_at),
                    ),
            }
          : computeSessionMetrics(session, rows);
      return {
        id: session.id,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        trainingType: session.training_type,
        environment: session.environment,
        locationName: session.location_name,
        notes: session.notes,
        metrics,
      };
    });

    return {
      status: 'ok',
      dossier: buildDossier({
        horseName: horse.name,
        stableName: ctx.org?.name ?? null,
        range,
        sessions: dossierSessions,
        generatedAt: new Date().toISOString(),
      }),
    };
  } catch {
    return { status: 'error' };
  }
}

export default async function DossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [{ id }, query, t] = await Promise.all([
    params,
    searchParams,
    getServerT(),
  ]);
  const fallback = defaultRange();
  const range = {
    from: query.from ?? fallback.from,
    to: query.to ?? fallback.to,
  };
  const result = await load(id, range);

  if (result.status === 'not-found') notFound();
  if (result.status === 'error') {
    return (
      <>
        <PageHeader title={t('dossier.title')} />
        <ErrorState description={t('dossier.errorLoad')} />
      </>
    );
  }

  return <DossierDocument dossier={result.dossier} horseId={id} />;
}
