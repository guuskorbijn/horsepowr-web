/**
 * A horse's training load on the calendar: minutes per day for a heat map,
 * minutes per week for a sparkline, and the last four weeks next to the four
 * before them. PURE. Measured durations only, stated as numbers — "6 sessions,
 * 4 h 10 min; the four weeks before: 5, 3 h 40" — never "more" as a verdict.
 */

export interface SessionSpan {
  started_at: string;
  ended_at: string | null;
}

export interface HeatDay {
  dayKey: string;
  minutes: number;
  sessions: number;
}

export interface TrainingCalendar {
  /** Columns of 7 days (Mon..Sun), oldest first. */
  weeks: HeatDay[][];
  weekMinutes: number[];
  maxDayMinutes: number;
  recent: { sessions: number; minutes: number };
  previous: { sessions: number; minutes: number };
}

const DAY_MS = 86_400_000;

function dayKeyOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Days are UTC calendar days of the session start: stable and good enough at day resolution. */
export function buildTrainingCalendar(
  sessions: readonly SessionSpan[],
  todayKey: string,
  weeksBack = 26,
): TrainingCalendar {
  const byDay = new Map<string, HeatDay>();
  for (const s of sessions) {
    if (s.ended_at === null) continue;
    const start = Date.parse(s.started_at);
    const end = Date.parse(s.ended_at);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    const key = dayKeyOf(start);
    const day = byDay.get(key) ?? { dayKey: key, minutes: 0, sessions: 0 };
    day.minutes += Math.round((end - start) / 60_000);
    day.sessions += 1;
    byDay.set(key, day);
  }

  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const isoDow = (new Date(today).getUTCDay() + 6) % 7; // Mon = 0
  const lastMonday = today - isoDow * DAY_MS;
  const firstMonday = lastMonday - (weeksBack - 1) * 7 * DAY_MS;

  const weeks: HeatDay[][] = [];
  for (let w = 0; w < weeksBack; w++) {
    const col: HeatDay[] = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKeyOf(firstMonday + (w * 7 + d) * DAY_MS);
      col.push(byDay.get(key) ?? { dayKey: key, minutes: 0, sessions: 0 });
    }
    weeks.push(col);
  }
  const all = weeks.flat();
  const sum = (from: number, to: number) => {
    const days = all.filter((d) => {
      const t = Date.parse(`${d.dayKey}T00:00:00Z`);
      return t > from && t <= to;
    });
    return {
      sessions: days.reduce((n, d) => n + d.sessions, 0),
      minutes: days.reduce((n, d) => n + d.minutes, 0),
    };
  };

  return {
    weeks,
    weekMinutes: weeks.map((col) => col.reduce((n, d) => n + d.minutes, 0)),
    maxDayMinutes: Math.max(0, ...all.map((d) => d.minutes)),
    recent: sum(today - 28 * DAY_MS, today),
    previous: sum(today - 56 * DAY_MS, today - 28 * DAY_MS),
  };
}
