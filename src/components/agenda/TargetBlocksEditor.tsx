'use client';

import { ArrowUp, Plus, X } from 'lucide-react';
import { Input, Field } from '@/components/ui/Input';
import { Select } from '@/components/ui/FormControls';
import { useTranslation } from '@/i18n/LocaleProvider';
import { TARGET_GAITS } from '@/services/calendar/trainingTargets';
import {
  blocksDurationSec,
  draftsToBlocks,
  emptyBlockDraft,
  formatBlockDuration,
  type BlockDraft,
  type BlockDraftError,
  type BlockDraftKind,
  type TargetGait,
} from '@/services/calendar/targetBlocks';

/**
 * The training-structure editor: steady parts and intervals, in order.
 *
 * Same model, parser and validation as the phone (the mirrored, pure
 * `targetBlocks`), so a plan written here reads identically there. This
 * component only renders and reports drafts upward.
 */

const ERROR_KEY: Record<BlockDraftError, string> = {
  duration: 'agenda.blockEditor.errorDuration',
  hrMin: 'agenda.blockEditor.errorHr',
  hrMax: 'agenda.blockEditor.errorHr',
  hrRange: 'agenda.blockEditor.errorHrRange',
  repeat: 'agenda.blockEditor.errorRepeat',
  recovery: 'agenda.blockEditor.errorRecovery',
};

export function TargetBlocksEditor({
  drafts,
  onChange,
}: {
  drafts: readonly BlockDraft[];
  onChange: (drafts: BlockDraft[]) => void;
}) {
  const { t } = useTranslation();
  const conversion = draftsToBlocks(drafts);
  const totalSec = blocksDurationSec(conversion.blocks);

  const update = (index: number, patch: Partial<BlockDraft>): void =>
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const remove = (index: number): void => onChange(drafts.filter((_, i) => i !== index));
  const moveUp = (index: number): void => {
    if (index === 0) return;
    const next = [...drafts];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index - 1, 0, item);
    onChange(next);
  };
  const add = (kind: BlockDraftKind): void => onChange([...drafts, emptyBlockDraft(kind)]);

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-text-secondary">{t('agenda.blockEditor.hint')}</p>

      {drafts.length > 0 ? (
        <ol className="space-y-3">
          {drafts.map((draft, index) => {
            const isInterval = draft.kind === 'interval';
            const errors = conversion.errors[index] ?? [];
            const messages = [...new Set(errors.map((e) => t(ERROR_KEY[e])))];
            const id = `block-${index}`;
            return (
              <li key={index} className="space-y-3 rounded-md border border-line bg-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-text-primary">
                    {`${index + 1}. ${t(isInterval ? 'agenda.blockEditor.interval' : 'agenda.blockEditor.steady')}`}
                  </p>
                  <div className="flex items-center gap-1">
                    {index > 0 ? (
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        aria-label={t('agenda.blockEditor.moveUp')}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted"
                      >
                        <ArrowUp size={16} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={t('agenda.blockEditor.remove')}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <Input
                  aria-label={t('agenda.blockEditor.labelPlaceholder')}
                  placeholder={t('agenda.blockEditor.labelPlaceholder')}
                  value={draft.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {isInterval ? (
                    <Field label={t('agenda.blockEditor.repeat')} htmlFor={`${id}-repeat`}>
                      <Input
                        id={`${id}-repeat`}
                        inputMode="numeric"
                        value={draft.repeat}
                        onChange={(e) => update(index, { repeat: e.target.value })}
                      />
                    </Field>
                  ) : null}
                  <Field
                    label={t(isInterval ? 'agenda.blockEditor.work' : 'agenda.blockEditor.duration')}
                    htmlFor={`${id}-duration`}
                  >
                    <Input
                      id={`${id}-duration`}
                      placeholder="m:ss"
                      value={draft.duration}
                      onChange={(e) => update(index, { duration: e.target.value })}
                    />
                  </Field>
                  <Field label={t('agenda.blockEditor.hrMin')} htmlFor={`${id}-hr-min`}>
                    <Input
                      id={`${id}-hr-min`}
                      inputMode="numeric"
                      value={draft.hrMin}
                      onChange={(e) => update(index, { hrMin: e.target.value })}
                    />
                  </Field>
                  <Field label={t('agenda.blockEditor.hrMax')} htmlFor={`${id}-hr-max`}>
                    <Input
                      id={`${id}-hr-max`}
                      inputMode="numeric"
                      value={draft.hrMax}
                      onChange={(e) => update(index, { hrMax: e.target.value })}
                    />
                  </Field>
                  {isInterval ? (
                    <Field label={t('agenda.blockEditor.recovery')} htmlFor={`${id}-recovery`}>
                      <Input
                        id={`${id}-recovery`}
                        placeholder="m:ss"
                        value={draft.recovery}
                        onChange={(e) => update(index, { recovery: e.target.value })}
                      />
                    </Field>
                  ) : null}
                  <Field
                    label={t(isInterval ? 'agenda.blockEditor.recoveryGait' : 'agenda.blockEditor.gait')}
                    htmlFor={`${id}-gait`}
                  >
                    <Select
                      id={`${id}-gait`}
                      value={draft.gait ?? ''}
                      onChange={(e) =>
                        update(index, { gait: (e.target.value || null) as TargetGait | null })
                      }
                    >
                      <option value="">—</option>
                      {TARGET_GAITS.map((gait) => (
                        <option key={gait} value={gait}>
                          {t(`agenda.gait.${gait}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {messages.length > 0 ? (
                  <p role="alert" className="text-[12px] text-danger">
                    {messages.join(' ')}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(['steady', 'interval'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => add(kind)}
            className="flex h-10 items-center gap-1.5 rounded-md border border-dashed border-line-strong px-3 text-[13px] font-medium text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <Plus size={14} />
            {t(kind === 'steady' ? 'agenda.blockEditor.addSteady' : 'agenda.blockEditor.addInterval')}
          </button>
        ))}
        {conversion.blocks.length > 0 ? (
          <span className="ml-auto text-[12px] tabular-nums text-text-secondary">
            {t('agenda.blockEditor.total').replace('{duration}', formatBlockDuration(totalSec))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
