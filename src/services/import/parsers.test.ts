import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Encoder, Profile, type FileIdMesg, type HrvMesg, type Mesg, type SessionMesg } from '@garmin/fitsdk';
import { defaultParserRegistry } from '@/services/import/parserRegistry';
import { ImportError, type ImportErrorCode } from '@/services/import/types';

const FIXTURES = join(__dirname, '__fixtures__');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)));
const parse = (fileName: string, bytes: Uint8Array) => defaultParserRegistry.parse({ fileName, bytes });

function expectRefusal(run: () => unknown, code: ImportErrorCode): void {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(ImportError);
    expect((err as ImportError).code).toBe(code);
    return;
  }
  throw new Error(`expected an ImportError "${code}"`);
}

const START = Date.parse('2026-10-25T07:00:00.000Z');

function mesgNum(name: string): number {
  const num = Profile.MesgNum[name];
  if (num === undefined) throw new Error(`FIT profile has no message ${name}`);
  return num;
}
const SC = 2 ** 31 / 180;

/** A small synthetic Polar-like FIT file, built with the SDK's own encoder. */
function buildFit(options: { hr?: boolean; gps?: boolean; rr?: boolean; seconds?: number } = {}): Uint8Array {
  const { hr = true, gps = true, rr = true, seconds = 10 } = options;
  const encoder = new Encoder();
  const write = (name: string, mesg: Mesg): void => {
    encoder.onMesg(mesgNum(name), mesg);
  };
  const fileId: FileIdMesg = {
    type: 'activity',
    manufacturer: 'development',
    product: 0,
    timeCreated: new Date(START),
    serialNumber: 1,
  };
  write('FILE_ID', fileId);
  for (let s = 0; s < seconds; s++) {
    const record: Record<string, unknown> = { timestamp: new Date(START + s * 1000) };
    if (hr) record.heartRate = 120 + s;
    if (gps) {
      record.positionLat = Math.round((51.58 + s * 0.00004) * SC);
      record.positionLong = Math.round(4.77 * SC);
      record.enhancedSpeed = 4.5;
      record.enhancedAltitude = 3 + s * 0.1;
    }
    write('RECORD', record as Mesg);
    const hrv: HrvMesg = { time: [0.5, 0.49] };
    if (rr && hr) write('HRV', hrv);
  }
  const session: SessionMesg = {
    timestamp: new Date(START + seconds * 1000),
    startTime: new Date(START),
    sport: 'horsebackRiding',
  };
  write('SESSION', session);
  return encoder.close();
}

describe('TCX', () => {
  it('reads HR, position, altitude and TPX speed per trackpoint, in UTC', () => {
    const activity = parse('ride.tcx', fixture('ride.tcx'));
    expect(activity.format).toBe('tcx');
    expect(activity.startedAt).toBe('2026-10-25T07:00:00.000Z');
    expect(activity.gps).toHaveLength(121);
    expect(activity.hr).toHaveLength(121 - 29); // 30 s dropout between 40 and 70
    expect(activity.gps[0]).toEqual({
      timestamp: '2026-10-25T07:00:00.000Z',
      lat: 51.58,
      lng: 4.77,
      speedMs: 4.45,
      altitudeM: 3,
    });
    expect(activity.sport).toBe('Other');
  });

  it('reads an indoor file (no GPS) as HR only', () => {
    const activity = parse('indoor.tcx', fixture('indoor.tcx'));
    expect(activity.gps).toHaveLength(0);
    expect(activity.hr.length).toBeGreaterThan(50);
  });

  it('refuses a DTD outright (XXE / entity expansion)', () => {
    expectRefusal(() => parse('xxe.tcx', fixture('xxe.tcx')), 'unsafe-xml');
  });

  it('refuses a truncated file as unreadable', () => {
    expectRefusal(() => parse('truncated.tcx', fixture('truncated.tcx')), 'unreadable');
  });
});

describe('GPX', () => {
  it('reads positions, elevation and the TrackPointExtension heart rate', () => {
    const activity = parse('ride.gpx', fixture('ride.gpx'));
    expect(activity.format).toBe('gpx');
    expect(activity.gps).toHaveLength(30);
    expect(activity.hr).toHaveLength(30);
    expect(activity.gps[0]?.speedMs).toBeNull(); // GPX has no speed; derived later
    expect(activity.hr[1]).toEqual({ timestamp: '2026-10-25T07:00:02.000Z', bpm: 122, rrMs: null });
  });

  it('reads a route without HR, and zone-less times as UTC', () => {
    const activity = parse('route-only.gpx', fixture('route-only.gpx'));
    expect(activity.hr).toHaveLength(0);
    expect(activity.gps[0]?.timestamp).toBe('2026-10-25T07:00:00.000Z');
  });
});

describe('FIT', () => {
  it('reads records, converts semicircles, and attaches RR intervals to their HR sample', () => {
    const activity = parse('ride.fit', buildFit());
    expect(activity.format).toBe('fit');
    expect(activity.startedAt).toBe('2026-10-25T07:00:00.000Z');
    expect(activity.hr).toHaveLength(10);
    expect(activity.gps).toHaveLength(10);
    expect(activity.gps[0]?.lat).toBeCloseTo(51.58, 5);
    expect(activity.gps[0]?.lng).toBeCloseTo(4.77, 5);
    expect(activity.gps[0]?.speedMs).toBe(4.5);
    expect(activity.hr[0]?.rrMs).toEqual([500, 490]);
    expect(activity.sport).toBe('horsebackRiding');
  });

  it('reads a file with no GPS (indoor) and one with no HR', () => {
    expect(parse('indoor.fit', buildFit({ gps: false })).gps).toHaveLength(0);
    const noHr = parse('route.fit', buildFit({ hr: false }));
    expect(noHr.hr).toHaveLength(0);
    expect(noHr.gps).toHaveLength(10);
  });

  it('refuses a file whose CRC does not match (damaged in transit)', () => {
    const bytes = buildFit();
    bytes[30] = (bytes[30] ?? 0) ^ 0xff;
    expectRefusal(() => parse('ride.fit', bytes), 'unreadable');
  });
});

describe('registry', () => {
  it('requires extension AND content to agree', () => {
    expectRefusal(() => parse('ride.fit', fixture('ride.tcx')), 'content-mismatch');
    expectRefusal(() => parse('ride.tcx', buildFit()), 'content-mismatch');
    expectRefusal(() => parse('ride.gpx', fixture('ride.tcx')), 'content-mismatch');
  });

  it('refuses unknown extensions and empty files', () => {
    expectRefusal(() => parse('ride.csv', fixture('ride.tcx')), 'unsupported-extension');
    expectRefusal(() => parse('ride.tcx', new Uint8Array()), 'empty');
  });

  it('refuses garbage that is no known format', () => {
    expectRefusal(() => parse('ride.fit', new TextEncoder().encode('hello')), 'unreadable');
  });

  it('accepts an upper-case extension', () => {
    expect(parse('RIDE.TCX', fixture('ride.tcx')).format).toBe('tcx');
  });
});
