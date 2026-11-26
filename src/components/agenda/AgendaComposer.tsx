'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { GripVertical, Sparkles } from 'lucide-react';
import { useTranslation } from '@/i18n/LocaleProvider';
import { parseQuickAdd, type QuickAddResult } from '@/services/calendar/quickAddParser';
import { formatDayKey } from '@/services/format';
import type { TrainingTemplate } from '@/data/templateRepository';

/**
 * The agenda's fast lane for trainers.
 *
 *  - Type a sentence ("hoefsmid Bella dinsdag 9u", "interval Milano elke
 *    ma/do 8:30") and press Enter: the form opens filled in. A live preview
 *    under the field shows what was understood, so nothing is a surprise.
 *  - Templates are chips: click to plan one today, or DRAG one onto a day.
 *    Press "/" anywhere on the agenda to jump into the field.
 */
export function AgendaComposer({
  todayKey,
  horses,
  templates,
  onQuickAdd,
  onTemplate,
  onTemplateDragStart,
  onTemplateDragEnd,
}: {
  todayKey: string;
  horses: ReadonlyArray<{ id: string; name: string }>;
  templates: readonly TrainingTemplate[];
  onQuickAdd: (result: QuickAddResult) => void;
  onTemplate: (template: TrainingTemplate) => void;
  onTemplateDragStart: (template: TrainingTemplate) => void;
  onTemplateDragEnd: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const parsed = useMemo(
    () => (text.trim().length < 3 ? null : parseQuickAdd(text, { todayKey, horses })),
    [text, todayKey, horses],
  );
  const horseName = parsed?.horseId ? horses.find((h) => h.id === parsed.horseId)?.name : null;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (parsed === null) return;
    onQuickAdd(parsed);
    setText('');
  };

  return (
    <div
      className="mb-4 space-y-3 rounded-xl border border-line bg-surface p-3"
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape') setText('');
      }}
    >
      <form onSubmit={submit} className="relative">
        <Sparkles size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
        <input
          ref={input}
          id="agenda-quick-add"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('composer.placeholder')}
          aria-label={t('composer.label')}
          className="h-11 w-full rounded-lg border border-line bg-surface-muted pl-9 pr-24 text-[14px] text-text-primary placeholder:text-text-tertiary focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 py-0.5 text-[11px] text-text-tertiary">
          {parsed ? '↵' : '/'}
        </kbd>
      </form>

      {parsed !== null ? (
        <div className="hp-toast-in flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-text-tertiary">{t('composer.understood')}</span>
          {parsed.type ? <Chip>{t(`agenda.type.${parsed.type}`)}</Chip> : null}
          {horseName ? <Chip>{horseName}</Chip> : null}
          {parsed.dayKey ? <Chip>{formatDayKey(parsed.dayKey)}</Chip> : null}
          {parsed.time ? <Chip>{parsed.time}</Chip> : null}
          {parsed.durationMin ? <Chip>{`${parsed.durationMin} min`}</Chip> : null}
          {parsed.recurrenceRule ? <Chip>{t('composer.repeats')}</Chip> : null}
          {parsed.title ? <span className="text-text-secondary">“{parsed.title}”</span> : null}
        </div>
      ) : null}

      {templates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-text-tertiary">{t('composer.templates')}</span>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', `template:${tpl.id}`);
                onTemplateDragStart(tpl);
              }}
              onDragEnd={onTemplateDragEnd}
              onClick={() => onTemplate(tpl)}
              title={t('composer.templateHint')}
              className="group inline-flex h-8 cursor-grab items-center gap-1 rounded-full border border-line bg-surface pl-1.5 pr-3 text-[12px] font-medium text-text-primary transition-colors hover:border-primary hover:bg-primary-soft active:cursor-grabbing"
            >
              <GripVertical size={13} className="text-text-tertiary group-hover:text-primary" />
              {tpl.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary">{children}</span>;
}
