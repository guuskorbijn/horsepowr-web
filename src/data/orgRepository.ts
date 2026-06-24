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
