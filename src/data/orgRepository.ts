import type { Supa } from '@/lib/supabase/types';
import type { LocationRow, OrganizationRow } from '@/types/db';
import { unwrap, unwrapMaybe } from '@/data/errors';

/** Reads the caller's organization (RLS: members read their own org). */
export async function getOrganization(
  supa: Supa,
  orgId: string,
): Promise<OrganizationRow | null> {
  return unwrapMaybe(
    await supa.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    'getOrganization',
  );
}

/** Lists locations in the org, alphabetical (RLS-scoped). */
export async function listLocations(supa: Supa, orgId: string): Promise<LocationRow[]> {
  return unwrap(
    await supa
      .from('locations')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true }),
    'listLocations',
  );
}

/** Creates a location under RLS (trainer write only). Returns the new row. */
export async function createLocation(
  supa: Supa,
  input: { org_id: string; name: string; country: string | null },
): Promise<LocationRow> {
  const rows = unwrap(await supa.from('locations').insert(input).select('*'), 'createLocation');
  const created = rows[0];
  if (!created) throw new Error('Could not create the location. You may not have edit access.');
  return created;
}

/** Updates a location (RLS trainer write). Returns the updated row. */
export async function updateLocation(
  supa: Supa,
  id: string,
  patch: { name?: string; country?: string | null },
): Promise<LocationRow> {
  const rows = unwrap(
    await supa.from('locations').update(patch).eq('id', id).select('*'),
    'updateLocation',
  );
  const updated = rows[0];
  if (!updated) throw new Error('Could not save the location. You may not have edit access.');
  return updated;
}
