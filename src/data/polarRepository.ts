import type { Supa } from '@/lib/supabase/types';
import { unwrap, unwrapMaybe } from '@/data/errors';

/**
 * Polar AccessLink: the inbox of rides fetched from Polar, and the calls to
 * the `polar-accesslink` Edge Function that holds the tokens.
 *
 * Tokens never pass through here — `polar_connections.access_token` is not
 * even selectable by this client (column grants). This module only sees the
 * connection STATUS, through the function.
 */

export interface PolarInboxItem {
  id: string;
  user_id: string;
  polar_exercise_id: string;
  started_at: string;
  duration_sec: number | null;
  sport: string | null;
  has_hr: boolean;
  suggested_horse_id: string | null;
}

export interface PolarInboxRecord extends PolarInboxItem {
  org_id: string;
  tcx: string;
  status: 'pending' | 'imported' | 'dismissed';
}

export interface PolarConnectionStatus {
  status: 'active' | 'revoked' | 'error';
  connectedAt: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface PolarStatus {
  /** False until Polar has approved the client and the secrets are set. */
  configured: boolean;
  connection: PolarConnectionStatus | null;
}

const LIST_COLUMNS =
  'id, user_id, polar_exercise_id, started_at, duration_sec, sport, has_hr, suggested_horse_id';

/** Rides waiting for a horse, newest first. Never the TCX — it is large. */
export async function listPendingInbox(supa: Supa, limit = 50): Promise<PolarInboxItem[]> {
  return unwrap<PolarInboxItem[]>(
    await supa
      .from('polar_inbox')
      .select(LIST_COLUMNS)
      .eq('status', 'pending')
      .order('started_at', { ascending: false })
      .limit(limit),
    'listPendingInbox',
  );
}

export async function getInboxRecord(supa: Supa, id: string): Promise<PolarInboxRecord | null> {
  return unwrapMaybe<PolarInboxRecord>(
    await supa.from('polar_inbox').select('*').eq('id', id).maybeSingle(),
    'getInboxRecord',
  );
}

export async function setInboxStatus(
  supa: Supa,
  id: string,
  status: 'imported' | 'dismissed',
  sessionId: string | null,
): Promise<void> {
  unwrap(
    await supa
      .from('polar_inbox')
      .update({ status, session_id: sessionId })
      .eq('id', id)
      .select('id'),
    'setInboxStatus',
  );
}

export type PolarAction = 'status' | 'authorize' | 'sync' | 'disconnect';

export interface PolarActionResult extends Partial<PolarStatus> {
  url?: string;
  fetched?: number;
  skipped?: number;
  error?: string;
}

export async function invokePolar(supa: Supa, action: PolarAction): Promise<PolarActionResult> {
  const { data, error } = await supa.functions.invoke<PolarActionResult>('polar-accesslink', {
    body: { action },
  });
  if (error) throw new Error(`polar-accesslink ${action}: ${error.message}`);
  return data ?? {};
}
