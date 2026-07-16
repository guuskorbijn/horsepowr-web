import { describe, expect, it } from 'vitest';
import type { MeasurementRow } from '@/types/db';
import { correlateAndResample, detectHrGaps } from '@/services/analyst/streamCorrelation';

/**
 * Fixtures mirror the real shape: HR and GPS are SEPARATE rows sharing a
 * timestamp clock (HR row → hr_bpm set, lat/lng null; GPS row → speed/alt/lat/lng
 * set, hr_bpm null). started_at is the origin of the elapsed clock.
 */
const START = '2026-06-12T10:00:00.000Z';
const startMs = new Date(START).getTime();

function hrRow(sec: number, bpm: number): MeasurementRow {
  return {
    id: `hr-${sec}`,
    session_id: 's1',
    timestamp: new Date(startMs + sec * 1000).toISOString(),
    hr_bpm: bpm,
    rr_ms: null,
    speed_ms: null,
    altitude_m: null,
    lat: null,
    lng: null,
  };
}

function gpsRow(sec: number, speedMs: number, altM: number): MeasurementRow {
  return {
    id: `gps-${sec}`,
    session_id: 's1',
    timestamp: new Date(startMs + sec * 1000).toISOString(),
    hr_bpm: null,
    rr_ms: null,
    speed_ms: speedMs,
    altitude_m: altM,
    lat: 52.1 + sec * 1e-5,
    lng: 5.1 + sec * 1e-5,
  };
}

// 20s session. HR (130 bpm) at 0..4s and 12..19s → a deliberate 8s dropout
// between t=4 and t=12. GPS (5 m/s = 18 km/h) every 2s throughout.
const rows: MeasurementRow[] = [
  ...[0, 1, 2, 3, 4, 12, 13, 14, 15, 16, 17, 18, 19].map((s) => hrRow(s, 130)),
  ...[0, 2, 4, 6, 8, 10, 12, 14, 16, 18].map((s, i) => gpsRow(s, 5, 100 + i)),
];
const DURATION_MS = 20_000;

describe('correlateAndResample', () => {
  it('aligns HR and GPS onto one shared clock and converts speed to km/h', () => {
    const series = correlateAndResample(rows, START, DURATION_MS, 10); // 2s buckets

    expect(series.intervalSec).toBe(2);
    expect(series.points.length).toBeGreaterThan(0);
    // Every point sits within the session window.
    for (const p of series.points) {
      expect(p.tSec).toBeGreaterThanOrEqual(0);
      expect(p.tSec).toBeLessThanOrEqual(20);
    }
    // Speed is constant 5 m/s → 18 km/h wherever GPS was present.
    for (const p of series.points) {
      if (p.speedKmh !== null) expect(p.speedKmh).toBe(18);
    }
    // HR is constant 130 wherever present.
    for (const p of series.points) {
      if (p.hrBpm !== null) expect(p.hrBpm).toBe(130);
    }
  });

  it('shows the HR dropout as null HR while GPS keeps the point alive', () => {
    const series = correlateAndResample(rows, START, DURATION_MS, 10);
    // Buckets [6,8)/[8,10)/[10,12) (centres 7/9/11) fall wholly inside the HR
    // dropout — GPS present, HR absent. (t=4 HR lands in bucket [4,6), centre 5.)
    const inGap = series.points.filter((p) => p.tSec >= 7 && p.tSec <= 11);
    expect(inGap.length).toBeGreaterThan(0);
    expect(inGap.every((p) => p.hrBpm === null)).toBe(true);
    expect(inGap.some((p) => p.speedKmh === 18)).toBe(true);
  });

  it('returns an empty series for a zero-duration or empty session', () => {
    expect(correlateAndResample(rows, START, 0, 10).points).toEqual([]);
    expect(correlateAndResample([], START, DURATION_MS, 10).points).toEqual([]);
  });
});

describe('detectHrGaps', () => {
  it('finds the 8s HR dropout on the shared clock', () => {
    const { gaps, gapCount, largestGapSec } = detectHrGaps(rows, START);
    expect(gapCount).toBe(1);
    expect(largestGapSec).toBe(8);
    expect(gaps[0]).toEqual({ startSec: 4, endSec: 12, durationSec: 8 });
  });

  it('reports no gaps for continuous 1 Hz HR', () => {
    const continuous = Array.from({ length: 10 }, (_, s) => hrRow(s, 140));
    const { gapCount, largestGapSec } = detectHrGaps(continuous, START);
    expect(gapCount).toBe(0);
    expect(largestGapSec).toBe(0);
  });
});
