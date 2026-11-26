'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LocaleProvider';
import {
  formatHrRange,
  formatZoneSpan,
  type Agenda,
  type AgendaItem,
} from '@/services/calendar/agendaService';
import { formatDayKey } from '@/services/format';
import {
  emptyFormValues,
  eventToFormValues,
} from '@/services/calendar/eventFormMapper';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import {
  rescheduleOccurrenceToDay,
  rescheduleOccurrenceToTime,
  assignOccurrence,
  restoreOccurrenceTimes,
  type OccurrenceTimes,
} from '@/services/calendar/rescheduleOccurrence';
import { notifyCalendarChange } from '@/services/notifications/notifyCalendarChange';
import { log } from '@/lib/log';
import { cn } from '@/lib/cn';
import { FadeIn } from '@/components/motion/FadeIn';
import { TYPE_ACCENT } from '@/services/calendar/eventTypeAccent';
import { useFlip } from '@/lib/useFlip';
import { AgendaComposer } from '@/components/agenda/AgendaComposer';
import { TimeGrid } from '@/components/agenda/TimeGrid';
import { BulkBar } from '@/components/agenda/BulkBar';
import { formatMinutes } from '@/services/calendar/timeGridLayout';
import type { AgendaLayout } from '@/services/calendar/agendaQuery';
import { applyQuickAdd, applyTemplate } from '@/services/calendar/prefill';
import type { TrainingTemplate } from '@/data/templateRepository';
import { useLive } from '@/components/live/LiveProvider';
import { EventFormDialog } from '@/components/agenda/EventFormDialog';
import { OccurrenceDetailDialog } from '@/components/agenda/OccurrenceDetailDialog';
import type { CalendarEventFormValues } from '@/types/calendarForm';
import type {
  CalendarEvent,
  CalendarEventType,
  EventOccurrence,
} from '@/types/calendar';
import type { HorseRow, LocationRow, ProfileRow } from '@/types/db';

/**
 * A day, or seven days side by side.
 *
 * The visual language matches the phone deliberately — the same type accents,
 * the same "form not verdict" treatment of state — so a trainer who plans on a
 * laptop and executes on a phone is looking at one product. Nothing here grades
 * anything: a cancelled item is struck through, a done one recedes, and that is
 * the whole vocabulary.
 */

/**
 * Type accent, as a CSS variable rather than a utility class.
 *
 * Two reasons. `border-line` and `border-l-primary` set different properties
 * but overlapping ones, and this repo's `cn` is a plain joiner with no
 * tailwind-merge — so which colour won depended on the order Tailwind happened
 * to emit the rules in, which is not a thing to leave to chance. And one of
 * these was a hard-coded hex instead of the token, which is exactly the second
 * source of truth the design system forbids.
 *
 * Every value here is a theme token. Coral (`--accent`) is absent on purpose:
 * it is reserved for the single primary action on a screen.
 */

function weekdayLabel(dayKey: string, long: boolean): string {
  // A fixed locale: `undefined` meant the server's locale on the first
  // render and the browser's after hydration, so the weekday could flip.
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: long ? 'long' : 'short',
    timeZone: 'UTC',
  });
}

function TargetLine({ item }: { item: AgendaItem }) {
  const { t } = useTranslation();
  const target = item.target;
  if (target === null) return null;
  const hr = formatHrRange(target.hrMinBpm, target.hrMaxBpm);
  const parts: string[] = [];
  // An HR is never printed without its zone label (DESIGN_SYSTEM §11).
  if (hr !== null) parts.push(`${hr} · ${formatZoneSpan(target.zones)}`);
  if (target.durationMin !== null) parts.push(`${target.durationMin} min`);
  if (target.blockCount > 0) parts.push(`${target.blockCount} ${t('agenda.blocks')}`);
  if (parts.length === 0) return null;
  return (
    <p className="mt-1 text-[12px] tabular-nums text-text-secondary">
      <span className="sr-only">{t('agenda.detail.targetLabel')}: </span>
      {parts.join(' · ')}
    </p>
  );
}

