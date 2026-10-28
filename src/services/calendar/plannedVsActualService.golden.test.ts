import { describe, expect, it } from 'vitest';
// Ported verbatim from horsepowr/src/services/calendar/__tests__/plannedVsActualService.test.ts (mobile commit cc497bd) so the vendored
// module is held to the exact same golden cases on both sides.
/**
 * Planned vs measured. Pure, so every number here is exact.
 *
 * The two definitions this suite exists to pin down:
 *   - the target range is INCLUSIVE at both ends (unlike the half-open zone
 *     bands in utils/hrZone, which partition a continuum)
 *   - the percentage is of COVERED time, not of session duration, and a sample
 *     gap too long to attribute counts as neither
 */

import {
  MAX_ATTRIBUTED_GAP_MS,
  classifyAgainstTarget,
  comparePlannedVsActual,
  targetZoneSpan,
} from '@/services/calendar/plannedVsActualService';
import { TARGETS_VERSION, type TrainingTargets } from '@/services/calendar/trainingTargets';
import type { Measurement } from '@/types/measurement';

const START = '2026-11-04T08:00:00.000Z';

function hr(offsetSec: number, bpm: number | null): Measurement {
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

function gps(offsetSec: number): Measurement {
  return { ...hr(offsetSec, null), lat: 51.5, lng: 4.7, speed_ms: 4 };
}

function targets(partial: Partial<TrainingTargets> = {}): TrainingTargets {
  return { version: TARGETS_VERSION, ...partial };
}

/** One sample per second at a constant HR, so dwell maths is easy to read. */
function steady(bpm: number, seconds: number): Measurement[] {
  return Array.from({ length: seconds + 1 }, (_, i) => hr(i, bpm));
}

function compare(overrides: Partial<Parameters<typeof comparePlannedVsActual>[0]> = {}) {
  return comparePlannedVsActual({
    targets: targets({ hrMinBpm: 150, hrMaxBpm: 170 }),
    plannedDurationMin: 45,
    measurements: steady(160, 60),
    startedAt: START,
    endedAt: new Date(Date.parse(START) + 45 * 60_000).toISOString(),
    maxHr: 240,
    ...overrides,
  });
}

describe('classifyAgainstTarget — inclusive at both ends', () => {
  it('counts both boundary values as inside', () => {
    // A human who writes "150-170" means 170 counts.
    expect(classifyAgainstTarget(150, 150, 170)).toBe('inside');
    expect(classifyAgainstTarget(170, 150, 170)).toBe('inside');
  });

  it('classifies outside the range', () => {
    expect(classifyAgainstTarget(149, 150, 170)).toBe('below');
    expect(classifyAgainstTarget(171, 150, 170)).toBe('above');
  });

  it('is unbounded on the side a one-sided target leaves open', () => {
    expect(classifyAgainstTarget(500, 150, null)).toBe('inside');
    expect(classifyAgainstTarget(149, 150, null)).toBe('below');
    expect(classifyAgainstTarget(1, null, 170)).toBe('inside');
    expect(classifyAgainstTarget(171, null, 170)).toBe('above');
  });
});

describe('duration', () => {
  it('reports planned, measured and a signed delta', () => {
    const result = compare({
      plannedDurationMin: 45,
      endedAt: new Date(Date.parse(START) + 50 * 60_000).toISOString(),
    });
    expect(result.duration.plannedMs).toBe(45 * 60_000);
    expect(result.duration.measuredMs).toBe(50 * 60_000);
    expect(result.duration.deltaMs).toBe(5 * 60_000);
  });

  it('gives a negative delta for a session shorter than planned', () => {
    const result = compare({
      plannedDurationMin: 45,
      endedAt: new Date(Date.parse(START) + 30 * 60_000).toISOString(),
    });
    expect(result.duration.deltaMs).toBe(-15 * 60_000);
  });

  it('leaves planned and delta null when the plan said nothing about duration', () => {
    const result = compare({ plannedDurationMin: null });
    expect(result.duration.plannedMs).toBeNull();
    expect(result.duration.deltaMs).toBeNull();
  });

  it('treats an unfinalised session as zero length rather than guessing', () => {
    const result = compare({ endedAt: null });
    expect(result.duration.measuredMs).toBe(0);
  });
});

describe('time against the target', () => {
  it('attributes a wholly in-range session to inside', () => {
    const result = compare({ measurements: steady(160, 60) });
    expect(result.hr?.insideMs).toBe(60_000);
    expect(result.hr?.belowMs).toBe(0);
    expect(result.hr?.aboveMs).toBe(0);
    expect(result.hr?.insidePct).toBe(100);
  });

  it('splits below, inside and above by dwell', () => {
    // 10 s at 120 (below), 10 s at 160 (inside), 10 s at 200 (above). Dwell is
    // attributed to the EARLIER sample of each pair, which is why the last
    // sample of each block contributes to the next block's first interval.
    const measurements = [
      ...Array.from({ length: 10 }, (_, i) => hr(i, 120)),
      ...Array.from({ length: 10 }, (_, i) => hr(10 + i, 160)),
      ...Array.from({ length: 11 }, (_, i) => hr(20 + i, 200)),
    ];
    const result = compare({ measurements });
    expect(result.hr?.belowMs).toBe(10_000);
    expect(result.hr?.insideMs).toBe(10_000);
    expect(result.hr?.aboveMs).toBe(10_000);
    expect(result.hr?.coveredMs).toBe(30_000);
    expect(result.hr?.insidePct).toBeCloseTo(33.33, 1);
  });

  it('counts a boundary-value session as fully inside', () => {
    expect(compare({ measurements: steady(170, 30) }).hr?.insidePct).toBe(100);
    expect(compare({ measurements: steady(150, 30) }).hr?.insidePct).toBe(100);
  });

  it('reports the measured average and peak', () => {
    const measurements = [hr(0, 140), hr(1, 160), hr(2, 180)];
    const result = compare({ measurements });
    expect(result.hr?.measuredAvgBpm).toBe(160);
    expect(result.hr?.measuredPeakBpm).toBe(180);
  });

  it('honours a one-sided target', () => {
    const result = compare({
      targets: targets({ hrMinBpm: 150 }),
      measurements: steady(200, 10),
    });
    expect(result.hr?.insideMs).toBe(10_000);
    expect(result.hr?.aboveMs).toBe(0);
  });
});

describe('gaps and coverage', () => {
  it('does NOT attribute a dropout to the heart rate before it', () => {
    // Without the cap, a 60 s BLE dropout would count as a minute at 160 bpm.
    const measurements = [hr(0, 160), hr(1, 160), hr(61, 160), hr(62, 160)];
    const result = compare({ measurements });
    expect(result.hr?.coveredMs).toBe(2_000);
    expect(result.coverage.uncountedGapMs).toBe(60_000);
    expect(result.coverage.uncountedGapCount).toBe(1);
  });

  it('attributes an interval exactly at the threshold, and drops one beyond it', () => {
    const atLimit = [hr(0, 160), hr(MAX_ATTRIBUTED_GAP_MS / 1000, 160)];
    expect(compare({ measurements: atLimit }).hr?.coveredMs).toBe(
      MAX_ATTRIBUTED_GAP_MS,
    );

    const beyond = [hr(0, 160), hr(MAX_ATTRIBUTED_GAP_MS / 1000 + 1, 160)];
    expect(compare({ measurements: beyond }).hr?.coveredMs).toBe(0);
  });

  it('reports coverage as a share of the session, so the UI can say so', () => {
    const result = compare({
      measurements: steady(160, 60),
      endedAt: new Date(Date.parse(START) + 120_000).toISOString(),
    });
    expect(result.coverage.coveredMs).toBe(60_000);
    expect(result.coverage.durationMs).toBe(120_000);
    expect(result.coverage.coveragePct).toBe(50);
  });

  it('percentages are of COVERED time, not of session duration', () => {
    // 20 s of samples inside a 10-minute session: still 100% inside target,
    // with coverage telling the honest story separately.
    const result = compare({
      measurements: steady(160, 20),
      endedAt: new Date(Date.parse(START) + 600_000).toISOString(),
    });
    expect(result.hr?.insidePct).toBe(100);
    expect(result.coverage.coveragePct).toBeCloseTo(3.33, 1);
  });

  it('clamps coverage rather than reporting more than 100%', () => {
    const result = compare({
      measurements: steady(160, 60),
      endedAt: new Date(Date.parse(START) + 10_000).toISOString(),
    });
    expect(result.coverage.coveragePct).toBe(100);
  });
});

describe('edge cases', () => {
  it('returns no hr block when the plan had no target, and SAYS SO', () => {
    // The reason matters: a card that cannot tell "the plan asked for nothing"
    // from "the sensor recorded nothing" tells the trainer the wrong story.
    const result = compare({ targets: targets() });
    expect(result.hr).toBeNull();
    expect(result.hrOmittedReason).toBe('no-target');
    expect(result.duration.plannedMs).not.toBeNull();
  });

  it('returns no hr block when targets are absent entirely', () => {
    const result = compare({ targets: null });
    expect(result.hr).toBeNull();
    expect(result.hrOmittedReason).toBe('no-target');
  });

  it('distinguishes NO DATA from NO TARGET', () => {
    const result = compare({ measurements: [] });
    expect(result.hr).toBeNull();
    expect(result.hrOmittedReason).toBe('no-data');
  });

  it('reports no reason when there IS a comparison', () => {
    expect(compare().hrOmittedReason).toBeNull();
  });

  it('ignores GPS-only rows', () => {
    // The canonical model stores HR and GPS as separate rows; a GPS-only
    // session must read as "no heart rate", not as zero bpm — and that is a
    // data problem, not a planning one.
    const result = compare({ measurements: [gps(0), gps(1), gps(2)] });
    expect(result.hr).toBeNull();
    expect(result.hrOmittedReason).toBe('no-data');
  });

  it('ignores null hr_bpm rows mixed in with real ones', () => {
    const result = compare({ measurements: [hr(0, 160), gps(0), hr(1, 160), gps(1)] });
    expect(result.hr?.coveredMs).toBe(1_000);
  });

  it('reports insidePct as NULL, not 0, for a single sample', () => {
    // One sample has no interval, so nothing can be attributed. "Unknown" must
    // stay distinguishable from "none of it was inside the target".
    const result = compare({ measurements: [hr(0, 160)] });
    expect(result.hr?.coveredMs).toBe(0);
    expect(result.hr?.insidePct).toBeNull();
    expect(result.hr?.belowPct).toBeNull();
    expect(result.hr?.abovePct).toBeNull();
    // The average is still knowable from one sample.
    expect(result.hr?.measuredAvgBpm).toBe(160);
  });

  it('reports insidePct as null when every interval was a dropout', () => {
    const result = compare({ measurements: [hr(0, 160), hr(600, 160)] });
    expect(result.hr?.insidePct).toBeNull();
  });

  it('sorts unordered rows before measuring dwell', () => {
    const result = compare({ measurements: [hr(2, 160), hr(0, 160), hr(1, 160)] });
    expect(result.hr?.coveredMs).toBe(2_000);
  });

  it('survives an unparseable timestamp without throwing', () => {
    const broken: Measurement = { ...hr(0, 160), timestamp: 'not-a-date' };
    const result = compare({ measurements: [broken, hr(1, 160), hr(2, 160)] });
    expect(result.hr?.coveredMs).toBe(1_000);
  });

  it('survives an unparseable session start', () => {
    const result = compare({ startedAt: 'nonsense' });
    expect(result.duration.measuredMs).toBe(0);
  });

  it('never emits a verdict field', () => {
    // Guards the product constraint structurally: if someone adds a rating,
    // this fails and they have to argue for it.
    const result = compare();
    const keys = [
      ...Object.keys(result),
      ...Object.keys(result.duration),
      ...Object.keys(result.hr ?? {}),
      ...Object.keys(result.coverage),
    ];
    for (const banned of ['rating', 'verdict', 'score', 'good', 'pass', 'ok']) {
      expect(keys).not.toContain(banned);
    }
  });
});

describe('targetZoneSpan — Z labels as context', () => {
  it('names the zones a range spans', () => {
    // ZONE_BOUNDARIES at maxHr 240: z1 0-144, z2 144-168, z3 168-192,
    // z4 192-216, z5 216+. So 150-170 straddles z2 and z3.
    expect(targetZoneSpan(150, 170, 240)).toEqual(['z2', 'z3']);
  });

  it('names a single zone for a range inside one band', () => {
    expect(targetZoneSpan(150, 160, 240)).toEqual(['z2']);
  });

  it('spans three bands for a wide target', () => {
    expect(targetZoneSpan(150, 200, 240)).toEqual(['z2', 'z3', 'z4']);
  });

  it('handles a one-sided target', () => {
    expect(targetZoneSpan(150, null, 240)).toEqual(['z2']);
    expect(targetZoneSpan(null, 150, 240)).toEqual(['z2']);
  });

  it('scales with the horse\u2019s own max HR, never a human reference', () => {
    // At maxHr 180 the bands are z4 144-162 and z5 162+, so the same 150-170
    // range that was z2-z3 for a 240 bpm horse is z4-z5 here.
    expect(targetZoneSpan(150, 170, 180)).toEqual(['z4', 'z5']);
  });

  it('is empty when there is no target at all', () => {
    expect(targetZoneSpan(null, null, 240)).toEqual([]);
  });
});
