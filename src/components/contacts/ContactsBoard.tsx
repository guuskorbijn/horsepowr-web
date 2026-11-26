'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Plus, Search } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Field } from '@/components/ui/Input';
import { Select, Textarea } from '@/components/ui/FormControls';
import { EmptyState } from '@/components/ui/states';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import {
  createContact,
  linkContactToHorse,
  softDeleteContact,
  unlinkContactFromHorse,
  updateContact,
  type ContactInput,
} from '@/data/contactRepository';
import { useTranslation } from '@/i18n/LocaleProvider';
import { filterContacts } from '@/services/contacts/contactService';
import { CONTACT_ROLES, type ContactRole, type ContactRow, type HorseContactRow } from '@/types/db';
import { log } from '@/lib/log';

/**
 * The stable's address book. One list, filterable by role and searchable,
 * with each contact's horses and one-tap call/mail links. A contact can be
 * linked to several horses (an owner of three, the stable's vet).
 */

interface Draft extends ContactInput {
  horseIds: string[];
}

const EMPTY: Draft = { name: '', role: 'owner', company: null, phone: null, email: null, notes: null, horseIds: [] };

export function ContactsBoard({
  orgId,
  userId,
  canEdit,
  contacts,
  links,
  horses,
}: {
  orgId: string;
  userId: string;
  canEdit: boolean;
  contacts: readonly ContactRow[];
  links: readonly HorseContactRow[];
  horses: ReadonlyArray<{ id: string; name: string }>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<ContactRole | ''>('');
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const horseName = useMemo(() => new Map(horses.map((h) => [h.id, h.name])), [horses]);
  const horsesOf = (contactId: string): string[] =>
    links.filter((l) => l.contact_id === contactId).map((l) => l.horse_id);

  const visible = filterContacts(contacts, { query, role: role === '' ? null : role });

  const open = (contact: ContactRow | null): void => {
    setError(null);
    setDraft(
      contact === null
        ? EMPTY
        : {
            name: contact.name,
            role: contact.role,
            company: contact.company,
            phone: contact.phone,
            email: contact.email,
            notes: contact.notes,
            horseIds: horsesOf(contact.id),
          },
    );
    setEditing(contact ?? 'new');
  };

  const text = (value: string): string | null => (value.trim() === '' ? null : value.trim());
  const emailInvalid = draft.email !== null && !/^[^@\s]+@[^@\s]+$/.test(draft.email);
  const invalid = draft.name.trim() === '' || emailInvalid;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (invalid || editing === null) return;
    setBusy(true);
    setError(null);
    const { horseIds, ...fields } = draft;
    const input: ContactInput = { ...fields, name: fields.name.trim() };
    try {
      const supa = getBrowserSupabase();
      const saved =
        editing === 'new'
          ? await createContact(supa, orgId, userId, input)
          : await updateContact(supa, editing.id, input);
      const before = new Set(editing === 'new' ? [] : horsesOf(editing.id));
      const after = new Set(horseIds);
      for (const id of after) if (!before.has(id)) await linkContactToHorse(supa, id, saved.id);
      for (const id of before) if (!after.has(id)) await unlinkContactFromHorse(supa, id, saved.id);
      setEditing(null);
      router.refresh();
    } catch (err) {
      log.error('contacts: save failed', { error: err instanceof Error ? err.message : String(err) });
      setError(t('contacts.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(): Promise<void> {
    if (editing === null || editing === 'new') return;
    setBusy(true);
    try {
      await softDeleteContact(getBrowserSupabase(), editing.id);
      setEditing(null);
      router.refresh();
    } catch (err) {
      log.error('contacts: delete failed', { error: err instanceof Error ? err.message : String(err) });
      setError(t('contacts.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <span className="sr-only">{t('contacts.search')}</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input
            className="pl-9"
            placeholder={t('contacts.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <Select
          aria-label={t('contacts.roleLabel')}
          className="w-44"
          value={role}
          onChange={(e) => setRole(e.target.value as ContactRole | '')}
        >
          <option value="">{t('contacts.allRoles')}</option>
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`contacts.role.${r}`)}
            </option>
          ))}
        </Select>
        {canEdit ? (
          <Button className="ml-auto" size="sm" onClick={() => open(null)}>
            <Plus size={14} /> {t('contacts.add')}
          </Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={contacts.length === 0 ? t('contacts.emptyTitle') : t('contacts.noMatch')}
          description={contacts.length === 0 ? t('contacts.emptyDescription') : ''}
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {visible.map((contact) => {
                const linked = horsesOf(contact.id);
                return (
                  <li key={contact.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => open(contact)}
                      className="min-w-[14rem] flex-1 text-left"
                    >
                      <span className="block text-[14px] font-medium text-text-primary">{contact.name}</span>
                      <span className="block text-[12px] text-text-secondary">
                        {t(`contacts.role.${contact.role}`)}
                        {contact.company !== null ? ` · ${contact.company}` : ''}
                      </span>
                    </button>
                    <div className="flex min-w-[10rem] flex-wrap gap-1.5">
                      {linked.map((id) => (
                        <Link
                          key={id}
                          href={`/horses/${id}`}
                          className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[12px] text-text-secondary hover:text-text-primary"
                        >
                          {horseName.get(id) ?? '—'}
                        </Link>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      {contact.phone !== null ? (
                        <a
                          href={`tel:${contact.phone.replace(/\s/g, '')}`}
                          className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] tabular-nums text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                        >
                          <Phone size={14} /> {contact.phone}
                        </a>
                      ) : null}
                      {contact.email !== null ? (
                        <a
                          href={`mailto:${contact.email}`}
                          aria-label={contact.email}
                          className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                        >
                          <Mail size={15} />
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('contacts.addTitle') : t('contacts.editTitle')}
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('contacts.nameLabel')} htmlFor="contact-name">
              <Input id="contact-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={t('contacts.roleLabel')} htmlFor="contact-role">
              <Select
                id="contact-role"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as ContactRole })}
              >
                {CONTACT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`contacts.role.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('contacts.phoneLabel')} htmlFor="contact-phone">
              <Input
                id="contact-phone"
                type="tel"
                value={draft.phone ?? ''}
                onChange={(e) => setDraft({ ...draft, phone: text(e.target.value) })}
              />
            </Field>
            <Field
              label={t('contacts.emailLabel')}
              htmlFor="contact-email"
              hint={emailInvalid ? t('contacts.errorEmail') : undefined}
            >
              <Input
                id="contact-email"
                type="email"
                value={draft.email ?? ''}
                onChange={(e) => setDraft({ ...draft, email: text(e.target.value) })}
              />
            </Field>
          </div>
          <Field label={t('contacts.companyLabel')} htmlFor="contact-company">
            <Input
              id="contact-company"
              value={draft.company ?? ''}
              onChange={(e) => setDraft({ ...draft, company: text(e.target.value) })}
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium text-text-primary">{t('contacts.horsesLabel')}</legend>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {horses.map((h) => {
                const on = draft.horseIds.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        horseIds: on ? draft.horseIds.filter((x) => x !== h.id) : [...draft.horseIds, h.id],
                      })
                    }
                    className={
                      on
                        ? 'rounded-full border border-primary bg-primary-soft px-3 py-1 text-[13px] text-primary'
                        : 'rounded-full border border-line px-3 py-1 text-[13px] text-text-secondary hover:bg-surface-muted'
                    }
                  >
                    {h.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Field label={t('contacts.notesLabel')} htmlFor="contact-notes">
            <Textarea
              id="contact-notes"
              rows={2}
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: text(e.target.value) })}
            />
          </Field>
          {error !== null ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
          <div className="flex items-center justify-between gap-2 pt-1">
            {editing !== null && editing !== 'new' ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => void onDelete()} disabled={busy}>
                {t('contacts.delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={busy || invalid}>
                {busy ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}
