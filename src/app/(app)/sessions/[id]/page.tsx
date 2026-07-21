import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/StatusPill';
import { SessionMetricTiles } from '@/components/session/SessionMetricTiles';
import { SessionCharts } from '@/components/session/SessionCharts';
import { EffortsPanel } from '@/components/session/EffortsPanel';
import { HrSpeedPanel } from '@/components/session/HrSpeedPanel';
import { RecoveryPanel } from '@/components/session/RecoveryPanel';
import { ClimbsPanel } from '@/components/session/ClimbsPanel';
import { PrintReportHeader } from '@/components/session/PrintReportHeader';
import { RouteMap } from '@/components/session/RouteMap';
import { SessionSummaryCard } from '@/components/session/SessionSummaryCard';
import { RecordingQualityCard } from '@/components/session/RecordingQualityCard';
import { ZoneDistribution } from '@/components/session/ZoneDistribution';
import { AnnotationForm } from '@/components/session/AnnotationForm';
import { ExportBar } from '@/components/session/ExportBar';
import { SessionPager } from '@/components/session/SessionPager';
import { LogoWordmark } from '@/components/brand/Logo';
import { annotationsFromSession } from '@/data/annotationRepository';
import { sessionSummaryToCsv, exportSlug } from '@/services/csvExport';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { loadSessionView, type SessionView } from '@/services/sessionViewService';
import { listSessionsForHorse } from '@/data/sessionRepository';
import { TRAINING_TYPE_LABELS } from '@/services/labels';
import { formatDateTime } from '@/services/format';

interface Neighbors {
  olderId: string | null;
  newerId: string | null;
}

type LoadResult =
  | { status: 'ok'; view: SessionView; neighbors: Neighbors }
  | { status: 'not-found' }
  | { status: 'error' };

async function load(id: string): Promise<LoadResult> {
  await requireSessionContext();
  try {
    const supa = await getServerSupabase();
    const view = await loadSessionView(supa, id);
    if (!view) return { status: 'not-found' };

    // Neighbours for prev/next, in the horse's own session timeline (desc order).
    const siblings = await listSessionsForHorse(supa, view.horse.id);
    const idx = siblings.findIndex((s) => s.id === id);
    const neighbors: Neighbors = {
      newerId: idx > 0 ? (siblings[idx - 1]?.id ?? null) : null,
      olderId: idx >= 0 && idx < siblings.length - 1 ? (siblings[idx + 1]?.id ?? null) : null,
    };
    return { status: 'ok', view, neighbors };
  } catch {
    return { status: 'error' };
  }
}

export default async function SessionDetailPage({
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
        <ErrorState description="Could not load this session. Try again." />
      </>
    );
  }

  const { view, neighbors } = result;
  const { session, horse } = view;
  const slug = exportSlug(horse.name, session.started_at);
  const summaryCsv = sessionSummaryToCsv(view);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <BackLink />
        <SessionPager olderId={neighbors.olderId} newerId={neighbors.newerId} />
      </div>

      {/* Print-only masthead + analyst report header (sidebar logo is hidden when printing). */}
      <div className="print-only mb-2">
        <LogoWordmark />
      </div>
      <PrintReportHeader view={view} />

      <PageHeader
        title={horse.name}
        description={formatDateTime(session.started_at)}
        action={
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <ExportBar
              sessionId={session.id}
              startedAt={session.started_at}
              slug={slug}
              summaryCsv={summaryCsv}
            />
            <div className="flex items-center gap-2">
              {session.training_type ? (
                <StatusPill tone="info">{TRAINING_TYPE_LABELS[session.training_type]}</StatusPill>
              ) : null}
              {session.location_name ? (
                <StatusPill tone="muted" icon={<MapPin size={13} />}>
                  {session.location_name}
                </StatusPill>
              ) : null}
            </div>
          </div>
        }
      />

      <div className="space-y-6">
        <SessionMetricTiles metrics={view.metrics} />

        <SessionSummaryCard summary={view.summary} />

        <SessionCharts
          hr={view.hr}
          speed={view.speed}
          altitude={view.altitude}
          gaitBands={view.gaitBands}
          efforts={view.efforts}
          gradientProfile={view.gradientProfile}
          maxHr={view.maxHr}
        />

        <EffortsPanel efforts={view.efforts} hasGps={view.route.length > 1} />

        <ClimbsPanel climbs={view.climbs} />

        <HrSpeedPanel analysis={view.hrSpeed} maxHr={view.maxHr} />

        <RecoveryPanel recovery={view.recovery} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {view.route.length > 1 ? (
              <RouteMap route={view.route} />
            ) : null}
            <ZoneDistribution zones={view.zones} />
          </div>
          <div className="space-y-6">
            <RecordingQualityCard quality={view.quality} />
          </div>
        </div>

        <AnnotationForm sessionId={session.id} initial={annotationsFromSession(session)} />
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/sessions"
      className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary"
    >
      <ArrowLeft size={15} /> Sessions
    </Link>
  );
}
