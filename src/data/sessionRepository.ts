import type { Supa } from '@/lib/supabase/types';
import type { SessionRow } from '@/types/db';
import { unwrap, unwrapMaybe } from '@/data/errors';

export interface ListSessionsOptions {
  /** Only sessions that have ended (ended_at not null). */
  finishedOnly?: boolean;
  limit?: number;
}

function applyOptions(
  query: ReturnType<ReturnType<Supa['from']>['select']>,
  options: ListSessionsOptions,
) {
  let q = query;
  if (options.finishedOnly) q = q.not('ended_at', 'is', null);
  q = q.order('started_at', { ascending: false });
  if (options.limit) q = q.limit(options.limit);
  return q;
}

export async function listSessionsForHorse(
  supa: Supa,
  horseId: string,
  options: ListSessionsOptions = {},
): Promise<SessionRow[]> {
  const query = supa.from('sessions').select('*').eq('horse_id', horseId);
  return unwrap(await applyOptions(query, options), 'listSessionsForHorse');
}

/** Sessions across many horses (org/location-scoped lists). Empty input -> []. */
export async function listSessionsForHorses(
  supa: Supa,
  horseIds: string[],
  options: ListSessionsOptions = {},
): Promise<SessionRow[]> {
  if (horseIds.length === 0) return [];
  const query = supa.from('sessions').select('*').in('horse_id', horseIds);
  return unwrap(await applyOptions(query, options), 'listSessionsForHorses');
}

export async function getSession(supa: Supa, id: string): Promise<SessionRow | null> {
  return unwrapMaybe(
    await supa.from('sessions').select('*').eq('id', id).maybeSingle(),
    'getSession',
  );
}

/** Most recent session for a horse, or null. */
export async function getLastSessionForHorse(
  supa: Supa,
  horseId: string,
): Promise<SessionRow | null> {
  const rows = await listSessionsForHorse(supa, horseId, { limit: 1 });
  return rows[0] ?? null;
}
