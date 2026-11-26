import { describe, expect, it } from 'vitest';
import { buildTrainingCalendar } from './trainingCalendar';

describe('buildTrainingCalendar', () => {
  const s = (start: string, min: number) => ({ started_at: start, ended_at: new Date(Date.parse(start) + min * 60_000).toISOString() });
  const cal = buildTrainingCalendar(
    [s('2026-11-25T08:00:00Z', 45), s('2026-11-25T15:00:00Z', 30), s('2026-10-20T08:00:00Z', 60), { started_at: '2026-11-24T08:00:00Z', ended_at: null }],
    '2026-11-26',
  );
  it('builds Monday-first weeks ending this week', () => {
    expect(cal.weeks).toHaveLength(26);
    expect(cal.weeks[25]?.[0]?.dayKey).toBe('2026-11-23');
    expect(cal.weeks[25]?.[2]).toMatchObject({ dayKey: '2026-11-25', minutes: 75, sessions: 2 });
  });
  it('compares the last 4 weeks with the 4 before, ignoring unfinished sessions', () => {
    expect(cal.recent).toEqual({ sessions: 2, minutes: 75 });
    expect(cal.previous).toEqual({ sessions: 1, minutes: 60 });
  });
});
