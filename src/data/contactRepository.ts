import type { Supa } from '@/lib/supabase/types';
import { unwrap } from '@/data/errors';
import type { ContactRole, ContactRow, HorseContactRow } from '@/types/db';

/** The stable's address book: owners, vets, farriers, physios, riders. */

export interface ContactInput {
  name: string;
  role: ContactRole;
  company: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export async function listContacts(supa: Supa, orgId: string): Promise<ContactRow[]> {
  return unwrap<ContactRow[]>(
    await supa
      .from('contacts')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    'listContacts',
  );
}

export async function createContact(
  supa: Supa,
  orgId: string,
  userId: string,
  input: ContactInput,
): Promise<ContactRow> {
  return unwrap<ContactRow>(
    await supa
      .from('contacts')
      .insert({ ...input, org_id: orgId, created_by: userId })
      .select('*')
      .single(),
    'createContact',
  );
}

export async function updateContact(supa: Supa, id: string, input: ContactInput): Promise<ContactRow> {
  return unwrap<ContactRow>(
    await supa.from('contacts').update(input).eq('id', id).select('*').single(),
    'updateContact',
  );
}

/** A tombstone, like the agenda: there is no DELETE grant on contacts. */
export async function softDeleteContact(supa: Supa, id: string): Promise<void> {
  unwrap(
    await supa.from('contacts').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id'),
    'softDeleteContact',
  );
}

export async function listHorseContactLinks(supa: Supa): Promise<HorseContactRow[]> {
  return unwrap<HorseContactRow[]>(
    await supa.from('horse_contacts').select('*'),
    'listHorseContactLinks',
  );
}

export async function linkContactToHorse(supa: Supa, horseId: string, contactId: string): Promise<void> {
  unwrap(
    await supa
      .from('horse_contacts')
      .upsert({ horse_id: horseId, contact_id: contactId }, { onConflict: 'horse_id,contact_id', ignoreDuplicates: true })
      .select('horse_id'),
    'linkContactToHorse',
  );
}

export async function unlinkContactFromHorse(supa: Supa, horseId: string, contactId: string): Promise<void> {
  unwrap(
    await supa
      .from('horse_contacts')
      .delete()
      .eq('horse_id', horseId)
      .eq('contact_id', contactId)
      .select('horse_id'),
    'unlinkContactFromHorse',
  );
}
