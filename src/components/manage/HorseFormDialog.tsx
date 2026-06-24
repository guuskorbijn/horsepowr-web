'use client';

import { useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Select, Toggle } from '@/components/ui/FormControls';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { createHorse, updateHorse } from '@/data/horseRepository';
import { DEFAULT_HORSE_MAX_HR } from '@/services/hrZone';
import type { HorseRow, LocationRow } from '@/types/db';

export function HorseFormDialog({
  open,
  onClose,
  orgId,
  locations,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  locations: LocationRow[];
  existing: HorseRow | null;
  onSaved: (horse: HorseRow) => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [discipline, setDiscipline] = useState(existing?.discipline ?? '');
  const [locationId, setLocationId] = useState(existing?.location_id ?? '');
  const [maxHr, setMaxHr] = useState(String(existing?.max_hr ?? DEFAULT_HORSE_MAX_HR));
  const [active, setActive] = useState(existing?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const parsedMaxHr = Number.parseInt(maxHr, 10);
    const payload = {
      name: name.trim(),
      discipline: discipline.trim() || null,
      location_id: locationId || null,
      max_hr: Number.isFinite(parsedMaxHr) ? parsedMaxHr : DEFAULT_HORSE_MAX_HR,
      active,
    };
    try {
      const supa = getBrowserSupabase();
      const saved = existing
        ? await updateHorse(supa, existing.id, payload)
        : await createHorse(supa, { org_id: orgId, ...payload });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the horse.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={existing ? 'Edit horse' : 'Add horse'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name" htmlFor="horse-name">
          <Input
            id="horse-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Horse name"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Discipline" htmlFor="horse-discipline">
            <Input
              id="horse-discipline"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              placeholder="e.g. dressage"
            />
          </Field>
          <Field label="Location" htmlFor="horse-location">
            <Select
              id="horse-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Max heart rate (bpm)"
          htmlFor="horse-maxhr"
          hint="Drives HR zones. Equine default 240 — confirm with your analyst."
        >
          <Input
            id="horse-maxhr"
            type="number"
            min={60}
            max={300}
            value={maxHr}
            onChange={(e) => setMaxHr(e.target.value)}
          />
        </Field>
        <Toggle label="Active" checked={active} onChange={setActive} />

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
