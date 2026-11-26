import type { Supa } from '@/lib/supabase/types';
import { unwrap } from '@/data/errors';
import { parseTargetsOrNull as parseTargetsWithContext, type TrainingTargets } from '@/services/calendar/trainingTargets';

function parseTargetsOrNull(raw: unknown): TrainingTargets | null {
  return parseTargetsWithContext(raw, { eventId: 'template' });
}

/** Training templates and agenda-item checklists (migration 20261127000001). */

export interface TrainingTemplate {
  id: string;
  name: string;
  training_type: string | null;
  duration_min: number | null;
  targets: TrainingTargets | null;
}

export interface ChecklistItem {
  id: string;
  event_id: string;
  label: string;
  done: boolean;
  position: number;
  updated_by: string | null;
}

export async function listTemplates(supa: Supa, orgId: string): Promise<TrainingTemplate[]> {
  const rows = unwrap<Array<Omit<TrainingTemplate, 'targets'> & { targets: unknown }>>(
    await supa
      .from('training_templates')
      .select('id, name, training_type, duration_min, targets')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    'listTemplates',
  );
  // Same tolerance as agenda targets: a malformed blob degrades to "no target".
  return rows.map((r) => ({ ...r, targets: parseTargetsOrNull(r.targets) }));
}

export async function createTemplate(
  supa: Supa,
  orgId: string,
  userId: string,
  input: Omit<TrainingTemplate, 'id'>,
): Promise<TrainingTemplate> {
  const row = unwrap<Omit<TrainingTemplate, 'targets'> & { targets: unknown }>(
    await supa
      .from('training_templates')
      .insert({ ...input, org_id: orgId, created_by: userId })
      .select('id, name, training_type, duration_min, targets')
      .single(),
    'createTemplate',
  );
  return { ...row, targets: parseTargetsOrNull(row.targets) };
}

export async function listChecklistsForEvents(supa: Supa, eventIds: readonly string[]): Promise<ChecklistItem[]> {
  if (eventIds.length === 0) return [];
  return unwrap<ChecklistItem[]>(
    await supa
      .from('event_checklist_items')
      .select('id, event_id, label, done, position, updated_by')
      .in('event_id', eventIds as string[])
      .order('position', { ascending: true }),
    'listChecklistsForEvents',
  );
}

export async function setChecklistDone(supa: Supa, id: string, done: boolean): Promise<void> {
  unwrap(
    await supa.from('event_checklist_items').update({ done }).eq('id', id).select('id'),
    'setChecklistDone',
  );
}

export async function addChecklistItem(
  supa: Supa,
  input: { orgId: string; eventId: string; label: string; position: number },
): Promise<ChecklistItem> {
  return unwrap<ChecklistItem>(
    await supa
      .from('event_checklist_items')
      .insert({ org_id: input.orgId, event_id: input.eventId, label: input.label, position: input.position })
      .select('id, event_id, label, done, position, updated_by')
      .single(),
    'addChecklistItem',
  );
}

export async function removeChecklistItem(supa: Supa, id: string): Promise<void> {
  unwrap(await supa.from('event_checklist_items').delete().eq('id', id).select('id'), 'removeChecklistItem');
}
