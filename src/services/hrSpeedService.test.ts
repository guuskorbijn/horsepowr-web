import { describe, it, expect } from 'vitest';
import { analyzeHrSpeed } from '@/services/hrSpeedService';
import type { MeasurementRow } from '@/types/db';

const START = '2026-06-01T10:00:00.000Z';
const startMs = new Date(START).getTime();

let counter = 0;
function row(tSec: number, fields: Partial<MeasurementRow>): MeasurementRow {
  return {
    id: `m-${counter++}`,
    session_id: 's1',
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

/**
 * Synthetic session with an exact linear HR–speed law: HR = 80 + 4·speedKmh.
 * So the fit must recover slope 4, intercept 80, giving:
 *   V200 = (200-80)/4 = 30, V180 = 25, V170 = 22.5 km/h.
 */
function linearSession(maxKmh: number): MeasurementRow[] {
  const rows: MeasurementRow[] = [];
  for (let kmh = 0; kmh <= maxKmh; kmh++) {
    const hr = 80 + 4 * kmh;
    rows.push(row(kmh * 2, { hr_bpm: hr }));
    rows.push(row(kmh * 2, { speed_ms: kmh / 3.6, lat: 50, lng: 5 }));
  }
  return rows;
}

describe('analyzeHrSpeed', () => {
  it('recovers the fitted line and the V-indices from a clean linear session', () => {
    const a = analyzeHrSpeed(linearSession(35), START);
    expect(a.fit).not.toBeNull();
    expect(a.fit!.slope).toBeCloseTo(4, 5);
    expect(a.fit!.intercept).toBeCloseTo(80, 4);

    const v = (hr: number) => a.vIndices.find((x) => x.hr === hr)!;
    expect(v(200).reached).toBe(true);
    expect(v(200).speedKmh!).toBeCloseTo(30, 4);
    expect(v(180).speedKmh!).toBeCloseTo(25, 4);
    expect(v(170).speedKmh!).toBeCloseTo(22.5, 4);
  });

  it('marks a threshold "not reached" when the session HR never gets there', () => {
    // Max speed 18 km/h -> max HR 80 + 72 = 152, below every threshold.
    const a = analyzeHrSpeed(linearSession(18), START);
    expect(a.observedHrRange![1]).toBeLessThan(170);
    for (const hr of [170, 180, 200]) {
      expect(a.vIndices.find((x) => x.hr === hr)!.reached).toBe(false);
      expect(a.vIndices.find((x) => x.hr === hr)!.speedKmh).toBeNull();
    }
  });

  it('returns no fit and empty scatter for an HR-only session (no speed rows)', () => {
    const rows: MeasurementRow[] = [];
    for (let i = 0; i < 60; i++) rows.push(row(i, { hr_bpm: 120 + i }));
    const a = analyzeHrSpeed(rows, START);
    expect(a.points).toHaveLength(0);
    expect(a.fit).toBeNull();
    expect(a.vIndices.every((v) => !v.reached)).toBe(true);
  });
});
