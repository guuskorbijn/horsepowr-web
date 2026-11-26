import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/states';
import { ContactsBoard } from '@/components/contacts/ContactsBoard';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listHorses } from '@/data/horseRepository';
import { listContacts, listHorseContactLinks } from '@/data/contactRepository';
import { getServerT } from '@/i18n/server';
import { log } from '@/lib/log';
import type { ContactRow, HorseContactRow } from '@/types/db';

type LoadResult =
  | {
      status: 'ok';
      orgId: string;
      userId: string;
      canEdit: boolean;
      contacts: ContactRow[];
      links: HorseContactRow[];
      horses: Array<{ id: string; name: string }>;
    }
  | { status: 'error' };

async function load(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'error' };
  try {
    const supa = await getServerSupabase();
    const [contacts, links, horses] = await Promise.all([
      listContacts(supa, ctx.org.id),
      listHorseContactLinks(supa),
      listHorses(supa, ctx.org.id),
    ]);
    return {
      status: 'ok',
      orgId: ctx.org.id,
      userId: ctx.userId,
      canEdit: ctx.capabilities.canEdit,
      contacts,
      links,
      horses: horses.map((h) => ({ id: h.id, name: h.name })),
    };
  } catch (err) {
    log.error('contacts: load failed', { error: err instanceof Error ? err.message : String(err) });
    return { status: 'error' };
  }
}

/** The stable's address book: owners, vet, farrier, physio, riders. */
export default async function ContactsPage() {
  const [result, t] = await Promise.all([load(), getServerT()]);
  return (
    <>
      <PageHeader title={t('contacts.title')} description={t('contacts.description')} />
      {result.status === 'error' ? (
        <ErrorState description={t('contacts.errorLoad')} />
      ) : (
        <ContactsBoard
          orgId={result.orgId}
          userId={result.userId}
          canEdit={result.canEdit}
          contacts={result.contacts}
          links={result.links}
          horses={result.horses}
        />
      )}
    </>
  );
}
