'use client';

import { useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { createLocation, updateLocation } from '@/data/orgRepository';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { LocationRow } from '@/types/db';

export function LocationFormDialog({
  open,
  onClose,
  orgId,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  existing: LocationRow | null;
  onSaved: (location: LocationRow) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(existing?.name ?? '');
  const [country, setCountry] = useState(existing?.country ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { name: name.trim(), country: country.trim() || null };
    try {
      const supa = getBrowserSupabase();
      const saved = existing
        ? await updateLocation(supa, existing.id, payload)
        : await createLocation(supa, { org_id: orgId, ...payload });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('horses.location.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={existing ? t('horses.location.editTitle') : t('horses.location.addTitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t('horses.location.nameLabel')} htmlFor="loc-name">
          <Input
            id="loc-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('horses.location.namePlaceholder')}
          />
        </Field>
        <Field label={t('horses.location.countryLabel')} htmlFor="loc-country" hint={t('horses.location.countryHint')}>
          <Input
            id="loc-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t('horses.location.countryPlaceholder')}
          />
        </Field>

        {error ? (
          <p className="rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={busy || name.trim() === ''}>
            {busy ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
