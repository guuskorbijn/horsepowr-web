'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Check, Plus, Trophy, X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/states';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { addChecklistItem, removeChecklistItem, setChecklistDone, type ChecklistItem } from '@/data/templateRepository';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatDayKey, formatTime } from '@/services/format';
import { DEFAULT_CHECKLIST, type CompetitionGroup } from '@/services/competitionService';
import { cn } from '@/lib/cn';
import { log } from '@/lib/log';

/**
 * Upcoming shows, one card each: who rides which horse, when, and what still
 * has to be ready. Ticking a checklist line is instant (optimistic) and syncs
 * live to everyone else looking at the same show.
 */
export function CompetitionBoard({
  groups,
  orgId,
  canEdit,
  horseNames,
  peopleNames,
}: {
  groups: readonly CompetitionGroup[];
  orgId: string;
  canEdit: boolean;
  horseNames: Record<string, string>;
  peopleNames: Record<string, string>;
}) {
  const { t } = useTranslation();
  // Local overlay over the server checklists, for instant ticks.
  const [overlay, setOverlay] = useState<Record<string, ChecklistItem[]>>({});
  const [error, setError] = useState<string | null>(null);
  // Fresh server data (a refresh, a colleague's live tick) replaces the overlay.
  const [seen, setSeen] = useState(groups);
  if (seen !== groups) {
    setSeen(groups);
    setOverlay({});
  }

  const listOf = (eventId: string, server: ChecklistItem[]): ChecklistItem[] => overlay[eventId] ?? server;
  const setList = (eventId: string, list: ChecklistItem[]): void => setOverlay((o) => ({ ...o, [eventId]: list }));

  async function toggle(eventId: string, list: ChecklistItem[], item: ChecklistItem): Promise<void> {
    setList(eventId, list.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)));
    try {
      await setChecklistDone(getBrowserSupabase(), item.id, !item.done);
    } catch (err) {
      setList(eventId, list);
      log.error('competitions: toggle failed', { error: err instanceof Error ? err.message : String(err) });
      setError(t('competitions.errorSave'));
    }
  }

  async function add(eventId: string, list: ChecklistItem[], labels: string[]): Promise<void> {
    try {
      const supa = getBrowserSupabase();
      const created: ChecklistItem[] = [];
      for (const [i, label] of labels.entries()) {
        created.push(await addChecklistItem(supa, { orgId, eventId, label, position: list.length + i + 1 }));
      }
      setList(eventId, [...list, ...created]);
    } catch (err) {
      log.error('competitions: add failed', { error: err instanceof Error ? err.message : String(err) });
      setError(t('competitions.errorSave'));
    }
  }

  async function remove(eventId: string, list: ChecklistItem[], item: ChecklistItem): Promise<void> {
    setList(eventId, list.filter((c) => c.id !== item.id));
    try {
      await removeChecklistItem(getBrowserSupabase(), item.id);
    } catch (err) {
      setList(eventId, list);
      log.error('competitions: remove failed', { error: err instanceof Error ? err.message : String(err) });
      setError(t('competitions.errorSave'));
    }
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Trophy size={28} />}
        title={t('competitions.emptyTitle')}
        description={t('competitions.emptyDescription')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error !== null ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
      {groups.map((group) => {
        const lists = group.entries.map((e) => listOf(e.event.id, e.checklist));
        const total = lists.reduce((n, l) => n + l.length, 0);
        const done = lists.reduce((n, l) => n + l.filter((c) => c.done).length, 0);
        return (
          <Card key={group.key}>
            <CardHeader
              title={group.title}
              subtitle={`${formatDayKey(group.dayKey)} · ${t('competitions.entries').replace('{n}', String(group.entries.length))}`}
              action={
                total > 0 ? (
                  <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-medium tabular-nums', done === total ? 'bg-[var(--pill-success-bg)] text-[var(--pill-success-text)]' : 'bg-surface-muted text-text-secondary')}>
                    {t('competitions.ready').replace('{done}', String(done)).replace('{total}', String(total))}
                  </span>
                ) : undefined
              }
            />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.entries.map(({ event }, idx) => {
                const list = lists[idx] ?? [];
                return (
                  <div key={event.id} className="rounded-lg border border-line p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={event.horse_id ? `/horses/${event.horse_id}` : '/agenda'}
                          className="block truncate text-[15px] font-semibold text-text-primary hover:text-primary"
                        >
                          {event.horse_id ? (horseNames[event.horse_id] ?? '—') : t('agenda.wholeStable')}
                        </Link>
                        <p className="truncate text-[12px] text-text-secondary">
                          {[event.title.includes('–') ? event.title.split('–').slice(1).join('–').trim() : null,
                            event.assignee_id ? peopleNames[event.assignee_id] : t('competitions.noRider'),
                            event.all_day ? null : formatTime(event.starts_at)]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {list.map((item) => (
                        <li key={item.id} className="group flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => void toggle(event.id, list, item)}
                            aria-pressed={item.done}
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                              item.done ? 'border-success bg-success text-white' : 'border-line-strong hover:border-primary',
                            )}
                          >
                            {item.done ? <Check size={13} strokeWidth={3} /> : null}
                          </button>
                          <span className={cn('flex-1 text-[13px]', item.done ? 'text-text-tertiary line-through' : 'text-text-primary')}>
                            {item.label}
                          </span>
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => void remove(event.id, list, item)}
                              aria-label={t('competitions.remove')}
                              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <X size={13} className="text-text-tertiary" />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {canEdit ? (
                      list.length === 0 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="mt-2"
                          onClick={() => void add(event.id, list, DEFAULT_CHECKLIST.map((k) => t(`competitions.default.${k}`)))}
                        >
                          {t('competitions.addDefault')}
                        </Button>
                      ) : (
                        <AddLine onAdd={(label) => void add(event.id, list, [label])} />
                      )
                    ) : null}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function AddLine({ onAdd }: { onAdd: (label: string) => void }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (label.trim() === '') return;
    onAdd(label.trim());
    setLabel('');
  };
  return (
    <form onSubmit={submit} className="mt-2 flex items-center gap-2">
      <Plus size={13} className="text-text-tertiary" />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t('competitions.addLine')}
        aria-label={t('competitions.addLine')}
        className="h-8 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[13px] text-text-primary placeholder:text-text-tertiary hover:border-line focus:border-primary focus:outline-none"
      />
    </form>
  );
}
