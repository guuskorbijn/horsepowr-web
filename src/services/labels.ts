/**
 * Display labels for enum-ish values. Sentence case, descriptive — these name
 * what was recorded, they never grade it. Centralised so every view reads the
 * same wording (DRY).
 */
import { asTrainingType, type TrainingType } from '@/types/db';
import type { GaitKey } from '@/theme/tokens';

export const TRAINING_TYPE_LABELS: Readonly<Record<TrainingType, string>> = {
  dressage: 'Dressage',
  cross_country: 'Cross-country',
  conditioning: 'Conditioning',
  other: 'Other',
};

export const GAIT_LABELS: Readonly<Record<GaitKey, string>> = {
  inactive: 'Inactive',
  walk: 'Walk',
  trot: 'Trot',
  canter: 'Canter',
};

/** A 1–5 subjective rating, shown as a neutral count — not a grade. */
export function ratingLabel(value: number | null): string {
  if (value === null) return '—';
  return `${value}/5`;
}

/**
 * A stored training type for display, translated. A value outside the known
 * vocabulary is shown as written rather than hidden: it was recorded, so the
 * reader should see it.
 */
export function trainingTypeLabel(value: string | null, t: (key: string) => string): string {
  if (value === null || value.trim() === '') return '—';
  const known = asTrainingType(value);
  return known === null ? value : t(`trainingType.${known}`);
}
