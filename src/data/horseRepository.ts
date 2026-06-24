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
