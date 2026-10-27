import { describe, expect, it } from 'vitest';
import { commitImport, parseAnnotations } from '@/services/import/importCommit';
import { normaliseActivity, type NormalisedActivity } from '@/services/import/importService';
import { ImportError } from '@/services/import/types';
import { fakeSupa, tableOf, type Call, type FakeResult } from '@/test/fakeSupabase';

const T0 = Date.parse('2026-10-25T07:00:00.000Z');
const at = (s: number): string => new Date(T0 + s * 1000).toISOString();

function activity(seconds: number): NormalisedActivity {
  return normaliseActivity({
    format: 'tcx',
    startedAt: at(0),
    sport: null,
    warnings: [],
    hr: Array.from({ length: seconds }, (_, s) => ({ timestamp: at(s), bpm: 120, rrMs: null })),
    gps: Array.from({ length: seconds }, (_, s) => ({ timestamp: at(s), lat: 51.58 + s * 1e-5, lng: 4.77, speedMs: 4, altitudeM: 3 })),
  });
}

/**
 * An in-memory stand-in for the three tables an import touches, with the
 * semantics that matter: insert-or-skip on id, never update, exact counts,
 * and an optional failure on the Nth measurement request.
 */
function memoryStable(options: { failOnMeasurementRequest?: number } = {}) {
  const sessions = new Map<string, Record<string, unknown>>();
  const measurements = new Map<string, Record<string, unknown>>();
  let measurementRequests = 0;
  let updates = 0;
  const horse = { id: 'horse-1', org_id: 'org-a', name: 'Luna', max_hr: 220 };

  const eqArg = (calls: Call[], column: string): unknown =>
    calls.find((c) => c.method === 'eq' && c.args[0] === column)?.args[1];

  const { supa } = fakeSupa((calls): FakeResult => {
    const table = tableOf(calls);
    const upsert = calls.find((c) => c.method === 'upsert');
    if (calls.some((c) => c.method === 'update')) updates += 1;
    if (upsert) {
      const opts = upsert.args[1] as { ignoreDuplicates?: boolean };
      if (!opts.ignoreDuplicates) throw new Error('an upsert that could UPDATE was issued');
      const rows = (Array.isArray(upsert.args[0]) ? upsert.args[0] : [upsert.args[0]]) as Array<Record<string, unknown>>;
      const store = table === 'sessions' ? sessions : measurements;
      if (table === 'measurements') {
        measurementRequests += 1;
        if (measurementRequests === options.failOnMeasurementRequest) {
          return { data: null, error: { message: 'network dropped' } };
        }
      }
      const inserted = rows.filter((r) => !store.has(String(r.id)));
      for (const r of inserted) store.set(String(r.id), r);
      return { data: inserted.map((r) => ({ id: r.id })), error: null };
    }
    if (table === 'horses') return { data: eqArg(calls, 'id') === horse.id ? horse : null, error: null };
    if (table === 'sessions') return { data: sessions.get(String(eqArg(calls, 'id'))) ?? null, error: null };
    if (table === 'measurements') {
      const sessionId = eqArg(calls, 'session_id');
      const count = [...measurements.values()].filter((m) => m.session_id === sessionId).length;
      return { data: null, error: null, count };
    }
    return { data: [], error: null };
  });

  return { supa, sessions, measurements, updates: () => updates };
}

const request = (a: NormalisedActivity, horseId = 'horse-1') => ({
  orgId: 'org-a',
  horseId,
  activity: a,
  fileSha256: 'abc123',
  annotations: { trainingType: null, environment: null, locationName: null },
});

describe('commitImport', () => {
  it('creates one session with separate HR and GPS rows', async () => {
    const stable = memoryStable();
    const result = await commitImport(stable.supa, request(activity(600)));
    expect(result.outcome).toBe('created');
    expect(stable.sessions.size).toBe(1);
    expect(stable.measurements.size).toBe(1200);
    const rows = [...stable.measurements.values()];
    expect(rows.filter((r) => r.hr_bpm !== null && r.lat === null)).toHaveLength(600);
    expect(rows.filter((r) => r.lat !== null && r.hr_bpm === null)).toHaveLength(600);
  });

  it('uploading the same file twice writes nothing the second time: "already imported"', async () => {
    const stable = memoryStable();
    const first = await commitImport(stable.supa, request(activity(600)));
    const second = await commitImport(stable.supa, request(activity(600)));
    expect(second).toEqual({ outcome: 'already-imported', sessionId: first.sessionId, rowCount: 1200 });
    expect(stable.sessions.size).toBe(1);
    expect(stable.measurements.size).toBe(1200);
    expect(stable.updates()).toBe(0);
  });

  it('a write that died halfway is finished by the next attempt, without duplicates', async () => {
    const stable = memoryStable({ failOnMeasurementRequest: 2 });
    await expect(commitImport(stable.supa, request(activity(600)))).rejects.toThrow(/network dropped/);
    expect(stable.measurements.size).toBe(500); // first chunk only

    const retry = await commitImport(stable.supa, request(activity(600)));
    expect(retry.outcome).toBe('resumed');
    expect(stable.measurements.size).toBe(1200);
    expect(stable.sessions.size).toBe(1);
  });

  it('the same file for another horse is a different session', async () => {
    const stable = memoryStable();
    const a = await commitImport(stable.supa, request(activity(10)));
    await expect(commitImport(stable.supa, request(activity(10), 'horse-of-another-stable'))).rejects.toBeInstanceOf(ImportError);
    expect(a.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('parseAnnotations', () => {
  it('keeps only the known training-type vocabulary and bounds free text', () => {
    expect(
      parseAnnotations({ trainingType: 'competition', environment: '  ', locationName: 'x'.repeat(500) }),
    ).toEqual({ trainingType: null, environment: null, locationName: 'x'.repeat(120) });
    expect(parseAnnotations({ trainingType: 'cross_country', environment: 'Sand arena', locationName: null }).trainingType).toBe(
      'cross_country',
    );
  });
});
