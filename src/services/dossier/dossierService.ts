import type { SessionMetrics } from '@/types/view';

/**
 * The record that leaves with the horse.
 *
 * `measurements` has been append-only since the first migration and nothing
 * has ever cashed that in. A verifiable training history has money attached
 * to it at sale, with an insurer, and at a vet handover — but only if it can
 * leave the product in a form someone else can read.
 *
 * PURE. Assembly and formatting, no I/O.
 *
 * THE DISCLOSURE IS PART OF THE DOCUMENT, not decoration on it. A dossier
 * that lists heart rates without saying what was NOT measured invites the
 * reader to treat silence as evidence — "no injury recorded" becoming "no
 * injury". Every export carries the same statement of scope, and it is
 * generated here rather than typed into a template so it cannot be dropped by
 * whoever builds the next export format.
 */

export interface DossierSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  trainingType: string | null;
  environment: string | null;
  locationName: string | null;
  notes: string | null;
  metrics: SessionMetrics;
}

export interface DossierRange {
  from: string;
  to: string;
}

export interface DossierTotals {
  sessions: number;
  /**
   * How many of those carry measurement-derived figures.
   *
   * Loading every sample of every session in a year would be a report that
   * times out, so detail is fetched for a bounded number of the most recent
   * sessions. The count is surfaced rather than hidden, because a mean heart
   * rate over 10 of 60 sessions must not be read as a mean over 60.
   */
  detailedSessions: number;
  recordedMinutes: number;
  distanceKm: number | null;
  /** Mean of the per-session averages that exist. Null when none do. */
  meanAvgHr: number | null;
  peakHr: number | null;
  firstSessionAt: string | null;
  lastSessionAt: string | null;
}

export interface Dossier {
  horseName: string;
  stableName: string | null;
  range: DossierRange;
  generatedAt: string;
  sessions: DossierSession[];
  totals: DossierTotals;
}

export interface BuildDossierInput {
  horseName: string;
  stableName: string | null;
  range: DossierRange;
  sessions: readonly DossierSession[];
  generatedAt: string;
}

export function buildDossier(input: BuildDossierInput): Dossier {
  // Oldest first: a dossier is read as a history, not as a feed.
  const sessions = [...input.sessions].sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
  );

  let recordedMs = 0;
  let detailedSessions = 0;
  let distanceM = 0;
  let hasDistance = false;
  const avgHrs: number[] = [];
  let peakHr: number | null = null;

  for (const session of sessions) {
    recordedMs += session.metrics.durationMs;
    if (session.metrics.hrSampleCount > 0 || session.metrics.gpsSampleCount > 0) {
      detailedSessions += 1;
    }
    if (session.metrics.distanceM !== null) {
      distanceM += session.metrics.distanceM;
      hasDistance = true;
    }
    if (session.metrics.avgHr !== null) avgHrs.push(session.metrics.avgHr);
    if (
      session.metrics.peakHr !== null &&
      (peakHr === null || session.metrics.peakHr > peakHr)
    ) {
      peakHr = session.metrics.peakHr;
    }
  }

  return {
    horseName: input.horseName,
    stableName: input.stableName,
    range: input.range,
    generatedAt: input.generatedAt,
    sessions,
    totals: {
      sessions: sessions.length,
      detailedSessions,
      recordedMinutes: Math.round(recordedMs / 60_000),
      distanceKm: hasDistance ? Math.round(distanceM / 100) / 10 : null,
      meanAvgHr:
        avgHrs.length === 0
          ? null
          : Math.round(avgHrs.reduce((sum, hr) => sum + hr, 0) / avgHrs.length),
      peakHr,
      firstSessionAt: sessions[0]?.startedAt ?? null,
      lastSessionAt: sessions[sessions.length - 1]?.startedAt ?? null,
    },
  };
}

/**
 * What this document is, and — more importantly — what it is not.
 *
 * Kept as data rather than as copy in a component so every export format
 * carries the identical wording. A dossier whose disclosure differs between
 * the printed and the CSV version is worse than one with none.
 */
export const DOSSIER_DISCLOSURE: readonly string[] = [
  'This document lists measurements recorded by the HorsePowr app: heart rate from a chest strap, and where available speed, distance and altitude from the phone\'s GPS.',
  'Heart-rate zones and gait are DERIVED from those measurements and are estimates, not observations.',
  'Sessions appear only where a recording was made. The absence of a session is not evidence that the horse did not work.',
  'Nothing here is a veterinary finding, a soundness assessment, or a statement about the horse\'s health, welfare or suitability for any purpose.',
  'Measurement rows are append-only in the source system: they are written once and never edited.',
  'Where a session shows no heart-rate or distance figures, detail was not loaded for it; that is a limit of this report, not of the recording.',
];

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * The dossier as CSV.
 *
 * The disclosure rides along as leading comment lines. A spreadsheet will
 * show them as text in the first column, which is ugly and correct: the
 * caveats must not be the thing that gets lost when the file is forwarded.
 */
export function dossierToCsv(dossier: Dossier): string {
  const header = [
    `# HorsePowr training record — ${dossier.horseName}`,
    dossier.stableName === null ? null : `# Stable: ${dossier.stableName}`,
    `# Period: ${dossier.range.from} to ${dossier.range.to}`,
    `# Generated: ${dossier.generatedAt}`,
    ...DOSSIER_DISCLOSURE.map((line) => `# ${line}`),
  ].filter((line): line is string => line !== null);

  const columns = [
    'started_at',
    'ended_at',
    'duration_min',
    'training_type',
    'environment',
    'location',
    'distance_km',
    'avg_hr_bpm',
    'peak_hr_bpm',
    'avg_speed_kmh',
    'altitude_gain_m',
    'hr_samples',
    'gps_samples',
    'notes',
  ];

  const rows = dossier.sessions.map((session) => {
    const m = session.metrics;
    return [
      session.startedAt,
      session.endedAt,
      Math.round(m.durationMs / 60_000),
      session.trainingType,
      session.environment,
      session.locationName,
      m.distanceM === null ? null : Math.round(m.distanceM / 100) / 10,
      m.avgHr,
      m.peakHr,
      m.avgSpeedMs === null ? null : Math.round(m.avgSpeedMs * 3.6 * 10) / 10,
      m.altitudeGainM === null ? null : Math.round(m.altitudeGainM),
      m.hrSampleCount,
      m.gpsSampleCount,
      session.notes,
    ]
      .map(csvCell)
      .join(',');
  });

  return [...header, columns.join(','), ...rows].join('\n');
}
