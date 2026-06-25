import { describe, it, expect } from 'vitest';
import { detectEfforts, workEfforts } from '@/services/effortService';
import type { MeasurementRow } from '@/types/db';

const START = '2026-06-01T10:00:00.000Z';
const startMs = new Date(START).getTime();

/** One HR measurement row at `tSec` seconds elapsed. */
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

/** A per-second HR trace from a list of [seconds, bpm] plateaus. */
function trace(plateaus: Array<[number, number]>): MeasurementRow[] {
  const rows: MeasurementRow[] = [];
  let t = 0;
  for (const [secs, hr] of plateaus) {
    for (let i = 0; i < secs; i++) rows.push(hrRow(t++, hr));
  }
  return rows;
}

describe('detectEfforts', () => {
  const maxHr = 200; // enter = 150 bpm, exit = 140 bpm at the defaults

  it('detects two clean work bouts separated by recovery', () => {
    const rows = trace([
      [60, 100], // warm-up / recovery
      [60, 175], // work bout 1
      [60, 110], // recovery
      [60, 185], // work bout 2
      [30, 95], // cool-down
    ]);
    const efforts = detectEfforts({ rows, startedAt: START, maxHr });
    const work = workEfforts(efforts);
    expect(work).toHaveLength(2);
    expect(work[0]!.workIndex).toBe(1);
    expect(work[1]!.workIndex).toBe(2);
    // Roughly one minute each (per-second samples).
    expect(work[0]!.durationMs).toBeGreaterThanOrEqual(55_000);
    expect(work[0]!.peakHr).toBe(175);
    expect(work[1]!.peakHr).toBe(185);
  });

  it('does not flicker on a brief dip inside a work bout', () => {
    const rows = trace([
      [60, 100],
      [60, 175], // work
      [5, 138], // a 5s dip below the exit line — shorter than minRecoveryMs
      [60, 175], // work continues
      [30, 95],
    ]);
    const work = workEfforts(detectEfforts({ rows, startedAt: START, maxHr }));
    // The dip is bridged: one continuous bout, not two.
    expect(work).toHaveLength(1);
    expect(work[0]!.durationMs).toBeGreaterThanOrEqual(120_000);
  });

  it('discards a sub-minimum work blip', () => {
    const rows = trace([
      [60, 100],
      [8, 175], // 8s spike — shorter than minWorkMs (20s)
      [60, 100],
    ]);
    const work = workEfforts(detectEfforts({ rows, startedAt: START, maxHr }));
    expect(work).toHaveLength(0);
  });

  it('returns nothing for an HR-only session that never reaches the working range', () => {
    const rows = trace([[120, 90]]);
    expect(workEfforts(detectEfforts({ rows, startedAt: START, maxHr }))).toHaveLength(0);
  });

  it('degrades speed/gradient columns gracefully on an HR-only session', () => {
    const rows = trace([
      [60, 100],
      [60, 175],
      [30, 95],
    ]);
    const work = workEfforts(detectEfforts({ rows, startedAt: START, maxHr }));
    expect(work).toHaveLength(1);
    expect(work[0]!.avgSpeedMs).toBeNull();
    expect(work[0]!.distanceM).toBeNull();
    expect(work[0]!.avgGradient).toBeNull();
  });
});
