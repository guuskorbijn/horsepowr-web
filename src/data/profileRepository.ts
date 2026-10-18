import type { Supa } from '@/lib/supabase/types';
import type { ProfileRow } from '@/types/db';
import { unwrap, unwrapMaybe } from '@/data/errors';

/**
 * Profiles repository.
 *
 * Two SELECT policies apply: `profiles_self_read` (your own row) and
 * `profiles_org_read` (everyone in your org). The second is what makes an
 * assignee picker possible — without it the agenda could only ever assign
 * work to yourself.
 */
export async function getCurrentProfile(supa: Supa): Promise<ProfileRow | null> {
  const { data } = await supa.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null;

  return unwrapMaybe(
    await supa.from('profiles').select('*').eq('id', userId).maybeSingle(),
    'getCurrentProfile',
  );
}

/**
 * Everyone in the org, for the agenda's assignee picker.
 *
 * Ordered by name so the list is stable between renders; rows with no name
 * fall back to their email in the UI, not here, because the repository's job
 * is the row and not its label.
 */
export async function listOrgProfiles(
  supa: Supa,
  orgId: string,
): Promise<ProfileRow[]> {
  return unwrap<ProfileRow[]>(
    await supa
      .from('profiles')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true }),
    'listOrgProfiles',
  );
}
