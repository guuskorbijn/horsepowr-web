import { describe, expect, it } from 'vitest';
import {
  expandRecurrence,
  parseRecurrenceRule,
} from '@/services/calendar/recurrenceService';
import { queryOccurrences } from '@/services/calendar/occurrenceQuery';
import { groupOccurrencesByReaderDay } from '@/services/calendar/agendaGrouping';
import { utcToZonedCivil, zonedCivilToUtcIso } from '@/services/time/timezone';
import { addCivilDays, civilDayKey } from '@/services/time/civilDate';
import type { CalendarEvent, CalendarEventOverride } from '@/types/calendar';

/**
 * Golden fixtures for the vendored calendar modules.
 *
 * Every expected instant below was worked out BY HAND from the zone rules,
 * not by running the code and pasting its output — a fixture produced by the
 * implementation would only prove the implementation agrees with itself.
 * The rules used:
 *   - Europe/Amsterdam: CEST (UTC+2) until 03:00 local on Sun 25 Oct 2026,
 *     CET (UTC+1) after; CET until 02:00 local on Sun 28 Mar 2027.
 *   - America/Mexico_City: UTC-6 all year (Mexico abolished DST in 2022), so
 *     the US change on 1 Nov 2026 must NOT move anything.
 *   - Asia/Shanghai: UTC+8 all year.
 *
 * The same fixtures are meant to be run against the mobile copy; if the two
 * ever disagree, that disagreement is the bug this file exists to catch.
 */

interface ExpansionFixture {
  name: string;
  rule: string;
  dtstartUtc: string;
  timeZone: string;
  rangeStartUtc: string;
  rangeEndUtc: string;
  expected: string[];
}

const EXPANSIONS: ExpansionFixture[] = [
  {
    name: 'weekly Tue+Thu 08:00 Amsterdam keeps 08:00 local across the 25 Oct 2026 DST end',
    rule: 'FREQ=WEEKLY;BYDAY=TU,TH',
    dtstartUtc: '2026-10-20T06:00:00.000Z', // Tue 20 Oct 08:00 CEST
    timeZone: 'Europe/Amsterdam',
    rangeStartUtc: '2026-10-19T00:00:00.000Z',
    rangeEndUtc: '2026-11-01T00:00:00.000Z',
    expected: [
      '2026-10-20T06:00:00.000Z', // Tue 08:00 CEST
      '2026-10-22T06:00:00.000Z', // Thu 08:00 CEST
      '2026-10-27T07:00:00.000Z', // Tue 08:00 CET — one hour later in UTC
      '2026-10-29T07:00:00.000Z', // Thu 08:00 CET
    ],
  },
  {
    name: 'daily 08:00 Amsterdam on the DST-end day itself',
    rule: 'FREQ=DAILY',
    dtstartUtc: '2026-10-24T06:00:00.000Z', // Sat 24 Oct 08:00 CEST
    timeZone: 'Europe/Amsterdam',
    rangeStartUtc: '2026-10-24T00:00:00.000Z',
    rangeEndUtc: '2026-10-27T00:00:00.000Z',
    expected: [
      '2026-10-24T06:00:00.000Z',
      '2026-10-25T07:00:00.000Z', // the change happened at 03:00, before 08:00
      '2026-10-26T07:00:00.000Z',
    ],
  },
  {
    name: 'daily 08:00 Amsterdam across the 28 Mar 2027 DST start',
    rule: 'FREQ=DAILY;COUNT=3',
    dtstartUtc: '2027-03-27T07:00:00.000Z', // Sat 08:00 CET
    timeZone: 'Europe/Amsterdam',
    rangeStartUtc: '2027-03-01T00:00:00.000Z',
    rangeEndUtc: '2027-04-30T00:00:00.000Z',
    expected: [
      '2027-03-27T07:00:00.000Z',
      '2027-03-28T06:00:00.000Z', // 08:00 CEST
      '2027-03-29T06:00:00.000Z', // COUNT=3 stops here
    ],
  },
  {
    name: 'weekly Monday 09:00 Mexico City does not move on the US DST end (1 Nov 2026)',
    rule: 'FREQ=WEEKLY',
    dtstartUtc: '2026-10-19T15:00:00.000Z', // Mon 09:00 UTC-6
    timeZone: 'America/Mexico_City',
    rangeStartUtc: '2026-10-19T00:00:00.000Z',
    rangeEndUtc: '2026-11-10T00:00:00.000Z',
    expected: [
      '2026-10-19T15:00:00.000Z',
      '2026-10-26T15:00:00.000Z',
      '2026-11-02T15:00:00.000Z',
      '2026-11-09T15:00:00.000Z',
    ],
  },
  {
    name: 'every 6 weeks 07:00 Shanghai (farrier), UNTIL inclusive',
    rule: 'FREQ=WEEKLY;INTERVAL=6;UNTIL=20261208T235959Z',
    dtstartUtc: '2026-10-26T23:00:00.000Z', // Tue 27 Oct 07:00 UTC+8
    timeZone: 'Asia/Shanghai',
    rangeStartUtc: '2026-10-01T00:00:00.000Z',
    rangeEndUtc: '2027-03-01T00:00:00.000Z',
    expected: [
      '2026-10-26T23:00:00.000Z', // 27 Oct
      '2026-12-07T23:00:00.000Z', // 8 Dec, still before UNTIL
    ],
  },
  {
    name: 'range starts mid-series: only occurrences inside [start, end) are returned',
    rule: 'FREQ=DAILY',
    dtstartUtc: '2026-10-01T06:00:00.000Z',
    timeZone: 'Europe/Amsterdam',
    rangeStartUtc: '2026-10-26T07:00:00.000Z', // inclusive start hits an occurrence
    rangeEndUtc: '2026-10-28T07:00:00.000Z', // exclusive end excludes one
    expected: ['2026-10-26T07:00:00.000Z', '2026-10-27T07:00:00.000Z'],
  },
];