function ItemCard({
  item,
  dayKey,
  horseNames,
  canEdit,
  onOpen,
  drag,
}: {
  item: AgendaItem;
  dayKey: string;
  horseNames: Record<string, string>;
  canEdit: boolean;
  onOpen: (occurrence: EventOccurrence) => void;
  drag: DragApi;
}) {
  const { t } = useTranslation();
  const { recent } = useLive();
  const { occurrence, cancelled, done } = item;
  const justChanged = recent.has(occurrence.event_id);
  const horse =
    occurrence.horse_id === null
      ? t('agenda.wholeStable')
      : (horseNames[occurrence.horse_id] ?? t('agenda.wholeStable'));

  return (
    <button
      type="button"
      onClick={(e) => {
        if (canEdit && (e.metaKey || e.ctrlKey || e.shiftKey)) {
          e.preventDefault();
          drag.onToggleSelect({ occurrence, dayKey });
          return;
        }
        onOpen(occurrence);
      }}
      aria-pressed={drag.selected.has(occurrence.key) || undefined}
      // Dragging is a shortcut, never the only way: the same move is
      // available from the detail dialog's date field, which is what
      // keyboard and screen-reader users have. A drag-only
      // reschedule would make the feature unusable for them.
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        // Firefox ignores a drag that carries no payload.
        e.dataTransfer.setData('text/plain', occurrence.key);
        drag.onDragStart(occurrence, dayKey);
      }}
      aria-busy={drag.pendingKey === occurrence.key || undefined}
      data-flip-key={occurrence.key}
      onDragEnd={drag.onDragEnd}
      style={{ borderLeftColor: TYPE_ACCENT[occurrence.type] }}
      className={cn(
        'min-h-11 w-full rounded-lg border border-l-4 border-line p-2.5 text-left',
        'transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        canEdit && 'cursor-grab active:cursor-grabbing',
        done ? 'bg-surface-muted' : 'bg-surface',
        cancelled && 'opacity-60',
        drag.draggingKey === occurrence.key && 'opacity-40',
        drag.pendingKey === occurrence.key && 'animate-pulse border-primary/50',
        justChanged && 'hp-just-changed',
        drag.selected.has(occurrence.key) && 'ring-2 ring-primary ring-offset-1 ring-offset-app',
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-[12px] tabular-nums text-text-primary">
          {item.readerTime ?? t('agenda.allDay')}
        </span>
        <span className="text-[11px] text-text-tertiary">{t(`agenda.type.${occurrence.type}`)}</span>
        {item.eventZoneLabel !== null ? (
          // The booked time on the event's own clock: a Mexico vet visit is
          // at 09:00 in Mexico City whatever hour it is in Breda.
          <span className="text-[11px] tabular-nums text-text-tertiary">
            {item.eventLocalTime !== null ? `${item.eventLocalTime} ` : ''}
            {item.eventZoneLabel}
          </span>
        ) : null}
      </div>
      <p className={cn('mt-0.5 text-[14px] text-text-primary', cancelled && 'line-through')}>
        {occurrence.title}
      </p>
      <p className="text-[12px] text-text-secondary">{horse}</p>
      {!cancelled ? <TargetLine item={item} /> : null}
      {cancelled ? (
        <p className="mt-1 text-[11px] text-danger">{t('agenda.cancelled')}</p>
      ) : done ? (
        <p className="mt-1 text-[11px] text-text-secondary">{t('agenda.done')}</p>
      ) : null}
    </button>
  );
}

