import type { ContactRole, ContactRow } from '@/types/db';

/**
 * Search and filter for the contact list. PURE: matches name, company, phone
 * and e-mail case- and accent-insensitively, so "Bégin" finds "begin".
 */

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filterContacts(
  contacts: readonly ContactRow[],
  filter: { query: string; role: ContactRole | null },
): ContactRow[] {
  const q = fold(filter.query.trim());
  return contacts.filter((c) => {
    if (filter.role !== null && c.role !== filter.role) return false;
    if (q === '') return true;
    return [c.name, c.company, c.phone, c.email].some((v) => v !== null && fold(v).includes(q));
  });
}
