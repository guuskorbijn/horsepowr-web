import type { Supa } from '@/lib/supabase/types';
import type { SessionGaitSegmentsRow } from '@/types/db';
import { unwrapMaybe } from '@/data/errors';

/**
 * Reads the cached gait segments for a session, if present. This is a
 * recomputable cache written by the mobile app; the web app reads it but never
 * writes gait back onto measurements. When absent, the session view derives
 * segments on read from GPS speed (see gaitService).
 */
export async function getGaitSegments(
  supa: Supa,
  sessionId: string,
): Promise<SessionGaitSegmentsRow | null> {
  return unwrapMaybe(
    await supa
      .from('session_gait_segments')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle(),
    'getGaitSegments',
  );
}
