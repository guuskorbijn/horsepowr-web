import type { Supa } from '@/lib/supabase/types';

/**
 * A recording stand-in for the PostgREST query builder, for unit tests only.
 *
 * Every filter call is captured per query, and awaiting the chain asks
 * `respond` for the result. That is enough to assert WHAT is asked of the
 * database (filters, ordering, pages) and how the caller behaves on each
 * answer, without a database.
 */
export interface Call {
  method: string;
  args: unknown[];
}

export interface FakeResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export type Responder = (calls: Call[]) => FakeResult;

const METHODS = [
  'select', 'eq', 'is', 'lt', 'gt', 'gte', 'lte', 'or', 'not', 'in', 'order',
  'range', 'limit', 'maybeSingle', 'single', 'insert', 'upsert',
] as const;

export function fakeSupa(respond: Responder): { supa: Supa; queries: Call[][] } {
  const queries: Call[][] = [];
  const from = (table: string) => {
    const calls: Call[] = [{ method: 'from', args: [table] }];
    queries.push(calls);
    const builder: Record<string, unknown> = {};
    for (const method of METHODS) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      try {
        return resolve(respond(calls));
      } catch (err) {
        return reject ? reject(err) : Promise.reject(err);
      }
    };
    return builder;
  };
  return { supa: { from } as unknown as Supa, queries };
}

/** The table a recorded query targeted. */
export function tableOf(calls: Call[]): string {
  return String(calls[0]?.args[0] ?? '');
}

/** The [from, to] of a recorded `.range()`, or [0, 0]. */
export function rangeOf(calls: Call[]): [number, number] {
  const call = calls.find((c) => c.method === 'range');
  return call ? [call.args[0] as number, call.args[1] as number] : [0, 0];
}
