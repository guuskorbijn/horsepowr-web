import { describeRecurrence } from './recurrenceService';
import { summariseBlock } from './targetBlocks';
import type { TargetBlock } from './trainingTargets';

/**
 * Words for a plan's recurrence and blocks, from the mirrored descriptors.
 * PURE: the translator is passed in. The phone's `utils/planText` renders the
 * same structure with its own catalogue.
 */
export type Translate = (key: string) => string;

export function recurrenceText(rule: string | null, t: Translate): string {
  const label = describeRecurrence(rule);
  return t(`agenda.recurrence.${label.key}`).replace('{n}', String(label.count ?? ''));
}

export function blockText(block: TargetBlock, t: Translate): string {
  const s = summariseBlock(block);
  const parts: string[] = [];
  if (s.label !== null) parts.push(s.label);
  parts.push(
    s.kind === 'interval'
      ? t('agenda.blockEditor.summaryInterval')
          .replace('{repeat}', String(s.repeat))
          .replace('{duration}', s.duration)
      : s.duration,
  );
  if (s.hrRange !== null) parts.push(`${s.hrRange} bpm`);
  const gait = s.gait !== null ? t(`agenda.gait.${s.gait}`) : null;
  if (s.recovery !== null) {
    const recovery = t('agenda.blockEditor.summaryRecovery').replace('{duration}', s.recovery);
    parts.push(gait !== null ? `${recovery} (${gait})` : recovery);
  } else if (gait !== null) {
    parts.push(gait);
  }
  return parts.join(' · ');
}
