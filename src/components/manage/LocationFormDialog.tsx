'use client';

import { useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { createLocation, updateLocation } from '@/data/orgRepository';
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
      setError(err instanceof Error ? err.message : 'Could not save the location.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={existing ? 'Edit location' : 'Add location'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name" htmlFor="loc-name">
          <Input
            id="loc-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Breda"
          />
        </Field>
        <Field label="Country" htmlFor="loc-country" hint="Optional, e.g. NL">
          <Input
            id="loc-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country code or name"
          />
        </Field>

        {error ? (
          <p className="rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy || name.trim() === ''}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
