import { describe, expect, it } from 'vitest';
import { buildPlannedComparison } from '@/services/calendar/plannedComparison';
import type { MeasurementRow, SessionRow } from '@/types/db';

const START = '2026-11-04T08:00:00.000Z';

function session(patch: Partial<SessionRow>): SessionRow {
  return {
    id: 'session-1',
    horse_id: 'horse-1',
    started_at: START,
    ended_at: '2026-11-04T08:00:40.000Z',
    notes: null,
    synced: true,
    created_at: START,
    training_type: null,
    environment: null,
    location_name: null,
    physical_rating: null,
    mental_rating: null,
    injury_concern: false,
    injury_recovery: false,
    ...patch,
  };
}

function hr(offsetSec: number, bpm: number | null): MeasurementRow {
  return {
    id: `m-${offsetSec}`,
    session_id: 'session-1',
    timestamp: new Date(Date.parse(START) + offsetSec * 1000).toISOString(),
    hr_bpm: bpm,
    rr_ms: null,
    speed_ms: null,
    altitude_m: null,
    lat: null,
    lng: null,
  };
}

function gps(offsetSec: number): MeasurementRow {
  return { ...hr(offsetSec, null), lat: 51.5, lng: 4.7, speed_ms: 4 };
}

const snapshot = (targets: Record<string, unknown> | null, plannedDurationMin: number | null = 1) => ({
  version: 1,
  targets,
  plannedDurationMin,
  durationSource: plannedDurationMin === null ? null : 'targets',
  occurrenceStart: null,
  capturedAt: START,
});

describe('buildPlannedComparison', () => {
  it('an ad-hoc session is unplanned', () => {
    expect(buildPlannedComparison(session({}), [], 240)).toEqual({ kind: 'unplanned' });
  });

  it('linked to a plan but the snapshot column is absent (migration not applied)', () => {
    // PostgREST omits an unknown column, so the key is simply missing.
    const result = buildPlannedComparison(session({ planned_event_id: 'evt-1' }), [], 240);
    expect(result).toEqual({ kind: 'linked-without-snapshot', plannedEventId: 'evt-1' });
  });

  it('an invalid snapshot is logged and treated as absent, never as a zero comparison', () => {
    const result = buildPlannedComparison(
      session({ planned_event_id: 'evt-1', planned_targets_snapshot: { version: 99 } }),
      [hr(0, 150)],
      240,
    );
    expect(result.kind).toBe('linked-without-snapshot');
  });

  it('compares against the frozen target, inclusive at both limits, and exposes the band', () => {
    // 10 s at 150 (the min, inclusive), 10 s at 175 (above), 10 s at 140 (below), then 170 (the max).
    const rows = [hr(0, 150), hr(10, 175), hr(20, 140), hr(30, 170), hr(40, 170), gps(5)];
    const result = buildPlannedComparison(
      session({
        planned_event_id: 'evt-1',
        planned_targets_snapshot: snapshot({ version: 1, hrMinBpm: 150, hrMaxBpm: 170 }),
      }),
      rows,
      240,
    );
    if (result.kind !== 'compared') throw new Error(`expected compared, got ${result.kind}`);
    expect(result.targetBand).toEqual({ minBpm: 150, maxBpm: 170 });
    const { hr: cmp } = result.comparison;
    expect(cmp?.insideMs).toBe(20_000);
    expect(cmp?.aboveMs).toBe(10_000);
    expect(cmp?.belowMs).toBe(10_000);
    expect(result.comparison.duration.deltaMs).toBe(-20_000); // 40 s ridden vs 1 min planned
  });

  it('a dropout longer than 10 s is reported as an uncounted gap, not attributed', () => {
    const rows = [hr(0, 160), hr(5, 160), hr(65, 160), hr(70, 160)];
    const result = buildPlannedComparison(
      session({
        ended_at: '2026-11-04T08:01:10.000Z',
        planned_event_id: 'evt-1',
        planned_targets_snapshot: snapshot({ version: 1, hrMinBpm: 150, hrMaxBpm: 170 }),
      }),
      rows,
      240,
    );
    if (result.kind !== 'compared') throw new Error('expected compared');
    expect(result.comparison.coverage.uncountedGapCount).toBe(1);
    expect(result.comparison.coverage.uncountedGapMs).toBe(60_000);
    expect(result.comparison.hr?.insidePct).toBe(100);
  });

  it('no HR samples at all: duration only, with the reason "no-data"', () => {
    const result = buildPlannedComparison(
      session({
        planned_event_id: 'evt-1',
        planned_targets_snapshot: snapshot({ version: 1, hrMinBpm: 150, hrMaxBpm: 170 }),
      }),
      [gps(0), gps(5), hr(10, null)],
      240,
    );
    if (result.kind !== 'compared') throw new Error('expected compared');
    expect(result.comparison.hr).toBeNull();
    expect(result.comparison.hrOmittedReason).toBe('no-data');
  });

  it('a plan with only a duration: no HR comparison, reason "no-target", no band', () => {
    const result = buildPlannedComparison(
      session({ planned_event_id: 'evt-1', planned_targets_snapshot: snapshot({ version: 1 }, 30) }),
      [hr(0, 150), hr(5, 150)],
      240,
    );
    if (result.kind !== 'compared') throw new Error('expected compared');
    expect(result.comparison.hrOmittedReason).toBe('no-target');
    expect(result.targetBand).toBeNull();
  });
});