describe('golden: recurrence expansion', () => {
  for (const fixture of EXPANSIONS) {
    it(fixture.name, () => {
      const parsed = parseRecurrenceRule(fixture.rule);
      if (!parsed.ok) throw new Error(parsed.error);
      const result = expandRecurrence({
        rule: parsed.rule,
        dtstartUtc: fixture.dtstartUtc,
        timeZone: fixture.timeZone,
        rangeStartUtc: fixture.rangeStartUtc,
        rangeEndUtc: fixture.rangeEndUtc,
      });
      expect(result.starts).toEqual(fixture.expected);
      expect(result.truncated).toBe(false);
    });
  }
});

describe('golden: zone conversion', () => {
  it('maps Amsterdam wall-clock 08:00 to the right UTC hour on both sides of 25 Oct 2026', () => {
    const before = { year: 2026, month: 10, day: 24, hour: 8, minute: 0, second: 0 };
    const after = { year: 2026, month: 10, day: 26, hour: 8, minute: 0, second: 0 };
    expect(zonedCivilToUtcIso(before, 'Europe/Amsterdam')).toBe('2026-10-24T06:00:00.000Z');
    expect(zonedCivilToUtcIso(after, 'Europe/Amsterdam')).toBe('2026-10-26T07:00:00.000Z');
  });

  it('reads one instant as different civil days in Shanghai and Mexico City', () => {
    const instant = '2026-10-27T03:00:00.000Z';
    expect(civilDayKey(utcToZonedCivil(instant, 'Asia/Shanghai'))).toBe('2026-10-27');
    expect(civilDayKey(utcToZonedCivil(instant, 'America/Mexico_City'))).toBe('2026-10-26');
  });
});

