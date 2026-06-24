import type { Supa } from '@/lib/supabase/types';
import type { MeasurementRow } from '@/types/db';
import { unwrap } from '@/data/errors';

/** Supabase caps a single select; page through so long sessions load fully. */
const PAGE_SIZE = 1000;

/**
 * Reads all measurement rows for a session, ordered by timestamp. HR and GPS
 * are separate rows (correlated by timestamp) — callers filter by field. Paged
 * so an 80-minute session (potentially tens of thousands of rows) loads fully.
 */
export async function getMeasurements(
  supa: Supa,
  sessionId: string,
): Promise<MeasurementRow[]> {
  const all: MeasurementRow[] = [];
  let from = 0;
  // Bounded loop: stop when a page returns fewer rows than the page size.
  for (;;) {
    const page = unwrap(
      await supa
        .from('measurements')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .range(from, from + PAGE_SIZE - 1),
      'getMeasurements',
    );
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
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
