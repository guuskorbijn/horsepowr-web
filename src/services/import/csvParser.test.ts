import { describe, expect, it } from 'vitest';
import { csvParser } from './csvParser';
import { defaultParserRegistry } from './parserRegistry';

const enc = (text: string): Uint8Array => new TextEncoder().encode(text);

const POLAR_CSV = [
  'Name,Sport,Date,Start time,Duration,Total distance (km),Average heart rate (bpm)',
  'Rider,OTHER_OUTDOOR,26-11-2026,08:00:00,00:00:05,0.02,150',
  'Sample rate,Time,HR (bpm),Speed (km/h),Pace (min/km),Cadence,Altitude (m)',
  '1,00:00:00,148,12.0,,,',
  '1,00:00:01,150,12.5,,,',
  '1,00:00:01,151,12.5,,,',
  '1,00:00:02,0,12.5,,,',
  '1,00:00:03,999,12.5,,,',
  '1,00:00:04,152,13.0,,,',
].join('\n');

describe('Polar Flow CSV', () => {
  it('is recognised by content and extension', () => {
    expect(csvParser.canParse({ fileName: 'ride.csv', bytes: enc(POLAR_CSV) })).toBe(true);
    expect(csvParser.canParse({ fileName: 'x.csv', bytes: enc('a,b\n1,2\n') })).toBe(false);
  });

  it('anchors the local start in the uploader’s zone and keeps valid HR', () => {
    const parsed = defaultParserRegistry.parse({
      fileName: 'ride.csv',
      bytes: enc(POLAR_CSV),
      timeZone: 'Europe/Amsterdam',
    });
    // 08:00 in Amsterdam in November is 07:00 UTC.
    expect(parsed.startedAt).toBe('2026-11-26T07:00:00.000Z');
    expect(parsed.hr.map((s) => s.bpm)).toEqual([148, 150, 152]);
    expect(parsed.hr[2]?.timestamp).toBe('2026-11-26T07:00:04.000Z');
    expect(parsed.gps).toEqual([]);
    expect(parsed.sport).toBe('OTHER_OUTDOOR');
    const codes = parsed.warnings.map((w) => w.code);
    expect(codes).toEqual(
      expect.arrayContaining(['no-gps', 'invalid-samples-dropped', 'duplicate-timestamps-dropped']),
    );
  });

  it('falls back to UTC without a usable zone', () => {
    const parsed = csvParser.parse({ fileName: 'ride.csv', bytes: enc(POLAR_CSV), timeZone: 'Not/AZone' });
    expect(parsed.startedAt).toBe('2026-11-26T08:00:00.000Z');
  });
});
