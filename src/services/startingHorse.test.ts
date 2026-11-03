import { describe, expect, it } from 'vitest';
import { resolveStartingHorse } from '@/services/startingHorse';
import { fakeSupa } from '@/test/fakeSupabase';
import type { HorseRow } from '@/types/db';

const horse = (id: string, active = true): HorseRow => ({
  id, org_id: 'org', location_id: null, name: id, discipline: null, photo_url: null, active, max_hr: 220,
  date_of_birth: null, sex: null, breed: null, level: null, height_cm: null, weight_kg: null, chip_number: null,
  created_at: '2026-01-01T00:00:00Z',
});

describe('resolveStartingHorse', () => {
  const { supa, queries } = fakeSupa(() => ({ data: [{ id: 's', horse_id: 'b' }], error: null }));
  const horses = [horse('a'), horse('b'), horse('z', false)];

  it('honours a requested horse from this stable', async () => {
    expect(await resolveStartingHorse(supa, horses, 'a')).toBe('a');
  });

  it('ignores an unknown id and falls back to the horse ridden last', async () => {
    expect(await resolveStartingHorse(supa, horses, 'someone-elses-horse')).toBe('b');
    // Only active horses are considered for the default.
    const inCall = queries.at(-1)?.find((c) => c.method === 'in');
    expect(inCall?.args[1]).toEqual(['a', 'b']);
  });

  it('returns null for a stable with no active horses', async () => {
    expect(await resolveStartingHorse(supa, [horse('z', false)], null)).toBeNull();
  });
});
