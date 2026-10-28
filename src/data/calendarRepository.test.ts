import { describe, expect, it } from 'vitest';
import {
  CALENDAR_PAGE_SIZE,
  listEvents,
  listEventsInWindow,
  listOverrides,
} from '@/data/calendarRepository';
import { fakeSupa, rangeOf, type Call } from '@/test/fakeSupabase';

function row(id: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    org_id: 'org-a',
    horse_id: 'horse-1',
    type: 'training',
    title: `Item ${id}`,
    notes: null,
    starts_at: '2026-10-27T07:00:00+00:00',
    ends_at: null,
    all_day: false,
    timezone: 'Europe/Amsterdam',
    location_id: null,
    assignee_id: null,
    status: 'planned',
    created_by: 'user-1',
    targets: null,
    recurrence_rule: null,
    created_at: '2026-10-01T00:00:00+00:00',
    updated_at: '2026-10-01T00:00:00+00:00',
    deleted_at: null,
    ...patch,
  };
}

const isRecurringQuery = (calls: Call[]) => calls.some((c) => c.method === 'not');

describe('listEventsInWindow', () => {
  it('keeps paging past 1000 rows and stops only on an empty page', async () => {
    // 1200 one-offs, served in pages capped at 1000 by a "server" that
    // ignores the requested page size above its own max-rows.
    const all = Array.from({ length: 1200 }, (_, i) => row(`e${String(i).padStart(4, '0')}`));
    const { supa, queries } = fakeSupa((calls) => {
      if (isRecurringQuery(calls)) return { data: [], error: null };
      const [from, to] = rangeOf(calls);
      return { data: all.slice(from, Math.min(to + 1, from + 1000)), error: null };
    });

    const events = await listEventsInWindow(supa, {
      orgId: 'org-a',
      startUtc: '2026-10-26T00:00:00.000Z',
      endUtc: '2026-11-02T00:00:00.000Z',
    });
    expect(events).toHaveLength(1200);
    const oneOffPages = queries.filter((q) => !isRecurringQuery(q));
    // 1200 / 500 = 3 full-ish pages, then one empty page that ends the loop.
    expect(oneOffPages).toHaveLength(Math.ceil(1200 / CALENDAR_PAGE_SIZE) + 1);
  });

  it('orders by starts_at then id, so a page boundary is deterministic', async () => {
    const { supa, queries } = fakeSupa(() => ({ data: [], error: null }));
    await listEventsInWindow(supa, { orgId: 'org-a', startUtc: '2026-10-26T00:00:00.000Z', endUtc: '2026-11-02T00:00:00.000Z' });
    for (const q of queries) {
      const orders = q.filter((c) => c.method === 'order').map((c) => c.args[0]);
      expect(orders).toEqual(['starts_at', 'id']);
    }
  });

  it('bounds recurring masters by starts_at < end only, and one-offs by overlap', async () => {
    const { supa, queries } = fakeSupa(() => ({ data: [], error: null }));
    await listEventsInWindow(supa, { orgId: 'org-a', startUtc: '2026-10-26T00:00:00.000Z', endUtc: '2026-11-02T00:00:00.000Z' });
    const recurring = queries.find(isRecurringQuery) ?? [];
    const oneOff = queries.find((q) => !isRecurringQuery(q)) ?? [];
    expect(recurring).toContainEqual({ method: 'lt', args: ['starts_at', '2026-11-02T00:00:00.000Z'] });
    expect(recurring.some((c) => c.method === 'or')).toBe(false);
    expect(oneOff.some((c) => c.method === 'or')).toBe(true);
    for (const q of queries) {
      expect(q).toContainEqual({ method: 'eq', args: ['org_id', 'org-a'] });
      expect(q).toContainEqual({ method: 'is', args: ['deleted_at', null] });
    }
  });

  it('drops a row from another org even if the database returned it (defense-in-depth)', async () => {
    const { supa } = fakeSupa((calls) =>
      rangeOf(calls)[0] === 0 && !isRecurringQuery(calls)
        ? { data: [row('mine'), row('theirs', { org_id: 'org-b', horse_id: null })], error: null }
        : { data: [], error: null },
    );
    const events = await listEventsInWindow(supa, { orgId: 'org-a', startUtc: '2026-10-26T00:00:00.000Z', endUtc: '2026-11-02T00:00:00.000Z' });
    expect(events.map((e) => e.id)).toEqual(['mine']);
  });

  it('drops (and logs) a row that fails validation instead of failing the agenda', async () => {
    const { supa } = fakeSupa((calls) =>
      rangeOf(calls)[0] === 0 && !isRecurringQuery(calls)
        ? { data: [row('ok'), row('bad', { type: 'party' })], error: null }
        : { data: [], error: null },
    );
    const events = await listEventsInWindow(supa, { orgId: 'org-a', startUtc: '2026-10-26T00:00:00.000Z', endUtc: '2026-11-02T00:00:00.000Z' });
    expect(events.map((e) => e.id)).toEqual(['ok']);
  });

  it('a horse filter includes stable-wide items and excludes other horses', async () => {
    const { supa } = fakeSupa((calls) =>
      rangeOf(calls)[0] === 0 && !isRecurringQuery(calls)
        ? { data: [row('h1'), row('yard', { horse_id: null }), row('h2', { horse_id: 'horse-2' })], error: null }
        : { data: [], error: null },
    );
    const events = await listEventsInWindow(supa, {
      orgId: 'org-a',
      horseId: 'horse-1',
      startUtc: '2026-10-26T00:00:00.000Z',
      endUtc: '2026-11-02T00:00:00.000Z',
    });
    expect(events.map((e) => e.id).sort()).toEqual(['h1', 'yard']);
  });

  it('surfaces a database error instead of returning an empty agenda', async () => {
    const { supa } = fakeSupa(() => ({ data: null, error: { message: 'permission denied', code: '42501' } }));
    await expect(
      listEventsInWindow(supa, { orgId: 'org-a', startUtc: '2026-10-26T00:00:00.000Z', endUtc: '2026-11-02T00:00:00.000Z' }),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('listEvents (text bounds)', () => {
  it('a date-only `to` covers the whole UTC day', async () => {
    const { supa, queries } = fakeSupa(() => ({ data: [], error: null }));
    await listEvents(supa, { orgId: 'org-a', from: '2026-10-27', to: '2026-10-27' });
    expect(queries[0]).toContainEqual({ method: 'lt', args: ['starts_at', '2026-10-28T00:00:00.000Z'] });
  });

  it('rejects an invalid date with an error naming the field', async () => {
    const { supa } = fakeSupa(() => ({ data: [], error: null }));
    await expect(listEvents(supa, { orgId: 'org-a', from: 'yesterday', to: '2026-10-27' })).rejects.toThrow(/"from"/);
  });
});

describe('listOverrides', () => {
  it('chunks large id lists and returns nothing without a query for none', async () => {
    const { supa, queries } = fakeSupa(() => ({ data: [], error: null }));
    expect(await listOverrides(supa, [])).toEqual([]);
    expect(queries).toHaveLength(0);

    const ids = Array.from({ length: 250 }, (_, i) => `evt-${i}`);
    await listOverrides(supa, ids);
    const inCalls = queries.map((q) => q.find((c) => c.method === 'in')?.args[1] as string[]);
    expect(inCalls.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
  });
});
