import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultParserRegistry } from '@/services/import/parserRegistry';
import {
  buildImportPreview,
  buildMeasurementRows,
  deriveMissingSpeeds,
  normaliseActivity,
} from '@/services/import/importService';
import { ImportError, type ParsedActivity } from '@/services/import/types';

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, '__fixtures__', name)));
const parsedFrom = (name: string): ParsedActivity =>
  defaultParserRegistry.parse({ fileName: name, bytes: fixture(name) });

const T0 = Date.parse('2026-10-25T07:00:00.000Z');
const at = (s: number): string => new Date(T0 + s * 1000).toISOString();

function parsed(patch: Partial<ParsedActivity>): ParsedActivity {
  return { format: 'tcx', startedAt: at(0), hr: [], gps: [], sport: null, warnings: [], ...patch };
}

describe('normaliseActivity', () => {
  it('drops and counts impossible values and repeated timestamps', () => {
    const activity = normaliseActivity(parsedFrom('indoor.tcx'));
    // 61 trackpoints: one bpm of 0 dropped, one repeated timestamp dropped.
    expect(activity.hr).toHaveLength(59);
    expect(activity.warnings).toEqual(
      expect.arrayContaining([
        { code: 'invalid-samples-dropped', count: 1 },
        { code: 'duplicate-timestamps-dropped', count: 1 },
        { code: 'no-gps' },
      ]),
    );
  });

  it('sorts samples that arrive out of order and starts at the earliest one', () => {
    const activity = normaliseActivity(
      parsed({
        startedAt: at(5),
        hr: [
          { timestamp: at(9), bpm: 120, rrMs: null },
          { timestamp: at(2), bpm: 110, rrMs: null },
        ],
      }),
    );
    expect(activity.hr.map((s) => s.timestamp)).toEqual([at(2), at(9)]);
    expect(activity.startedAt).toBe(at(2));
    expect(activity.endedAt).toBe(at(9));
  });

  it('refuses a file with no usable sample at all', () => {
    expect(() => normaliseActivity(parsed({ hr: [{ timestamp: at(0), bpm: 900, rrMs: null }] }))).toThrow(ImportError);
  });

  it('treats a 0,0 fix as no fix', () => {
    const activity = normaliseActivity(
      parsed({
        hr: [{ timestamp: at(0), bpm: 100, rrMs: null }],
        gps: [{ timestamp: at(0), lat: 0, lng: 0, speedMs: 1, altitudeM: null }],
      }),
    );
    expect(activity.gps).toHaveLength(0);
  });
});

describe('deriveMissingSpeeds', () => {
  it('derives speed from neighbouring fixes and leaves implausible jumps null', () => {
    const { samples, derived } = deriveMissingSpeeds([
      { timestamp: at(0), lat: 51.58, lng: 4.77, speedMs: null, altitudeM: null },
      { timestamp: at(2), lat: 51.58009, lng: 4.77, speedMs: null, altitudeM: null }, // ~10 m in 2 s
      { timestamp: at(4), lat: 51.58018, lng: 4.77, speedMs: null, altitudeM: null },
      { timestamp: at(5), lat: 51.6, lng: 4.77, speedMs: null, altitudeM: null }, // a 2 km jump in 1 s
    ]);
    expect(samples[1]?.speedMs).toBeCloseTo(5, 0);
    expect(samples[3]?.speedMs).toBeNull();
    expect(derived).toBe(2);
  });
});

describe('buildMeasurementRows', () => {
  it('writes HR and GPS as SEPARATE rows on the same timestamps, with RR on the HR row', () => {
    const activity = normaliseActivity(
      parsed({
        hr: [{ timestamp: at(0), bpm: 120.4, rrMs: [500, 490] }],
        gps: [{ timestamp: at(0), lat: 51.58, lng: 4.77, speedMs: 4, altitudeM: 3 }],
      }),
    );
    const rows = buildMeasurementRows(activity, 'session-1', (kind, i) => `${kind}-${i}`);
    expect(rows).toEqual([
      { id: 'hr-0', session_id: 'session-1', timestamp: at(0), hr_bpm: 120, rr_ms: [500, 490], speed_ms: null, altitude_m: null, lat: null, lng: null },
      { id: 'gps-0', session_id: 'session-1', timestamp: at(0), hr_bpm: null, rr_ms: null, speed_ms: 4, altitude_m: 3, lat: 51.58, lng: 4.77 },
    ]);
  });
});

describe('buildImportPreview', () => {
  it('describes a ride with the same metric functions a recorded session uses', () => {
    const preview = buildImportPreview(normaliseActivity(parsedFrom('ride.tcx')));
    expect(preview.durationSec).toBe(120);
    expect(preview.hrSampleCount).toBe(92);
    expect(preview.gpsSampleCount).toBe(121);
    expect(preview.peakSpeedKmh).toBe(16); // 4.45 m/s
    expect(preview.distanceM).toBeGreaterThan(500);
    expect(preview.distanceM).toBeLessThan(560);
    expect(preview.warnings).toContainEqual({ code: 'hr-gaps', count: 1, seconds: 30 });
  });

  it('a GPX route without HR: no-hr warning, derived speed, no HR numbers', () => {
    const preview = buildImportPreview(normaliseActivity(parsedFrom('route-only.gpx')));
    expect(preview.avgHr).toBeNull();
    expect(preview.qualityGrade).toBe('none');
    expect(preview.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['no-hr', 'speed-derived']));
  });
});
