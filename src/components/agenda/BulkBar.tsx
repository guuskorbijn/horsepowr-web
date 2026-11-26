'use client';

import { useState } from 'react';
import { CalendarDays, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/FormControls';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { ProfileRow } from '@/types/db';

/**
 * Appears when several agenda items are selected (⌘/Ctrl/Shift-click): move
 * them all to one day, or hand them all to one person. Floating at the
 * bottom edge, out of the way of the grid it acts on.
 */
export function BulkBar({
  count,
  people,
  busy,
  onMove,
  onAssign,
  onClear,
}: {
  count: number;
  people: readonly ProfileRow[];
  busy: boolean;
  onMove: (dayKey: string) => void;
  onAssign: (assigneeId: string | null) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [day, setDay] = useState('');
  const [person, setPerson] = useState('');
  if (count === 0) return null;
  return (
    <div className="hp-toast-in fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-raised)]">
      <span className="text-[13px] font-semibold text-text-primary">
        {t('agenda.bulk.selected').replace('{n}', String(count))}
      </span>
      <label className="flex items-center gap-1.5">
        <CalendarDays size={15} className="text-text-tertiary" />
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-9 w-40" aria-label={t('agenda.bulk.moveTo')} />
        <Button size="sm" variant="secondary" disabled={busy || day === ''} onClick={() => onMove(day)}>
          {t('agenda.bulk.move')}
        </Button>
      </label>
      <label className="flex items-center gap-1.5">
        <UserRound size={15} className="text-text-tertiary" />
        <Select value={person} onChange={(e) => setPerson(e.target.value)} className="h-9 w-44" aria-label={t('agenda.bulk.assignTo')}>
          <option value="">{t('agenda.bulk.pickPerson')}</option>
          <option value="__none">{t('common.unassigned')}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name ?? p.email ?? p.id}</option>
          ))}
        </Select>
        <Button size="sm" variant="secondary" disabled={busy || person === ''} onClick={() => onAssign(person === '__none' ? null : person)}>
          {t('agenda.bulk.assign')}
        </Button>
      </label>
      <button type="button" onClick={onClear} aria-label={t('agenda.bulk.clear')} className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted">
        <X size={16} />
      </button>
    </div>
  );
}