function DayColumn({
  dayKey,
  items,
  horseNames,
  isToday,
  wide,
  canEdit,
  onOpen,
  onAdd,
  drag,
}: {
  dayKey: string;
  items: readonly AgendaItem[];
  horseNames: Record<string, string>;
  isToday: boolean;
  /** Day view: one roomy column instead of one of seven. */
  wide: boolean;
  canEdit: boolean;
  onOpen: (occurrence: EventOccurrence) => void;
  onAdd: (dayKey: string) => void;
  drag: DragApi;
}) {
  const { t } = useTranslation();
  const dayNumber = Number(dayKey.slice(8, 10));
  const isDropTarget =
    drag.overDayKey === dayKey && (drag.templateActive || drag.sourceDayKey !== dayKey);

  return (
    <div
      className={cn(
        'group/day flex min-w-0 flex-col rounded-lg transition-colors duration-150',
        // The drop target is marked on the COLUMN rather than on a thin line
        // between cards: the grid has no hour axis, so a drop means "this
        // day" and the highlight should say exactly that much.
        isDropTarget && 'bg-primary-soft ring-2 ring-primary ring-offset-2 ring-offset-app',
      )}
      onDragOver={(e) => {
        if (!drag.active && !drag.templateActive) return;
        // Without preventDefault the browser refuses the drop outright.
        e.preventDefault();
        e.dataTransfer.dropEffect = drag.templateActive ? 'copy' : 'move';
        drag.onDragOverDay(dayKey);
      }}
      onDrop={(e) => {
        if (drag.templateActive) {
          e.preventDefault();
          drag.onTemplateDropOnDay(dayKey);
          return;
        }
        if (!drag.active) return;
        e.preventDefault();
        drag.onDropOnDay(dayKey);
      }}
    >
      <div
        className={cn(
          'mb-2 flex items-baseline gap-2 border-b border-line pb-2',
          isToday && 'border-b-primary',
        )}
      >
        <span className="text-[13px] font-medium text-text-tertiary">{weekdayLabel(dayKey, wide)}</span>
        <span
          className={cn(
            'font-display text-[18px] font-semibold',
            isToday ? 'text-primary' : 'text-text-primary',
          )}
        >
          {dayNumber}
        </span>
        {canEdit ? (
          // Visible on hover and whenever it has keyboard focus, so the
          // affordance is never reachable by pointer only.
          <button
            type="button"
            onClick={() => onAdd(dayKey)}
            aria-label={`${t('agenda.addOnDay')} ${dayKey}`}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-md text-text-tertiary opacity-0 transition-opacity duration-150 hover:bg-surface-muted hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover/day:opacity-100"
          >
            <Plus size={14} />
          </button>
        ) : null}
      </div>

      <div className={cn('flex flex-col gap-2', wide && 'max-w-2xl')}>
        {items.length === 0 ? (
          <p className="py-2 text-[13px] text-text-tertiary">{t('agenda.dayEmpty')}</p>
        ) : (
          items.map((item) => (
            <ItemCard
              key={item.occurrence.key}
              item={item}
              dayKey={dayKey}
              horseNames={horseNames}
              canEdit={canEdit}
              onOpen={onOpen}
              drag={drag}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Everything the columns and cards need to take part in a drag.
 *
 * Passed as one object rather than eight props: a drag is a single piece of
 * state that several components read, and threading it field by field is how
 * one of them ends up out of step with the others.
 */
interface DragApi {
  /** Multi-select: keys currently selected, and the modifier-click toggle. */
  selected: ReadonlySet<string>;
  onToggleSelect: (item: { occurrence: EventOccurrence; dayKey: string }) => void;
  /** A template chip is being dragged (copy onto a day, not a move). */
  templateActive: boolean;
  onTemplateDropOnDay: (dayKey: string) => void;
  /** The card that was just dropped and is being written. */
  pendingKey: string | null;
  active: boolean;
  draggingKey: string | null;
  sourceDayKey: string | null;
  overDayKey: string | null;
  onDragStart: (occurrence: EventOccurrence, dayKey: string) => void;
  onDragOverDay: (dayKey: string) => void;
  onDropOnDay: (dayKey: string) => void;
  onDragEnd: () => void;
}

/** A completed move, kept just long enough to offer an undo. */
interface MovedNotice {
  occurrence: EventOccurrence;
  previous: OccurrenceTimes;
  targetDayKey: string;
  /** Set for a time-grid move: the new time on the reader's clock. */
  time?: string;
}

/** What the form dialog is currently editing, or null when it is closed. */
interface FormState {
  values: CalendarEventFormValues;
  eventId: string | null;
  occurrenceStart: string | null;
  isSeries: boolean;
}

export function AgendaBoard({
  agenda,
  horseNames,
  readerTimeZoneIsFallback,
  defaults = {},
  canEdit,
  orgId,
  userId,
  horses,
  locations,
  assignees,
  templates = [],
  layout = 'list',
}: {
  agenda: Agenda;
  horseNames: Record<string, string>;
  /** The browser has not reported a zone yet, so times are in UTC — say so. */
  readerTimeZoneIsFallback: boolean;
  /**
   * What a new item starts with: the horse and person the view is filtered
   * on. Planning from a horse's own agenda should not mean picking that horse
   * again.
   */
  defaults?: { horseId?: string | null; assigneeId?: string | null };
  canEdit: boolean;
  orgId: string;
  userId: string;
  horses: readonly HorseRow[];
  locations: readonly LocationRow[];
  assignees: readonly ProfileRow[];
  templates?: readonly TrainingTemplate[];
  layout?: AgendaLayout;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const templateDrag = useRef<TrainingTemplate | null>(null);
  const [selection, setSelection] = useState<Map<string, { occurrence: EventOccurrence; dayKey: string }>>(new Map());
  const [bulkBusy, setBulkBusy] = useState(false);

  /** Applies one write per selected item; reports how many failed. */
  const runBulk = async (
    write: (entry: { occurrence: EventOccurrence; dayKey: string }) => Promise<unknown>,
    changedFields: string[],
  ): Promise<void> => {
    setBulkBusy(true);
    setMoveError(null);
    let failed = 0;
    for (const entry of selection.values()) {
      try {
        await write(entry);
        await notifyCalendarChange({
          eventId: entry.occurrence.event_id,
          changedFields,
          occurrenceStart: entry.occurrence.original_start,
        });
      } catch (err) {
        failed += 1;
        log.error('agenda: bulk action failed for an item', {
          key: entry.occurrence.key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    setBulkBusy(false);
    setSelection(new Map());
    if (failed > 0) setMoveError(t('agenda.bulk.partial').replace('{n}', String(failed)));
    router.refresh();
  };
  const [templateActive, setTemplateActive] = useState(false);
  const span = agenda.window;
  const empty = agenda.isEmpty;

  const [selected, setSelected] = useState<EventOccurrence | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  // Drag state. The occurrence being dragged lives in a ref rather than in
  // state because `drop` must read it synchronously, and a state update
  // scheduled by `dragstart` is not guaranteed to have landed by then.
  const dragged = useRef<{ occurrence: EventOccurrence; dayKey: string } | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  // Mirrored into state purely so render can read it; the ref above is what
  // `drop` reads synchronously.
  const [sourceDayKey, setSourceDayKey] = useState<string | null>(null);
  const [overDayKey, setOverDayKey] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState<MovedNotice | null>(null);
  // Optimistic placement: the dropped card shows on its new day at once,
  // marked as saving, instead of sliding back and jumping a second later when
  // the server round-trip lands. Cleared when fresh server data arrives (the
  // card is then really there) or when the write fails (it goes back).
  const [pendingMove, setPendingMove] = useState<{ key: string; from: string; to: string } | null>(null);
  const lastAgenda = useRef(agenda);
  useEffect(() => {
    if (lastAgenda.current !== agenda) {
      lastAgenda.current = agenda;
      setPendingMove(null);
    }
  }, [agenda]);
  const days = useMemo(() => {
    if (pendingMove === null) return agenda.days;
    const item = agenda.days
      .find((d) => d.dayKey === pendingMove.from)
      ?.items.find((i) => i.occurrence.key === pendingMove.key);
    if (item === undefined) return agenda.days;
    return agenda.days.map((d) =>
      d.dayKey === pendingMove.from
        ? { ...d, items: d.items.filter((i) => i.occurrence.key !== pendingMove.key) }
        : d.dayKey === pendingMove.to
          ? {
              ...d,
              items: [...d.items, item].sort((a, b) =>
                (a.readerTime ?? '').localeCompare(b.readerTime ?? ''),
              ),
            }
          : d,
    );
  }, [agenda.days, pendingMove]);
  const gridRef = useRef<HTMLDivElement>(null);
  useFlip(gridRef);
  const overRef = useRef<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // The page is a server component, so a write is reflected by re-running it
  // rather than by patching local state. One source of truth, no divergence
  // between what the grid shows and what the database holds.
  const refresh = (): void => router.refresh();

  // The undo offer expires on its own. A bar that sits there forever becomes
  // furniture, and a stale one invites undoing a move made minutes ago.
  useEffect(() => {
    if (moved === null) return;
    const timer = setTimeout(() => setMoved(null), 10_000);
    return () => clearTimeout(timer);
  }, [moved]);

  function endDrag(): void {
    dragged.current = null;
    overRef.current = null;
    setDraggingKey(null);
    setSourceDayKey(null);
    setOverDayKey(null);
  }

  /** dragover fires every few ms; only a CHANGE of day may re-render. */
  function overDay(dayKey: string | null): void {
    if (overRef.current === dayKey) return;
    overRef.current = dayKey;
    setOverDayKey(dayKey);
  }

  /**
   * Commit a drop.
   *
   * The grid is not patched optimistically. A move can be refused by RLS or
   * lost to a dead connection, and a card that slides to Thursday and stays
   * there while the database still says Tuesday is worse than one that takes
   * a moment to move. `router.refresh()` re-runs the server component, so
   * what is on screen is always what was written.
   */
  const handleDrop = useCallback(
    async (targetDayKey: string): Promise<void> => {
      const payload = dragged.current;
      endDrag();
      if (payload === null || payload.dayKey === targetDayKey) return;

      setMoving(true);
      setMoveError(null);
      setPendingMove({ key: payload.occurrence.key, from: payload.dayKey, to: targetDayKey });
      try {
        const result = await rescheduleOccurrenceToDay(getBrowserSupabase(), {
          occurrence: payload.occurrence,
          targetDayKey,
          readerTimeZone: span.readerTimeZone,
        });
        if (result === null) {
          setPendingMove(null);
          return;
        }
        setMoved({
          occurrence: payload.occurrence,
          previous: result.previous,
          targetDayKey,
        });
        await notifyCalendarChange({
          eventId: payload.occurrence.event_id,
          changedFields: ['starts_at'],
          occurrenceStart: payload.occurrence.original_start,
          previousStartsAt: result.previous.startsAt,
        });
        refresh();
      } catch (err) {
        log.error('agenda: could not move item', {
          key: payload.occurrence.key,
          error: err instanceof Error ? err.message : String(err),
        });
        setPendingMove(null);
        setMoveError(t('agenda.move.failed'));
      } finally {
        setMoving(false);
      }
    },
    // `refresh` and `t` are stable for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endDrag, span.readerTimeZone],
  );

  /** Time-grid drop: another day and/or time, snapped to the quarter hour. */
  const handleTimeDrop = async (
    occurrence: EventOccurrence,
    fromDayKey: string,
    targetDayKey: string,
    minutes: number,
  ): Promise<void> => {
    setMoving(true);
    setMoveError(null);
    if (fromDayKey !== targetDayKey) setPendingMove({ key: occurrence.key, from: fromDayKey, to: targetDayKey });
    try {
      const result = await rescheduleOccurrenceToTime(getBrowserSupabase(), {
        occurrence,
        targetDayKey,
        minutes,
        readerTimeZone: span.readerTimeZone,
      });
      if (result === null) {
        setPendingMove(null);
        return;
      }
      setMoved({ occurrence, previous: result.previous, targetDayKey, time: formatMinutes(minutes) });
      await notifyCalendarChange({
        eventId: occurrence.event_id,
        changedFields: ['starts_at'],
        occurrenceStart: occurrence.original_start,
        previousStartsAt: result.previous.startsAt,
      });
      refresh();
    } catch (err) {
      setPendingMove(null);
      log.error('agenda: could not move item in time grid', {
        key: occurrence.key,
        error: err instanceof Error ? err.message : String(err),
      });
      setMoveError(t('agenda.move.failed'));
    } finally {
      setMoving(false);
    }
  };

  const undoMove = useCallback(async (): Promise<void> => {
    if (moved === null) return;
    setMoving(true);
    try {
      await restoreOccurrenceTimes(
        getBrowserSupabase(),
        moved.occurrence,
        moved.previous,
      );
      await notifyCalendarChange({
        eventId: moved.occurrence.event_id,
        changedFields: ['starts_at'],
        occurrenceStart: moved.occurrence.original_start,
      });
      setMoved(null);
      refresh();
    } catch (err) {
      log.error('agenda: could not undo a move', {
        key: moved.occurrence.key,
        error: err instanceof Error ? err.message : String(err),
      });
      setMoveError(t('agenda.move.undoFailed'));
    } finally {
      setMoving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moved]);

  const drag: DragApi = {
    selected: new Set(selection.keys()),
    onToggleSelect: ({ occurrence, dayKey }) =>
      setSelection((prev) => {
        const next = new Map(prev);
        if (next.has(occurrence.key)) next.delete(occurrence.key);
        else next.set(occurrence.key, { occurrence, dayKey });
        return next;
      }),
    templateActive,
    onTemplateDropOnDay: (dayKey) => {
      const tpl = templateDrag.current;
      templateDrag.current = null;
      setTemplateActive(false);
      overDay(null);
      if (tpl !== null) openPrefilled(dayKey, (base) => applyTemplate(base, tpl));
    },
    active: draggingKey !== null,
    pendingKey: pendingMove?.key ?? null,
    draggingKey,
    sourceDayKey,
    overDayKey,
    onDragStart: (occurrence, dayKey) => {
      dragged.current = { occurrence, dayKey };
      // Next frame, not now: see the note on the card's onDragStart.
      requestAnimationFrame(() => {
        setDraggingKey(occurrence.key);
        setSourceDayKey(dayKey);
        setMoved(null);
      });
    },
    onDragOverDay: overDay,
    onDropOnDay: (dayKey) => void handleDrop(dayKey),
    onDragEnd: endDrag,
  };

  const baseValues = (dayKey: string) => ({
    ...emptyFormValues({ dayKey, timeZone: span.readerTimeZone, horseId: defaults.horseId ?? null }),
    assigneeId: defaults.assigneeId ?? null,
  });
  const openPrefilled = (
    dayKey: string,
    fill: (base: ReturnType<typeof baseValues>) => ReturnType<typeof baseValues>,
  ): void =>
    setForm({ values: fill(baseValues(dayKey)), eventId: null, occurrenceStart: null, isSeries: false });
  const todayKey = agenda.days.find((d) => d.isToday)?.dayKey ?? span.startDayKey;

  // Arriving from ⌘K "Plan something…": straight into the quick-add field.
  useEffect(() => {
    if (canEdit && new URLSearchParams(window.location.search).get('compose') === '1') {
      document.getElementById('agenda-quick-add')?.focus();
    }
  }, [canEdit]);

  // Shortcuts: "/" jumps into quick add, "n" opens a new item for today.
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        setSelection(new Map());
      } else if (e.key === '/') {
        e.preventDefault();
        document.getElementById('agenda-quick-add')?.focus();
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setForm({ values: baseValues(todayKey), eventId: null, occurrenceStart: null, isSeries: false });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const openCreate = (dayKey: string): void =>
    setForm({
      values: {
        ...emptyFormValues({ dayKey, timeZone: span.readerTimeZone, horseId: defaults.horseId ?? null }),
        assigneeId: defaults.assigneeId ?? null,
      },
      eventId: null,
      occurrenceStart: null,
      isSeries: false,
    });

  /**
   * Edit, starting from the master but with the occurrence's own values laid
   * over it. Without that overlay, editing next Tuesday's moved session would
   * open on the series' original time and quietly offer to move it back.
   */
  const openEdit = (master: CalendarEvent, occurrence: EventOccurrence): void => {
    const isSeries =
      master.recurrence_rule !== null && master.recurrence_rule.trim() !== '';
    setSelected(null);
    setForm({
      values: eventToFormValues(
        occurrence.recurring ? { ...master, ...occurrenceFields(occurrence) } : master,
      ),
      eventId: master.id,
      occurrenceStart: occurrence.original_start,
      isSeries,
    });
  };

  const assigneeName = (id: string | null): string | null => {
    if (id === null) return null;
    const person = assignees.find((candidate) => candidate.id === id);
    return person?.name ?? person?.email ?? null;
  };

  const locationName = (id: string | null): string | null =>
    id === null ? null : (locations.find((l) => l.id === id)?.name ?? null);

  return (
    <div>
      {canEdit || readerTimeZoneIsFallback ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-text-tertiary">
            {readerTimeZoneIsFallback ? t('agenda.utcNotice') : null}
          </p>
          {/* The single coral action on this screen. */}
          {canEdit ? (
            <Button
              type="button"
              variant="accent"
              size="sm"
              className="min-h-11"
              onClick={() => openCreate(span.startDayKey)}
            >
              <Plus size={16} />
              {t('agenda.addButton')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {canEdit ? (
        <AgendaComposer
          todayKey={todayKey}
          horses={horses.map((h) => ({ id: h.id, name: h.name }))}
          templates={templates}
          onQuickAdd={(q) => openPrefilled(q.dayKey ?? todayKey, (base) => applyQuickAdd(base, q))}
          onTemplate={(tpl) => openPrefilled(todayKey, (base) => applyTemplate(base, tpl))}
          onTemplateDragStart={(tpl) => {
            templateDrag.current = tpl;
            requestAnimationFrame(() => setTemplateActive(true));
          }}
          onTemplateDragEnd={() => {
            templateDrag.current = null;
            setTemplateActive(false);
            overDay(null);
          }}
        />
      ) : null}

      {/* Drag is invisible until you try it, so it gets one quiet line. Only
          for people who can actually edit — telling a read-only viewer about
          a gesture that will not work is worse than saying nothing. */}
      {canEdit && !empty ? (
        <p className="mb-3 text-[12px] text-text-tertiary">{t('agenda.move.dragHint')}</p>
      ) : null}

      {layout === 'time' ? (
        <TimeGrid
          days={days}
          readerTimeZone={span.readerTimeZone}
          horseNames={horseNames}
          canEdit={canEdit && !moving}
          pendingKey={pendingMove?.key ?? null}
          onOpen={setSelected}
          onMove={(occ, from, to, minutes) => void handleTimeDrop(occ, from, to, minutes)}
          onAdd={(dayKey, minutes) =>
            openPrefilled(dayKey, (base) => ({ ...base, startTime: formatMinutes(minutes) }))
          }
        />
      ) : empty ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={span.view === 'day' ? t('agenda.dayEmptyTitle') : t('agenda.weekEmptyTitle')}
          description={
            canEdit ? t('agenda.weekEmptyDescription') : t('agenda.weekEmptyReadOnly')
          }
        />
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 gap-4',
            span.view === 'week' && 'sm:grid-cols-2 lg:grid-cols-7',
          )}
          ref={gridRef}
          onDragLeave={(e) => {
            const next = e.relatedTarget;
            if (!(next instanceof Node) || !e.currentTarget.contains(next)) overDay(null);
          }}
        >
          {days.map((day, dayIndex) => (
            <FadeIn key={day.dayKey} index={dayIndex}>
              <DayColumn
                dayKey={day.dayKey}
                items={day.items}
                horseNames={horseNames}
                isToday={day.isToday}
                wide={span.view === 'day'}
                canEdit={canEdit}
                onOpen={setSelected}
                onAdd={openCreate}
                drag={drag}
              />
            </FadeIn>
          ))}
        </div>
      )}

      {canEdit ? (
        <BulkBar
          count={selection.size}
          people={assignees}
          busy={bulkBusy}
          onMove={(dayKey) =>
            void runBulk(
              ({ occurrence }) =>
                rescheduleOccurrenceToDay(getBrowserSupabase(), {
                  occurrence,
                  targetDayKey: dayKey,
                  readerTimeZone: span.readerTimeZone,
                }),
              ['starts_at'],
            )
          }
          onAssign={(assigneeId) =>
            void runBulk(({ occurrence }) => assignOccurrence(getBrowserSupabase(), occurrence, assigneeId), ['assignee_id'])
          }
          onClear={() => setSelection(new Map())}
        />
      ) : null}

      {/* Move feedback. Anchored to the grid rather than floating over the
          whole app: it is about the thing the user just dropped, and it
          should disappear with the page it belongs to. */}
      {moveError !== null ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]"
        >
          {moveError}
        </p>
      ) : moved !== null ? (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted px-4 py-2.5"
        >
          <p className="text-[13px] text-text-primary">
            {t('agenda.move.moved')} {formatDayKey(moved.targetDayKey)}
            {moved.time ? ` · ${moved.time}` : ''}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={moving}
            onClick={() => void undoMove()}
          >
            {t('agenda.move.undo')}
          </Button>
        </div>
      ) : null}

      {selected !== null ? (
        <OccurrenceDetailDialog
          open
          onClose={() => setSelected(null)}
          occurrence={selected}
          readerTimeZone={span.readerTimeZone}
          horseName={
            selected.horse_id === null ? null : (horseNames[selected.horse_id] ?? null)
          }
          assigneeName={assigneeName(selected.assignee_id)}
          locationName={locationName(selected.location_id)}
          canEdit={canEdit}
          onEdit={(master) => openEdit(master, selected)}
          onChanged={refresh}
        />
      ) : null}

      {form !== null ? (
        <EventFormDialog
          open
          onClose={() => setForm(null)}
          initialValues={form.values}
          eventId={form.eventId}
          occurrenceStart={form.occurrenceStart}
          isSeries={form.isSeries}
          orgId={orgId}
          userId={userId}
          horses={horses}
          locations={locations}
          assignees={assignees}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}

/** The occurrence's own values, as the subset of a master they override. */
function occurrenceFields(occurrence: EventOccurrence): Partial<CalendarEvent> {
  return {
    title: occurrence.title,
    notes: occurrence.notes,
    starts_at: occurrence.starts_at,
    ends_at: occurrence.ends_at,
    assignee_id: occurrence.assignee_id,
    targets: occurrence.targets,
  };
}
