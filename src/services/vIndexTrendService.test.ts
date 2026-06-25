import { describe, it, expect } from 'vitest';
import { buildVIndexTrend, vTrendPoints, filterTrend } from '@/services/vIndexTrendService';
import type { MeasurementRow, SessionRow } from '@/types/db';

let counter = 0;
function row(startMs: number, tSec: number, fields: Partial<MeasurementRow>): MeasurementRow {
  return {
    id: `m-${counter++}`,
    session_id: 's',
    timestamp: new Date(startMs + tSec * 1000).toISOString(),
    hr_bpm: null,
    rr_ms: null,
    speed_ms: null,
    altitude_m: null,
    lat: null,
    lng: null,
    ...fields,
  };
}

/** HR = intercept + slope·speedKmh, so V200 = (200 - intercept)/slope. */
function session(id: string, startedAt: string, intercept: number, slope: number): {
  session: SessionRow;
  rows: MeasurementRow[];
} {
  const startMs = new Date(startedAt).getTime();
  const rows: MeasurementRow[] = [];
  for (let kmh = 0; kmh <= 45; kmh++) {
    rows.push(row(startMs, kmh * 2, { hr_bpm: intercept + slope * kmh }));
    rows.push(row(startMs, kmh * 2, { speed_ms: kmh / 3.6, lat: 50, lng: 5 }));
  }
  const s: SessionRow = {
    id,
    horse_id: 'h1',
    started_at: startedAt,
    ended_at: null,
    notes: null,
    synced: true,
    created_at: startedAt,
    training_type: 'conditioning',
    environment: null,
    location_name: null,
    physical_rating: null,
    mental_rating: null,
    injury_concern: false,
    injury_recovery: false,
  };
  return { session: s, rows };
}

describe('vIndexTrend', () => {
  it('orders sessions by date and recovers each V200', () => {
    // Later session has a lower HR at the same speed (slope 3 vs 4) -> higher V200.
    const inputs = [
      session('b', '2026-03-10T10:00:00Z', 80, 3), // V200 = 40
      session('a', '2026-03-01T10:00:00Z', 80, 4), // V200 = 30
    ];
    const trend = buildVIndexTrend(inputs);
    expect(trend.map((s) => s.sessionId)).toEqual(['a', 'b']); // ascending date

    const pts = vTrendPoints(trend, 200);
    expect(pts).toHaveLength(2);
    expect(pts[0]!.speedKmh).toBeCloseTo(30, 3);
    expect(pts[1]!.speedKmh).toBeCloseTo(40, 3);
  });

  it('filters by date range', () => {
    const trend = buildVIndexTrend([
      session('a', '2026-03-01T10:00:00Z', 80, 4),
      session('b', '2026-03-10T10:00:00Z', 80, 3),
    ]);
    const filtered = filterTrend(trend, { fromMs: new Date('2026-03-05T00:00:00Z').getTime() });
    expect(filtered.map((s) => s.sessionId)).toEqual(['b']);
  });
});
