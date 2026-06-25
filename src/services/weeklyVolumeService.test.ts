import { describe, it, expect } from 'vitest';
import { buildWeeklyVolume, weekStartUtc, weekZoneTotalMin } from '@/services/weeklyVolumeService';
import type { MeasurementRow, SessionRow } from '@/types/db';

let counter = 0;
function session(id: string, startedAt: string, durationMin: number): SessionRow {
  const ended = new Date(new Date(startedAt).getTime() + durationMin * 60_000).toISOString();
  return {
    id,
    horse_id: 'h1',
    started_at: startedAt,
    ended_at: ended,
    notes: null,
    synced: true,
    created_at: startedAt,
    training_type: null,
    environment: null,
    location_name: null,
    physical_rating: null,
    mental_rating: null,
    injury_concern: false,
    injury_recovery: false,
  };
}

/** HR rows all at one bpm, plus GPS rows giving a known distance. */
function rows(startedAt: string, bpm: number): MeasurementRow[] {
  const startMs = new Date(startedAt).getTime();
  const out: MeasurementRow[] = [];
  for (let i = 0; i < 60; i++) {
    out.push({
      id: `m-${counter++}`,
      session_id: 's',
      timestamp: new Date(startMs + i * 1000).toISOString(),
      hr_bpm: bpm,
      rr_ms: null,
      speed_ms: null,
      altitude_m: null,
      lat: null,
      lng: null,
    });
  }
  return out;
}

describe('weeklyVolume', () => {
  it('buckets Tuesday and Thursday into the same Monday-anchored week', () => {
    const monday = weekStartUtc(new Date('2026-05-12T10:00:00Z').getTime()); // Tue
    const monday2 = weekStartUtc(new Date('2026-05-14T10:00:00Z').getTime()); // Thu
    expect(monday).toBe(monday2);
  });

  it('sums duration and session count per week', () => {
    const maxHr = 200;
    const weeks = buildWeeklyVolume(
      [
        { session: session('a', '2026-05-12T10:00:00Z', 30), rows: rows('2026-05-12T10:00:00Z', 150) },
        { session: session('b', '2026-05-14T10:00:00Z', 50), rows: rows('2026-05-14T10:00:00Z', 150) },
        { session: session('c', '2026-05-20T10:00:00Z', 40), rows: rows('2026-05-20T10:00:00Z', 150) },
      ],
      maxHr,
    );
    expect(weeks).toHaveLength(2);
    expect(weeks[0]!.sessionCount).toBe(2);
    expect(weeks[0]!.durationMin).toBeCloseTo(80, 5);
    expect(weeks[1]!.sessionCount).toBe(1);
    // HR 150 / max 200 = 0.75 -> zone z3 (>=0.7). All time in one zone.
    expect(weekZoneTotalMin(weeks[0]!)).toBeCloseTo(80, 1);
    expect(weeks[0]!.zoneMinutes.z3).toBeCloseTo(80, 1);
    expect(weeks[0]!.zoneMinutes.z1).toBe(0);
  });
});
