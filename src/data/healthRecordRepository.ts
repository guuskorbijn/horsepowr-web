import type { Supa } from '@/lib/supabase/types';
import { unwrap } from '@/data/errors';
import type { HealthRecordKind, HealthRecordRow } from '@/types/db';

/**
 * Health notes per horse: what the stable writes down (a vaccination and its
 * expiry, a deworming, a note after the vet). Stored and shown verbatim.
 */

export interface HealthRecordInput {
  kind: HealthRecordKind;
  occurred_on: string;
  title: string;
  body: string | null;
  valid_until: string | null;
}

export async function listHealthRecordsForHorse(supa: Supa, horseId: string): Promise<HealthRecordRow[]> {
  return unwrap<HealthRecordRow[]>(
    await supa
      .from('horse_health_records')
      .select('*')
      .eq('horse_id', horseId)
      .is('deleted_at', null)
      .order('occurred_on', { ascending: false }),
    'listHealthRecordsForHorse',
  );
}

/** Every record that can expire, for the org-wide reminder. */
export async function listExpiringCandidates(supa: Supa, orgId: string): Promise<HealthRecordRow[]> {
  return unwrap<HealthRecordRow[]>(
    await supa
      .from('horse_health_records')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .not('valid_until', 'is', null)
      .order('valid_until', { ascending: true })
      .limit(1000),
    'listExpiringCandidates',
  );
}

export async function createHealthRecord(
  supa: Supa,
  ctx: { orgId: string; userId: string; horseId: string },
  input: HealthRecordInput,
): Promise<HealthRecordRow> {
  return unwrap<HealthRecordRow>(
    await supa
      .from('horse_health_records')
      .insert({ ...input, org_id: ctx.orgId, horse_id: ctx.horseId, created_by: ctx.userId })
      .select('*')
      .single(),
    'createHealthRecord',
  );
}

export async function updateHealthRecord(supa: Supa, id: string, input: HealthRecordInput): Promise<HealthRecordRow> {
  return unwrap<HealthRecordRow>(
    await supa.from('horse_health_records').update(input).eq('id', id).select('*').single(),
    'updateHealthRecord',
  );
}

export async function softDeleteHealthRecord(supa: Supa, id: string): Promise<void> {
  unwrap(
    await supa
      .from('horse_health_records')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('id'),
    'softDeleteHealthRecord',
  );
}
