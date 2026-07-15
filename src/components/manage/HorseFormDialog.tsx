'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Select, Toggle } from '@/components/ui/FormControls';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { createHorse, updateHorse } from '@/data/horseRepository';
import { uploadHorsePhoto } from '@/data/storageRepository';
import { DEFAULT_HORSE_MAX_HR } from '@/services/hrZone';
import { formatAge } from '@/services/age';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { HorseRow, HorseSex, LocationRow } from '@/types/db';

const SEX_VALUES: HorseSex[] = ['mare', 'gelding', 'stallion'];

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number.parseFloat(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

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
  const { t } = useTranslation();
  const [name, setName] = useState(existing?.name ?? '');
  const [discipline, setDiscipline] = useState(existing?.discipline ?? '');
  const [locationId, setLocationId] = useState(existing?.location_id ?? '');
  const [maxHr, setMaxHr] = useState(String(existing?.max_hr ?? DEFAULT_HORSE_MAX_HR));
  const [active, setActive] = useState(existing?.active ?? true);
  const [dateOfBirth, setDateOfBirth] = useState(existing?.date_of_birth ?? '');
  const [sex, setSex] = useState<string>(existing?.sex ?? '');
  const [breed, setBreed] = useState(existing?.breed ?? '');
  const [level, setLevel] = useState(existing?.level ?? '');
  const [heightCm, setHeightCm] = useState(
    existing?.height_cm != null ? String(existing.height_cm) : '',
  );
  const [weightKg, setWeightKg] = useState(
    existing?.weight_kg != null ? String(existing.weight_kg) : '',
  );
  const [chipNumber, setChipNumber] = useState(existing?.chip_number ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = photoFile ? URL.createObjectURL(photoFile) : existing?.photo_url ?? null;
  const derivedAge = formatAge(dateOfBirth || null);

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
      date_of_birth: dateOfBirth.trim() || null,
      sex: (sex || null) as HorseSex | null,
      breed: breed.trim() || null,
      level: level.trim() || null,
      height_cm: parseNumberOrNull(heightCm),
      weight_kg: parseNumberOrNull(weightKg),
      chip_number: chipNumber.trim() || null,
    };
    try {
      const supa = getBrowserSupabase();
      let saved = existing
        ? await updateHorse(supa, existing.id, payload)
        : await createHorse(supa, { org_id: orgId, ...payload });
      // Photo upload needs the horse id, so it happens after save, then writes
      // photo_url back onto the row.
      if (photoFile) {
        const photoUrl = await uploadHorsePhoto(supa, orgId, saved.id, photoFile);
        saved = await updateHorse(supa, saved.id, { photo_url: photoUrl });
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('horses.form.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={existing ? t('horses.form.editTitle') : t('horses.form.addTitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Photo */}
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl ?? undefined}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full border border-line bg-surface-muted object-cover"
            style={previewUrl ? undefined : { visibility: 'hidden' }}
          />
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? t('horses.form.photoChange') : t('horses.form.photoAdd')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <Field label={t('horses.form.nameLabel')} htmlFor="horse-name">
          <Input
            id="horse-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('horses.form.namePlaceholder')}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('horses.form.disciplineLabel')} htmlFor="horse-discipline">
            <Input
              id="horse-discipline"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              placeholder={t('horses.form.disciplinePlaceholder')}
            />
          </Field>
          <Field label={t('horses.form.locationLabel')} htmlFor="horse-location">
            <Select
              id="horse-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">{t('common.unassigned')}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('horses.form.sexLabel')} htmlFor="horse-sex">
            <Select id="horse-sex" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="">{t('horses.form.sexUnspecified')}</option>
              {SEX_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`horses.sex.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('horses.form.dobLabel')}
            htmlFor="horse-dob"
            hint={derivedAge ? `${t('horses.detail.age')}: ${derivedAge} (${t('horses.form.ageHint')})` : undefined}
          >
            <Input
              id="horse-dob"
              type="date"
              value={dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('horses.form.breedLabel')} htmlFor="horse-breed">
            <Input
              id="horse-breed"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder={t('horses.form.breedPlaceholder')}
            />
          </Field>
          <Field label={t('horses.form.levelLabel')} htmlFor="horse-level">
            <Input
              id="horse-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder={t('horses.form.levelPlaceholder')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('horses.form.heightLabel')} htmlFor="horse-height">
            <Input
              id="horse-height"
              type="number"
              min={50}
              max={250}
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="168"
            />
          </Field>
          <Field label={t('horses.form.weightLabel')} htmlFor="horse-weight">
            <Input
              id="horse-weight"
              type="number"
              min={50}
              max={1500}
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="550"
            />
          </Field>
        </div>

        <Field
          label={t('horses.form.chipLabel')}
          htmlFor="horse-chip"
          hint={t('horses.form.chipHint')}
        >
          <Input
            id="horse-chip"
            value={chipNumber}
            onChange={(e) => setChipNumber(e.target.value)}
            placeholder={t('horses.form.chipPlaceholder')}
          />
        </Field>

        <Field
          label={t('horses.form.maxHrLabel')}
          htmlFor="horse-maxhr"
          hint={t('horses.form.maxHrHint')}
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
        <Toggle label={t('horses.form.activeLabel')} checked={active} onChange={setActive} />

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
