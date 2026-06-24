import type { Supa } from '@/lib/supabase/types';
import type { HorseRow } from '@/types/db';
import { unwrap, unwrapMaybe } from '@/data/errors';

export interface ListHorsesOptions {
  locationId?: string | null;
  activeOnly?: boolean;
}

/** Lists horses in an org (RLS-scoped), optionally filtered by location/active. */
export async function listHorses(
  supa: Supa,
  orgId: string,
  options: ListHorsesOptions = {},
): Promise<HorseRow[]> {
  let query = supa.from('horses').select('*').eq('org_id', orgId);
  if (options.locationId) query = query.eq('location_id', options.locationId);
  if (options.activeOnly) query = query.eq('active', true);
  query = query.order('name', { ascending: true });
  return unwrap(await query, 'listHorses');
}

export async function getHorse(supa: Supa, id: string): Promise<HorseRow | null> {
  return unwrapMaybe(
    await supa.from('horses').select('*').eq('id', id).maybeSingle(),
    'getHorse',
  );
}

export interface HorseInput {
  org_id: string;
  name: string;
  discipline: string | null;
  location_id: string | null;
  max_hr: number;
  active: boolean;
}

/** Creates a horse under RLS (trainer write only). Returns the new row. */
export async function createHorse(supa: Supa, input: HorseInput): Promise<HorseRow> {
  const rows = unwrap(await supa.from('horses').insert(input).select('*'), 'createHorse');
  const created = rows[0];
  if (!created) throw new Error('Could not create the horse. You may not have edit access.');
  return created;
}

/** Updates an existing horse (RLS trainer write). Returns the updated row. */
export async function updateHorse(
  supa: Supa,
  id: string,
  patch: Partial<Omit<HorseInput, 'org_id'>>,
): Promise<HorseRow> {
  const rows = unwrap(
    await supa.from('horses').update(patch).eq('id', id).select('*'),
    'updateHorse',
  );
  const updated = rows[0];
  if (!updated) throw new Error('Could not save the horse. You may not have edit access.');
  return updated;
}
