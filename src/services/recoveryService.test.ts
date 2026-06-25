import { describe, it, expect } from 'vitest';
import { buildRecoveryDescent } from '@/services/recoveryService';
import type { MeasurementRow } from '@/types/db';
import type { Effort } from '@/types/view';

const START = '2026-06-01T10:00:00.000Z';
const startMs = new Date(START).getTime();

function hrRow(tSec: number, hr: number): MeasurementRow {
  return {
    id: `hr-${tSec}`,
    session_id: 's1',
    timestamp: new Date(startMs + tSec * 1000).toISOString(),
    hr_bpm: hr,
    rr_ms: null,
    speed_ms: null,
    altitude_m: null,
    lat: null,
    lng: null,
  };
}

function workEffort(endSec: number, peakHr: number): Effort {
  return {
    kind: 'work',
    workIndex: 1,
    startTs: 0,
    endTs: endSec * 1000,
    durationMs: endSec * 1000,
    distanceM: null,
    avgHr: peakHr - 10,
    peakHr,
    avgSpeedMs: null,
    maxSpeedMs: null,
    avgGradient: null,
    climbM: null,
  };
}

describe('buildRecoveryDescent', () => {
  it('measures the drop at +1/+5/+10 min from the effort peak', () => {
    // Effort ends at 120s with peak 180. HR then descends linearly each second.
    const rows: MeasurementRow[] = [];
    for (let t = 120; t <= 720; t++) {
      // 180 at t=120, falling to 120 at t=720 (0.1 bpm/s).
      rows.push(hrRow(t, 180 - (t - 120) * 0.1));
    }
    const d = buildRecoveryDescent(rows, START, [workEffort(120, 180)]);
    expect(d).not.toBeNull();
    expect(d!.peakHr).toBe(180);

    const m = (sec: number) => d!.marks.find((x) => x.atSec === sec)!;
    // +60s -> 180 - 6 = 174; drop 6.
    expect(m(60).hr).toBeCloseTo(174, 1);
    expect(m(60).dropBpm).toBeCloseTo(6, 1);
    // +600s -> 180 - 60 = 120; drop 60.
    expect(m(600).recorded).toBe(true);
    expect(m(600).dropBpm).toBeCloseTo(60, 1);
    expect(m(600).dropPct).toBeCloseTo((60 / 180) * 100, 1);
  });

  it('marks later points "not recorded" when the session stops early', () => {
    // Only ~3 minutes of recovery data exist.
    const rows: MeasurementRow[] = [];
    for (let t = 120; t <= 300; t++) rows.push(hrRow(t, 170 - (t - 120) * 0.1));
    const d = buildRecoveryDescent(rows, START, [workEffort(120, 170)]);
    // Recovery data spans 120s..300s = only 3 min post-effort.
    expect(d!.marks.find((m) => m.atSec === 60)!.recorded).toBe(true);
    expect(d!.marks.find((m) => m.atSec === 300)!.recorded).toBe(false);
    expect(d!.marks.find((m) => m.atSec === 600)!.recorded).toBe(false);
    expect(d!.marks.find((m) => m.atSec === 600)!.hr).toBeNull();
  });

  it('returns null when there is no work effort', () => {
    const rows = [hrRow(0, 100), hrRow(60, 100)];
    expect(buildRecoveryDescent(rows, START, [])).toBeNull();
  });
});
