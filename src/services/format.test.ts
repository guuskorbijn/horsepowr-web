import { describe, expect, it } from 'vitest';
import {
  daysSince,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  formatDayKey,
  formatDayRange,
  formatRelativeDay,
  formatTime,
} from '@/services/format';

// 09:30 UTC on 25 Oct 2026, the morning of the DST change in Amsterdam.
const RIDE = '2026-10-25T09:30:00.000Z';

describe('instants on the reader’s clock', () => {
  it('shows a Breda ride at Breda time and a Mexico ride at Mexico time, not UTC', () => {
    expect(formatDateTime(RIDE, 'Europe/Amsterdam')).toBe('25 Oct 2026, 10:30');
    expect(formatDateTime(RIDE, 'America/Mexico_City')).toBe('25 Oct 2026, 03:30');
    expect(formatTime(RIDE, 'Europe/Amsterdam')).toBe('10:30');
  });

  it('defaults to UTC, and survives an unknown zone instead of throwing', () => {
    expect(formatDateTime(RIDE)).toBe('25 Oct 2026, 09:30');
    expect(formatDateTime(RIDE, 'Mars/Olympus')).toBe('25 Oct 2026, 09:30');
  });

  it('puts the date on the reader’s calendar near midnight', () => {
    // 23:30 UTC on the 2nd is already the 3rd in Amsterdam (CET, UTC+1).
    expect(formatDate('2026-11-02T23:30:00Z', 'Europe/Amsterdam')).toBe('3 Nov 2026');
    expect(formatDate('2026-11-02T23:30:00Z', 'UTC')).toBe('2 Nov 2026');
  });

  it('counts "yesterday" by the reader’s days, not the server’s', () => {
    const now = new Date('2026-11-03T08:00:00Z'); // 09:00 on the 3rd in Amsterdam
    const ride = '2026-11-02T23:30:00Z'; // 00:30 on the 3rd in Amsterdam, still the 2nd in UTC
    expect(formatRelativeDay(ride, now, 'Europe/Amsterdam')).toBe('today');
    expect(formatRelativeDay(ride, now, 'UTC')).toBe('yesterday');
    expect(daysSince(ride, now, 'Europe/Amsterdam')).toBe(0);
  });
});

describe('calendar dates (no zone shift)', () => {
  it('formats a date of birth as a day, wherever the reader is', () => {
    expect(formatCalendarDate('2015-04-02')).toBe('2 Apr 2015');
    expect(formatCalendarDate('not a date')).toBe('not a date');
  });

  it('formats agenda day keys and ranges readably', () => {
    expect(formatDayKey('2026-11-03')).toBe('Tue 3 Nov 2026');
    expect(formatDayRange('2026-11-02', '2026-11-08')).toBe('2 – 8 Nov 2026');
    expect(formatDayRange('2026-11-30', '2026-12-06')).toBe('30 Nov – 6 Dec 2026');
    expect(formatDayRange('2026-12-28', '2027-01-03')).toBe('28 Dec 2026 – 3 Jan 2027');
  });
});
