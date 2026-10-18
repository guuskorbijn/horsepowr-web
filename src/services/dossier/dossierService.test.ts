import { describe, expect, it } from 'vitest';
import {
  DOSSIER_DISCLOSURE,
  buildDossier,
  dossierToCsv,
  type DossierSession,
} from './dossierService';
import type { SessionMetrics } from '@/types/view';

function metrics(over: Partial<SessionMetrics> = {}): SessionMetrics {
  return {
    durationMs: 45 * 60_000,
    distanceM: 8_000,
    avgHr: 120,
    peakHr: 170,
    minHr: 40,
    avgSpeedMs: 4,
    maxSpeedMs: 9,
    altitudeGainM: 30,
    hrSampleCount: 2700,
    gpsSampleCount: 2700,
    ...over,
  };
}

function session(over: Partial<DossierSession> = {}): DossierSession {
  return {
    id: 's1',
    startedAt: '2026-10-20T07:00:00.000Z',
    endedAt: '2026-10-20T07:45:00.000Z',
    trainingType: 'conditioning',
    environment: null,
    locationName: null,
    notes: null,
    metrics: metrics(),
    ...over,
  };
}

const base = {
  horseName: 'Bella',
  stableName: 'Lips Stables',
  range: { from: '2026-10-01', to: '2026-10-31' },
  generatedAt: '2026-10-21T12:00:00.000Z',
};

describe('buildDossier', () => {
  it('reads as a history: oldest first', () => {
    const dossier = buildDossier({
      ...base,
      sessions: [
        session({ id: 'b', startedAt: '2026-10-20T07:00:00.000Z' }),
        session({ id: 'a', startedAt: '2026-10-05T07:00:00.000Z' }),
      ],
    });
    expect(dossier.sessions.map((s) => s.id)).toEqual(['a', 'b']);
    expect(dossier.totals.firstSessionAt).toBe('2026-10-05T07:00:00.000Z');
    expect(dossier.totals.lastSessionAt).toBe('2026-10-20T07:00:00.000Z');
  });

  it('sums what exists and reports the peak across sessions', () => {
    const dossier = buildDossier({
      ...base,
      sessions: [
        session({ id: 'a', metrics: metrics({ avgHr: 100, peakHr: 150 }) }),
        session({ id: 'b', metrics: metrics({ avgHr: 140, peakHr: 190 }) }),
      ],
    });
    expect(dossier.totals.sessions).toBe(2);
    expect(dossier.totals.recordedMinutes).toBe(90);
    expect(dossier.totals.distanceKm).toBe(16);
    expect(dossier.totals.meanAvgHr).toBe(120);
    expect(dossier.totals.peakHr).toBe(190);
    expect(dossier.totals.detailedSessions).toBe(2);
  });

  it('reports no distance at all rather than zero when nothing had GPS', () => {
    const dossier = buildDossier({
      ...base,
      sessions: [session({ metrics: metrics({ distanceM: null }) })],
    });
    // A horse that worked without GPS did not travel zero kilometres.
    expect(dossier.totals.distanceKm).toBeNull();
  });

  it('handles an empty period without inventing figures', () => {
    const dossier = buildDossier({ ...base, sessions: [] });
    expect(dossier.totals).toMatchObject({
      sessions: 0,
      detailedSessions: 0,
      recordedMinutes: 0,
      distanceKm: null,
      meanAvgHr: null,
      peakHr: null,
      firstSessionAt: null,
      lastSessionAt: null,
    });
  });
});

describe('dossierToCsv', () => {
  it('carries every disclosure line, so forwarding the file cannot drop them', () => {
    const csv = dossierToCsv(buildDossier({ ...base, sessions: [session()] }));
    for (const line of DOSSIER_DISCLOSURE) {
      expect(csv).toContain(`# ${line}`);
    }
  });

  it('states the horse, the stable and the period', () => {
    const csv = dossierToCsv(buildDossier({ ...base, sessions: [] }));
    expect(csv).toContain('# HorsePowr training record — Bella');
    expect(csv).toContain('# Stable: Lips Stables');
    expect(csv).toContain('# Period: 2026-10-01 to 2026-10-31');
  });

  it('escapes a note containing a comma, a quote and a newline', () => {
    const csv = dossierToCsv(
      buildDossier({
        ...base,
        sessions: [session({ notes: 'Rider said "steady", then\nstopped' })],
      }),
    );
    expect(csv).toContain('"Rider said ""steady"", then\nstopped"');
  });

  it('leaves a missing measurement empty rather than writing a zero', () => {
    const csv = dossierToCsv(
      buildDossier({
        ...base,
        sessions: [
          session({
            endedAt: null,
            metrics: metrics({ distanceM: null, avgHr: null, peakHr: null }),
          }),
        ],
      }),
    );
    const row = csv.split('\n').at(-1) ?? '';
    // started, ended(empty), duration, type, env(empty), loc(empty),
    // distance(empty), avg(empty), peak(empty), ...
    expect(row.split(',')[1]).toBe('');
    expect(row.split(',')[6]).toBe('');
    expect(row.split(',')[7]).toBe('');
  });
});

describe('dossier detail coverage', () => {
  it('counts a session with no samples as present but not detailed', () => {
    const dossier = buildDossier({
      ...base,
      sessions: [
        session({
          metrics: metrics({ hrSampleCount: 0, gpsSampleCount: 0 }),
        }),
      ],
    });
    // The session happened and its duration counts; its figures were simply
    // not loaded, and a mean over it would be a mean over nothing.
    expect(dossier.totals.sessions).toBe(1);
    expect(dossier.totals.detailedSessions).toBe(0);
  });
});