/* ------------------------------------------------- overrides + cancellations */

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'evt-1',
    org_id: 'org-1',
    horse_id: 'horse-1',
    type: 'training',
    title: 'Interval work',
    notes: null,
    starts_at: '2026-10-20T06:00:00.000Z',
    ends_at: '2026-10-20T07:00:00.000Z',
    all_day: false,
    timezone: 'Europe/Amsterdam',
    location_id: null,
    assignee_id: 'trainer-1',
    status: 'planned',
    created_by: 'trainer-1',
    targets: null,
    training_type: null,
    recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU,TH',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function override(overrides: Partial<CalendarEventOverride>): CalendarEventOverride {
  return {
    id: 'ovr-1',
    event_id: 'evt-1',
    original_start: '2026-10-22T06:00:00.000Z',
    cancelled: false,
    starts_at: null,
    ends_at: null,
    title: null,
    notes: null,
    assignee_id: null,
    status: null,
    targets: null,
    created_at: '2026-10-02T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

const WEEK = {
  rangeStartUtc: '2026-10-19T00:00:00.000Z',
  rangeEndUtc: '2026-11-01T00:00:00.000Z',
};

describe('golden: overrides and cancellations', () => {
  it('a moved occurrence keeps its duration and its original_start key', () => {
    const result = queryOccurrences(
      [event({})],
      // Thu 22 Oct moved to Fri 23 Oct 10:00 CEST (08:00Z).
      [override({ starts_at: '2026-10-23T08:00:00.000Z' })],
      WEEK,
    );
    const moved = result.occurrences.find(
      (o) => o.original_start === '2026-10-22T06:00:00.000Z',
    );
    expect(moved?.starts_at).toBe('2026-10-23T08:00:00.000Z');
    expect(moved?.ends_at).toBe('2026-10-23T09:00:00.000Z');
    expect(moved?.key).toBe('evt-1@2026-10-22T06:00:00.000Z');
  });

  it('a cancelled occurrence is dropped by default and shown as cancelled on request', () => {
    const cancel = [override({ cancelled: true })];
    const hidden = queryOccurrences([event({})], cancel, WEEK);
    expect(hidden.occurrences.map((o) => o.starts_at)).toEqual([
      '2026-10-20T06:00:00.000Z',
      '2026-10-27T07:00:00.000Z',
      '2026-10-29T07:00:00.000Z',
    ]);

    const shown = queryOccurrences([event({})], cancel, { ...WEEK, includeCancelled: true });
    const cancelled = shown.occurrences.filter((o) => o.status === 'cancelled');
    expect(cancelled.map((o) => o.original_start)).toEqual(['2026-10-22T06:00:00.000Z']);
  });

  it('an override written with "+00:00" still matches the expanded "Z" instant', () => {
    const result = queryOccurrences(
      [event({})],
      [override({ original_start: '2026-10-22T06:00:00+00:00', title: 'Hill work' })],
      WEEK,
    );
    const titles = result.occurrences.map((o) => o.title);
    expect(titles).toContain('Hill work');
  });

  it('a soft-deleted override is ignored, a soft-deleted master is never shown', () => {
    const deletedOverride = queryOccurrences(
      [event({})],
      [override({ cancelled: true, deleted_at: '2026-10-03T00:00:00.000Z' })],
      WEEK,
    );
    expect(deletedOverride.occurrences).toHaveLength(4);

    const deletedMaster = queryOccurrences(
      [event({ deleted_at: '2026-10-03T00:00:00.000Z' })],
      [],
      { ...WEEK, includeCancelled: true },
    );
    expect(deletedMaster.occurrences).toHaveLength(0);
  });

  it('a horse-less (stable-wide) farrier visit matches horseId null, not a horse filter', () => {
    const farrier = event({
      id: 'evt-farrier',
      horse_id: null,
      type: 'farrier',
      recurrence_rule: null,
      starts_at: '2026-10-21T07:00:00.000Z',
      ends_at: null,
    });
    expect(queryOccurrences([farrier], [], { ...WEEK, horseId: null }).occurrences).toHaveLength(1);
    expect(
      queryOccurrences([farrier], [], { ...WEEK, horseId: 'horse-1' }).occurrences,
    ).toHaveLength(0);
  });
});

describe('golden: reader-day grouping', () => {
  it('a 06:00 Shanghai item lands on the previous day for a reader in Amsterdam', () => {
    const shanghai = event({
      id: 'evt-sh',
      recurrence_rule: null,
      timezone: 'Asia/Shanghai',
      starts_at: '2026-10-27T22:00:00.000Z', // Wed 28 Oct 06:00 Shanghai = Tue 27 Oct 23:00 CET
      ends_at: null,
    });
    const result = queryOccurrences([shanghai], [], WEEK);
    const monday = { year: 2026, month: 10, day: 26, hour: 0, minute: 0, second: 0 };
    const days = groupOccurrencesByReaderDay(result.occurrences, monday, 7, 'Europe/Amsterdam');
    const withItem = days.filter((d) => d.occurrences.length > 0).map((d) => d.dayKey);
    expect(withItem).toEqual([civilDayKey(addCivilDays(monday, 1))]); // Tue 27 Oct
  });
});
