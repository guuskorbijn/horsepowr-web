import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/data/profileRepository';
import { getOrganization, listLocations } from '@/data/orgRepository';
import { capabilitiesFor, type Capabilities } from '@/lib/roles';
import type { LocationRow, OrganizationRow, ProfileRow, UserRole } from '@/types/db';

/** Everything the shell + pages need about the signed-in user, fetched once. */
export interface SessionContext {
  userId: string;
  email: string;
  profile: ProfileRow;
  role: UserRole;
  capabilities: Capabilities;
  org: OrganizationRow | null;
  locations: LocationRow[];
}

/**
 * Loads the session context for a signed-in user, or null when there is no
 * authenticated user. Profiles without an org (e.g. a fresh signup not yet
 * assigned) return a context with a null org so the UI can show a "no access"
 * state rather than crashing.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return null;

  const profile = await getCurrentProfile(supa);
  if (!profile) return null;

  const org = profile.org_id ? await getOrganization(supa, profile.org_id) : null;
  const locations = profile.org_id ? await listLocations(supa, profile.org_id) : [];

  return {
    userId: user.id,
    email: user.email ?? profile.email ?? '',
    profile,
    role: profile.role,
    capabilities: capabilitiesFor(profile.role),
    org,
    locations,
  };
}

/** Like getSessionContext but redirects to /login when unauthenticated. Use in
 *  protected server components/layouts. */
export async function requireSessionContext(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  return ctx;
}
