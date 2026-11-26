import { describe, expect, it } from 'vitest';
import { reminderEventInput } from './healthReminderEvent';
import { filterContacts } from '@/services/contacts/contactService';
import type { ContactRow } from '@/types/db';

describe('vaccination reminder event', () => {
  it('is an all-day vet item 14 days before expiry, on the horse', () => {
    const input = reminderEventInput({
      horseId: 'h1',
      horseName: 'Luna',
      title: 'Influenza',
      validUntil: '2026-12-20',
      timeZone: 'Europe/Amsterdam',
      titleTemplate: '{title} for {horse} expires {date}',
    });
    expect(input).toMatchObject({ type: 'vet', all_day: true, horse_id: 'h1', title: 'Influenza for Luna expires 2026-12-20' });
    // Midnight 6 Dec in Amsterdam = 23:00 UTC on the 5th.
    expect(input.starts_at).toBe('2026-12-05T23:00:00.000Z');
  });
});

describe('contact search', () => {
  const c = (over: Partial<ContactRow>): ContactRow => ({
    id: 'c', org_id: 'o', name: 'Dr. Bégin', role: 'vet', company: 'Paardenkliniek Breda',
    phone: '+31 6 1234', email: 'begin@example.com', notes: null, created_by: null,
    created_at: '', updated_at: '', deleted_at: null, ...over,
  });

  it('matches without accents and filters by role', () => {
    const list = [c({}), c({ id: 'f', name: 'Jan Smit', role: 'farrier', company: null, email: null })];
    expect(filterContacts(list, { query: 'begin', role: null }).map((x) => x.id)).toEqual(['c']);
    expect(filterContacts(list, { query: '', role: 'farrier' }).map((x) => x.id)).toEqual(['f']);
    expect(filterContacts(list, { query: 'kliniek', role: 'vet' })).toHaveLength(1);
  });
});
