/**
 * Display labels for enum-ish values. Sentence case, descriptive — these name
 * what was recorded, they never grade it. Centralised so every view reads the
 * same wording (DRY).
 */
import type { TrainingType } from '@/types/db';
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
