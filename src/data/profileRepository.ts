import type { Supa } from '@/lib/supabase/types';
import type { ProfileRow } from '@/types/db';
import { unwrapMaybe } from '@/data/errors';

/**
 * Profiles repository. RLS lets a user read only their own profile row
 * (profiles_self_read), so this is always the signed-in user's profile.
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
