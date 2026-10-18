import { describe, expect, it } from 'vitest';
import { buildStableWeek } from './stableWeekService';
import type { EventOccurrence } from '@/types/calendar';

const NOW = Date.parse('2026-10-21T12:00:00.000Z');

function occurrence(over: Partial<EventOccurrence> = {}): EventOccurrence {
  return {
    key: 'e1',
    event_id: 'e1',
    original_start: null,
    recurring: false,
    horse_id: 'h1',
    type: 'training',
    title: 'Conditioning',
    notes: null,
    starts_at: '2026-10-20T07:00:00.000Z',
    ends_at: '2026-10-20T08:00:00.000Z',
    all_day: false,
    timezone: 'Europe/Amsterdam',
    location_id: null,
    assignee_id: null,
    status: 'planned',
    targets: null,
    ...over,
  };
}

const horses = [
  { id: 'h1', name: 'Bella' },
  { id: 'h2', name: 'Atlas' },
];

describe('buildStableWeek', () => {
  it('sorts alphabetically rather than by anything that implies a verdict', () => {
    const week = buildStableWeek({
      horses,
      sessions: [],
      occurrences: [],
      nowMs: NOW,
    });
    expect(week.rows.map((r) => r.horseName)).toEqual(['Atlas', 'Bella']);
  });

  it('sums finished sessions and keeps the latest start', () => {
    const week = buildStableWeek({
      horses,
      sessions: [
        {
          id: 's1',
          horse_id: 'h1',
          started_at: '2026-10-19T07:00:00.000Z',
          ended_at: '2026-10-19T07:45:00.000Z',
        },
        {
          id: 's2',
          horse_id: 'h1',
          started_at: '2026-10-20T07:00:00.000Z',
          ended_at: '2026-10-20T08:00:00.000Z',
        },
      ],
      occurrences: [],
      nowMs: NOW,
    });
    const bella = week.rows.find((r) => r.horseId === 'h1');
    expect(bella?.sessionCount).toBe(2);
    expect(bella?.recordedMinutes).toBe(105);
    expect(bella?.lastSessionAt).toBe('2026-10-20T07:00:00.000Z');
  });

  it('counts a recording that never ended without adding phantom minutes', () => {
    const week = buildStableWeek({
      horses,
      sessions: [
        {
          id: 's1',
          horse_id: 'h1',
          started_at: '2026-10-20T07:00:00.000Z',
          ended_at: null,
        },
      ],
      occurrences: [],
      nowMs: NOW,
    });
    const bella = week.rows.find((r) => r.horseId === 'h1');
    expect(bella?.unfinishedSessions).toBe(1);
    expect(bella?.recordedMinutes).toBe(0);
    expect(week.totals.unfinishedSessions).toBe(1);
  });

  it('separates upcoming plans from ones whose moment has passed', () => {
    const week = buildStableWeek({
      horses,
      sessions: [],
      occurrences: [
        occurrence({ key: 'past', event_id: 'past' }),
        occurrence({
          key: 'future',
          event_id: 'future',
          starts_at: '2026-10-22T07:00:00.000Z',
          ends_at: '2026-10-22T08:00:00.000Z',
        }),
      ],
      nowMs: NOW,
    });
    const bella = week.rows.find((r) => r.horseId === 'h1');
    expect(bella?.plannedNotRecorded).toBe(1);
    expect(bella?.plannedUpcoming).toBe(1);
    expect(bella?.plannedCount).toBe(2);
  });

  it('treats a plan with a session against it as acted on, marked done or not', () => {
    const week = buildStableWeek({
      horses,
      sessions: [
        {
          id: 's1',
          horse_id: 'h1',
          started_at: '2026-10-20T07:05:00.000Z',
          ended_at: '2026-10-20T07:50:00.000Z',
          planned_event_id: 'e1',
        },
      ],
      occurrences: [occurrence()],
      nowMs: NOW,
    });
    const bella = week.rows.find((r) => r.horseId === 'h1');
    // Nobody tapped "done", but a recording points at the plan. Calling that
    // "not recorded" would be scolding a trainer for not tapping a button.
    expect(bella?.plannedDone).toBe(1);
    expect(bella?.plannedNotRecorded).toBe(0);
  });

  it('ignores cancelled occurrences entirely', () => {
    const week = buildStableWeek({
      horses,
      sessions: [],
      occurrences: [occurrence({ status: 'cancelled' })],
      nowMs: NOW,
    });
    expect(week.totals.planned).toBe(0);
  });

  it('counts stable-wide items separately from any horse', () => {
    const week = buildStableWeek({
      horses,
      sessions: [],
      occurrences: [occurrence({ horse_id: null, type: 'farrier' })],
      nowMs: NOW,
    });
    expect(week.stableWideOccurrences).toBe(1);
    expect(week.totals.planned).toBe(0);
  });

  it('counts the horses that did nothing at all', () => {
    const week = buildStableWeek({
      horses,
      sessions: [
        {
          id: 's1',
          horse_id: 'h1',
          started_at: '2026-10-20T07:00:00.000Z',
          ended_at: '2026-10-20T07:30:00.000Z',
        },
      ],
      occurrences: [],
      nowMs: NOW,
    });
    expect(week.totals.horsesWithoutSession).toBe(1);
  });

  it('ignores a session for a horse outside the stable list', () => {
    const week = buildStableWeek({
      horses,
      sessions: [
        {
          id: 's1',
          horse_id: 'ghost',
          started_at: '2026-10-20T07:00:00.000Z',
          ended_at: '2026-10-20T07:30:00.000Z',
        },
      ],
      occurrences: [],
      nowMs: NOW,
    });
    expect(week.totals.sessions).toBe(0);
  });
});
