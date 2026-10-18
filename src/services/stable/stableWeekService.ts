import type { EventOccurrence } from '@/types/calendar';

/**
 * One week of a whole stable, horse by horse.
 *
 * Every other view in this product answers "how is this horse". Nobody
 * answered "how is my stable this week", which is the question the person
 * paying for it actually has: who worked, who did not, which plans passed
 * without a recording, and which recordings never finished.
 *
 * PURE. Counts, sums and the absence of them. There is no load index, no
 * readiness, no over/under-worked, and no ordering by "needs attention" —
 * a sort order is an opinion, so the rows come back alphabetically and the
 * reader decides what matters.
 *
 * "Not recorded" is a fact, not a reproach: a planned item whose end has
 * passed, still marked planned, with no session pointing at it. It covers the
 * horse that was ridden while the phone sat in the tack room just as much as
 * the one that was never ridden, and the two are indistinguishable from here.
 * That is precisely why it is worth showing.
 */

export interface StableWeekHorse {
  id: string;
  name: string;
}

export interface StableWeekSession {
  id: string;
  horse_id: string;
  started_at: string;
  ended_at: string | null;
  planned_event_id?: string | null;
}

export interface StableWeekInput {
  horses: readonly StableWeekHorse[];
  sessions: readonly StableWeekSession[];
  /** Planned occurrences falling inside the window. */
  occurrences: readonly EventOccurrence[];
  /** The moment the week is being judged against — usually now. */
  nowMs: number;
}

export interface HorseWeekRow {
  horseId: string;
  horseName: string;
  sessionCount: number;
  /** Summed duration of finished sessions, in whole minutes. */
  recordedMinutes: number;
  /** Recordings that started and never ended. */
  unfinishedSessions: number;
  plannedCount: number;
  plannedDone: number;
  /** Planned, the moment has passed, and nothing was recorded against it. */
  plannedNotRecorded: number;
  /** Still ahead of `nowMs`. */
  plannedUpcoming: number;
  lastSessionAt: string | null;
}

export interface StableWeekTotals {
  horses: number;
  horsesWithoutSession: number;
  sessions: number;
  recordedMinutes: number;
  planned: number;
  plannedDone: number;
  plannedNotRecorded: number;
  plannedUpcoming: number;
  unfinishedSessions: number;
}

export interface StableWeek {
  rows: HorseWeekRow[];
  totals: StableWeekTotals;
  /** Planned items with no horse — a farrier round, a team meeting. */
  stableWideOccurrences: number;
}

function emptyRow(horse: StableWeekHorse): HorseWeekRow {
  return {
    horseId: horse.id,
    horseName: horse.name,
    sessionCount: 0,
    recordedMinutes: 0,
    unfinishedSessions: 0,
    plannedCount: 0,
    plannedDone: 0,
    plannedNotRecorded: 0,
    plannedUpcoming: 0,
    lastSessionAt: null,
  };
}

/** When an occurrence is over: its end, or its start for an open-ended item. */
function occurrenceEndMs(occurrence: EventOccurrence): number {
  const end = occurrence.ends_at ?? occurrence.starts_at;
  const ms = Date.parse(end);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

export function buildStableWeek(input: StableWeekInput): StableWeek {
  const rows = new Map<string, HorseWeekRow>();
  for (const horse of input.horses) rows.set(horse.id, emptyRow(horse));

  // Which plans a recording was actually started from. A session carries the
  // MASTER event's id, so a weekly series resolves to one id for all of its
  // occurrences — good enough to answer "was this plan acted on at all",
  // which is the question the column asks.
  const recordedPlans = new Set<string>();
  for (const session of input.sessions) {
    if (session.planned_event_id) recordedPlans.add(session.planned_event_id);
  }

  for (const session of input.sessions) {
    const row = rows.get(session.horse_id);
    if (row === undefined) continue;
    row.sessionCount += 1;
    if (session.ended_at === null) {
      row.unfinishedSessions += 1;
    } else {
      const ms = Date.parse(session.ended_at) - Date.parse(session.started_at);
      if (Number.isFinite(ms) && ms > 0) row.recordedMinutes += ms / 60_000;
    }
    if (
      row.lastSessionAt === null ||
      Date.parse(session.started_at) > Date.parse(row.lastSessionAt)
    ) {
      row.lastSessionAt = session.started_at;
    }
  }

  let stableWideOccurrences = 0;
  for (const occurrence of input.occurrences) {
    if (occurrence.status === 'cancelled') continue;
    if (occurrence.horse_id === null) {
      stableWideOccurrences += 1;
      continue;
    }
    const row = rows.get(occurrence.horse_id);
    if (row === undefined) continue;
    row.plannedCount += 1;
    if (occurrence.status === 'done') {
      row.plannedDone += 1;
    } else if (occurrenceEndMs(occurrence) > input.nowMs) {
      row.plannedUpcoming += 1;
    } else if (recordedPlans.has(occurrence.event_id)) {
      // Acted on, even though nobody marked it done. Counting this as "not
      // recorded" would be calling a trainer careless for not tapping a
      // button after a ride.
      row.plannedDone += 1;
    } else {
      row.plannedNotRecorded += 1;
    }
  }

  const ordered = [...rows.values()]
    .map((row) => ({ ...row, recordedMinutes: Math.round(row.recordedMinutes) }))
    .sort((a, b) => a.horseName.localeCompare(b.horseName));

  const totals = ordered.reduce<StableWeekTotals>(
    (acc, row) => ({
      horses: acc.horses + 1,
      horsesWithoutSession:
        acc.horsesWithoutSession + (row.sessionCount === 0 ? 1 : 0),
      sessions: acc.sessions + row.sessionCount,
      recordedMinutes: acc.recordedMinutes + row.recordedMinutes,
      planned: acc.planned + row.plannedCount,
      plannedDone: acc.plannedDone + row.plannedDone,
      plannedNotRecorded: acc.plannedNotRecorded + row.plannedNotRecorded,
      plannedUpcoming: acc.plannedUpcoming + row.plannedUpcoming,
      unfinishedSessions: acc.unfinishedSessions + row.unfinishedSessions,
    }),
    {
      horses: 0,
      horsesWithoutSession: 0,
      sessions: 0,
      recordedMinutes: 0,
      planned: 0,
      plannedDone: 0,
      plannedNotRecorded: 0,
      plannedUpcoming: 0,
      unfinishedSessions: 0,
    },
  );

  return { rows: ordered, totals, stableWideOccurrences };
}
