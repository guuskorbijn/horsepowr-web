import { describe, expect, it } from 'vitest';
import { inDateRange } from '@/services/analyst/lists';

/**
 * Regression fixtures for the date-only `to` bug: a session at 05:10Z on a day
 * must match a single-day query for that day. Before the fix, `to: "2026-06-21"`
 * parsed to midnight and excluded everything later that day.
 */
const AFTERNOON = '2026-06-21T05:10:00+00:00'; // Luna's real 21 June session
const LATE = '2026-06-21T23:59:00+00:00';

describe('inDateRange', () => {
  it('matches a same-day session for a single date-only day [D, D]', () => {
    expect(inDateRange(AFTERNOON, '2026-06-21', '2026-06-21')).toBe(true);
    expect(inDateRange(LATE, '2026-06-21', '2026-06-21')).toBe(true);
  });

  it('excludes days outside a date-only range', () => {
    expect(inDateRange('2026-06-22T05:10:00+00:00', '2026-06-21', '2026-06-21')).toBe(false);
    expect(inDateRange('2026-06-20T23:00:00+00:00', '2026-06-21', '2026-06-21')).toBe(false);
  });

  it('honours an open-ended range', () => {
    expect(inDateRange(AFTERNOON, '2026-06-01', undefined)).toBe(true);
    expect(inDateRange(AFTERNOON, undefined, '2026-06-30')).toBe(true);
    expect(inDateRange(AFTERNOON, undefined, undefined)).toBe(true);
  });

  it('treats a datetime `to` as an exact instant (not a whole day)', () => {
    expect(inDateRange(AFTERNOON, undefined, '2026-06-21T06:00:00+00:00')).toBe(true);
    expect(inDateRange(AFTERNOON, undefined, '2026-06-21T05:00:00+00:00')).toBe(false);
  });

  it('rejects an unparseable session timestamp', () => {
    expect(inDateRange('not-a-date', undefined, undefined)).toBe(false);
  });
});
