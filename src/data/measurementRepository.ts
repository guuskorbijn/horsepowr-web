import type { Supa } from '@/lib/supabase/types';
import type { MeasurementRow } from '@/types/db';
import { RepositoryError, unwrap } from '@/data/errors';

/**
 * Rows per page. Kept BELOW PostgREST's default `max-rows` (1000), and the
 * loop stops only on an EMPTY page: a "short page means done" loop stops
 * early whenever the server cap is lower than the page asked for, which is
 * how a long session silently loses its tail.
 */
const PAGE_SIZE = 1000;

/**
 * Reads all measurement rows for a session, ordered by timestamp. HR and GPS
 * are separate rows (correlated by timestamp) — callers filter by field. Paged
 * so an 80-minute session (potentially tens of thousands of rows) loads fully.
 *
 * Ordered by (timestamp, id): an HR row and a GPS row routinely share a
 * timestamp, and offset paging over a non-unique key can return one of them
 * twice and the other never. `id` makes the order total.
 */
export async function getMeasurements(
  supa: Supa,
  sessionId: string,
): Promise<MeasurementRow[]> {
  const all: MeasurementRow[] = [];
  for (;;) {
    const page = unwrap(
      await supa
        .from('measurements')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .order('id', { ascending: true })
        .range(all.length, all.length + PAGE_SIZE - 1),
      'getMeasurements',
    );
    if (page.length === 0) break;
    all.push(...page);
  }
  return all;
}

/** Exact number of measurement rows a session has on the server. */
export async function countMeasurements(supa: Supa, sessionId: string): Promise<number> {
  const { count, error } = await supa
    .from('measurements')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  if (error) throw new RepositoryError(`countMeasurements: ${error.message}`, error);
  if (count === null) throw new RepositoryError('countMeasurements: no count returned');
  return count;
}

/**
 * Appends rows, skipping any whose id is already stored.
 *
 * `ON CONFLICT DO NOTHING` (ignoreDuplicates), deliberately not a plain
 * upsert: `measurements` has an INSERT policy and no UPDATE policy — the
 * append-only guarantee — and an upsert that hits an existing row asks for
 * an UPDATE the database will refuse. DO NOTHING needs only INSERT, so a
 * retried import re-sends a chunk harmlessly and nothing is ever rewritten.
 *
 * Chunked; `onChunk` reports progress after each chunk commits.
 */
export async function insertMeasurementsIgnoringDuplicates(
  supa: Supa,
  rows: readonly MeasurementRow[],
  chunkSize: number,
  onChunk?: (written: number) => void,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supa
      .from('measurements')
      .upsert([...chunk], { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new RepositoryError(`insertMeasurements: ${error.message}`, error);
    onChunk?.(i + chunk.length);
  }
}

/** Lightweight count of HR vs GPS rows without pulling the whole series — used
 *  by the recording-quality card. */
export async function getMeasurementCounts(
  supa: Supa,
  sessionId: string,
): Promise<{ hr: number; gps: number }> {
  const hr = await supa
    .from('measurements')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .not('hr_bpm', 'is', null);
  const gps = await supa
    .from('measurements')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .not('lat', 'is', null);
  if (hr.error) throw hr.error;
  if (gps.error) throw gps.error;
  return { hr: hr.count ?? 0, gps: gps.count ?? 0 };
}
