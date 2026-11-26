import { ruleToInterval, ruleToPreset } from './recurrenceService';
import type { QuickAddResult } from './quickAddParser';
import type { TrainingTemplate } from '@/data/templateRepository';
import type { CalendarEventFormValues } from '@/types/calendarForm';
import { asTrainingType } from '@/types/db';

/**
 * Turning a template or a typed sentence into a pre-filled form. PURE. The
 * form still opens: prefilling saves typing, the person still confirms.
 */

export function applyTemplate(base: CalendarEventFormValues, tpl: TrainingTemplate): CalendarEventFormValues {
  const t = tpl.targets;
  return {
    ...base,
    type: 'training',
    title: tpl.name,
    durationMin: tpl.duration_min ?? t?.durationMin ?? base.durationMin,
    trainingType: asTrainingType(tpl.training_type),
    targetHrMinBpm: t?.hrMinBpm ?? null,
    targetHrMaxBpm: t?.hrMaxBpm ?? null,
    targetDurationMin: t?.durationMin ?? null,
    blocks: t?.blocks ?? null,
  };
}

export function applyQuickAdd(base: CalendarEventFormValues, q: QuickAddResult): CalendarEventFormValues {
  const preset = ruleToPreset(q.recurrenceRule);
  return {
    ...base,
    type: q.type ?? base.type,
    title: q.title !== '' ? q.title : base.title,
    horseId: q.horseId ?? base.horseId,
    dayKey: q.dayKey ?? base.dayKey,
    startTime: q.time ?? base.startTime,
    durationMin: q.durationMin ?? base.durationMin,
    recurrencePreset: preset,
    customRecurrenceRule: preset === 'custom' ? q.recurrenceRule : null,
    recurrenceInterval: ruleToInterval(q.recurrenceRule) ?? base.recurrenceInterval,
  };
}
