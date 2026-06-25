import { describe, it, expect } from 'vitest';
import { buildGradientProfile, detectClimbs, analyzeClimbs } from '@/services/gradientService';
import type { MeasurementRow } from '@/types/db';

const START = '2026-06-01T10:00:00.000Z';
const startMs = new Date(START).getTime();

let counter = 0;
// ~7.16 m horizontal per 0.0001° lng step at lat 50.
function gpsRow(tSec: number, lngOffset: number, alt: number, hr: number | null): MeasurementRow {
  return {
    id: `g-${counter++}`,
    session_id: 's1',
    timestamp: new Date(startMs + tSec * 1000).toISOString(),
    hr_bpm: hr,
    rr_ms: null,
    speed_ms: 5,
    altitude_m: alt,
    lat: 50,
    lng: 5 + lngOffset * 0.0001,
    ...(hr !== null ? { hr_bpm: hr } : {}),
  };
}

/** A ~10% hill for 60 steps, then flat for 60 steps. */
function hillThenFlat(): MeasurementRow[] {
  const rows: MeasurementRow[] = [];
  let t = 0;
  let lng = 0;
  let alt = 0;
  for (let i = 0; i < 60; i++) {
    rows.push(gpsRow(t++, lng++, alt, 150));
    alt += 0.7; // ~0.7m rise per 7.16m run -> ~9.8%
  }
  for (let i = 0; i < 60; i++) {
    rows.push(gpsRow(t++, lng++, alt, 130)); // flat
  }
  return rows;
}

describe('gradient & climbs', () => {
  it('detects a single uphill climb with a positive gradient and climb metres', () => {
    const profile = buildGradientProfile(hillThenFlat(), START);
    expect(profile.length).toBeGreaterThan(100);
    const climbs = detectClimbs(profile);
    expect(climbs).toHaveLength(1);
    expect(climbs[0]!.avgGradient).toBeGreaterThan(0.03);
    expect(climbs[0]!.climbM).toBeGreaterThan(20);
    expect(climbs[0]!.distanceM).toBeGreaterThan(100);
  });

  it('enriches a climb with the HR/speed measured during it', () => {
    const profile = buildGradientProfile(hillThenFlat(), START);
    const segs = analyzeClimbs(hillThenFlat(), START, profile);
    expect(segs).toHaveLength(1);
    // Mostly the 150-bpm hill, with at most a couple of flat (130) samples at
    // the boundary — so comfortably in the 140s.
    expect(segs[0]!.avgHr).toBeGreaterThan(140);
    expect(segs[0]!.avgHr).toBeLessThanOrEqual(150);
    expect(segs[0]!.maxSpeedMs).toBe(5);
  });

  it('finds no climbs on flat terrain', () => {
    const rows: MeasurementRow[] = [];
    for (let i = 0; i < 80; i++) rows.push(gpsRow(i, i, 100, 120));
    const profile = buildGradientProfile(rows, START);
    expect(detectClimbs(profile)).toHaveLength(0);
  });
});
