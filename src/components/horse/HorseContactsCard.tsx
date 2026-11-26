'use client';

import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { ContactRow } from '@/types/db';

/** The people around one horse — owner, vet, farrier — with one-tap call/mail. */
export function HorseContactsCard({ contacts }: { contacts: readonly ContactRow[] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader
        title={t('contacts.horseTitle')}
        action={
          <Link href="/contacts" className="text-[13px] font-medium text-primary hover:underline">
            {t('contacts.manage')}
          </Link>
        }
      />
      <CardBody>
        {contacts.length === 0 ? (
          <p className="text-[14px] text-text-secondary">{t('contacts.horseEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-text-primary">{c.name}</p>
                  <p className="text-[12px] text-text-secondary">
                    {t(`contacts.role.${c.role}`)}
                    {c.company !== null ? ` · ${c.company}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {c.phone !== null ? (
                    <a
                      href={`tel:${c.phone.replace(/\s/g, '')}`}
                      aria-label={c.phone}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted"
                    >
                      <Phone size={15} />
                    </a>
                  ) : null}
                  {c.email !== null ? (
                    <a
                      href={`mailto:${c.email}`}
                      aria-label={c.email}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted"
                    >
                      <Mail size={15} />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
