'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LocaleProvider';
import { shiftWeek } from '@/services/calendar/agendaWeekService';
import { formatZonedTime, zoneShortLabel } from '@/services/time/timezone';
import {
  emptyFormValues,
  eventToFormValues,
} from '@/services/calendar/eventFormMapper';
import { cn } from '@/lib/cn';
import { FadeIn } from '@/components/motion/FadeIn';
import { EventFormDialog } from '@/components/agenda/EventFormDialog';
import { OccurrenceDetailDialog } from '@/components/agenda/OccurrenceDetailDialog';
import type { AgendaWeek } from '@/services/calendar/agendaWeekService';
import type { CalendarEventFormValues } from '@/types/calendarForm';
import type {
  CalendarEvent,
  CalendarEventType,
  EventOccurrence,
} from '@/types/calendar';
import type { HorseRow, LocationRow, ProfileRow } from '@/types/db';

/**
 * Seven days side by side.
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
const TYPE_ACCENT: Record<CalendarEventType, string> = {
  training: 'var(--primary)',
  vet: 'var(--info)',
  physio: 'var(--success)',
  farrier: 'var(--warning)',
  competition: 'var(--color-gait-canter)',
  other: 'var(--line-strong)',
};

function DayColumn({
  dayKey,
  occurrences,
  readerTimeZone,
  horseNames,
  isToday,
  canEdit,
  onOpen,
  onAdd,
}: {
  dayKey: string;
  occurrences: readonly EventOccurrence[];
  readerTimeZone: string;
  horseNames: Record<string, string>;
  isToday: boolean;
  canEdit: boolean;
  onOpen: (occurrence: EventOccurrence) => void;
  onAdd: (dayKey: string) => void;
}) {
  const { t } = useTranslation();
  const weekday = new Date(`${dayKey}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    timeZone: 'UTC',
  });
  const dayNumber = Number(dayKey.slice(8, 10));

  return (
    <div className="group/day flex min-w-0 flex-col">
      <div
        className={cn(
          'mb-2 flex items-baseline gap-2 border-b border-line pb-2',
          isToday && 'border-b-primary',
        )}
      >
        <span className="text-[13px] font-medium uppercase tracking-wide text-text-tertiary">
          {weekday}
        </span>
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
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary opacity-0 transition-opacity duration-150 hover:bg-surface-muted hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover/day:opacity-100"
          >
            <Plus size={14} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {occurrences.length === 0 ? (
          <p className="py-2 text-[13px] text-text-tertiary">{t('agenda.dayEmpty')}</p>
        ) : (
          occurrences.map((occurrence) => {
            const cancelled = occurrence.status === 'cancelled';
            const done = occurrence.status === 'done';
            const zoneLabel = zoneShortLabel(occurrence.timezone, readerTimeZone);
            const horse =
              occurrence.horse_id === null
                ? t('agenda.wholeStable')
                : (horseNames[occurrence.horse_id] ?? t('agenda.wholeStable'));

            return (
              <button
                key={occurrence.key}
                type="button"
                onClick={() => onOpen(occurrence)}
                style={{ borderLeftColor: TYPE_ACCENT[occurrence.type] }}
                className={cn(
                  'w-full rounded-lg border border-l-4 border-line p-2.5 text-left',
                  'transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  done ? 'bg-surface-muted' : 'bg-surface',
                  cancelled && 'opacity-60',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[12px] tabular-nums text-text-primary">
                    {occurrence.all_day
                      ? t('agenda.allDay')
                      : formatZonedTime(occurrence.starts_at, readerTimeZone)}
                  </span>
                  {zoneLabel ? (
                    <span className="text-[11px] text-text-tertiary">{zoneLabel}</span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    'mt-0.5 text-[14px] text-text-primary',
                    cancelled && 'line-through',
                  )}
                >
                  {occurrence.title}
                </p>
                <p className="text-[12px] text-text-secondary">{horse}</p>
                {cancelled ? (
                  <p className="mt-1 text-[11px] text-danger">{t('agenda.cancelled')}</p>
                ) : done ? (
                  <p className="mt-1 text-[11px] text-text-secondary">{t('agenda.done')}</p>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** What the form dialog is currently editing, or null when it is closed. */
interface FormState {
  values: CalendarEventFormValues;
  eventId: string | null;
  occurrenceStart: string | null;
  isSeries: boolean;
}

export function AgendaWeekGrid({
  week,
  horseNames,
  empty,
  canEdit,
  orgId,
  userId,
  horses,
  locations,
  assignees,
}: {
  week: AgendaWeek;
  horseNames: Record<string, string>;
  empty: boolean;
  canEdit: boolean;
  orgId: string;
  userId: string;
  horses: readonly HorseRow[];
  locations: readonly LocationRow[];
  assignees: readonly ProfileRow[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const todayKey = new Date().toISOString().slice(0, 10);

  const [selected, setSelected] = useState<EventOccurrence | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  // The page is a server component, so a write is reflected by re-running it
  // rather than by patching local state. One source of truth, no divergence
  // between what the grid shows and what the database holds.
  const refresh = (): void => router.refresh();

  const openCreate = (dayKey: string): void =>
    setForm({
      values: emptyFormValues({ dayKey, timeZone: week.readerTimeZone }),
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/agenda?week=${shiftWeek(week.startDayKey, -1)}`}
          aria-label={t('agenda.previousWeek')}
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-muted"
        >
          <ChevronLeft size={18} />
        </Link>
        <p className="text-[14px] font-medium text-text-primary">
          {week.startDayKey} &ndash; {week.endDayKey}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/agenda?week=${shiftWeek(week.startDayKey, 1)}`}
            aria-label={t('agenda.nextWeek')}
            className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-muted"
          >
            <ChevronRight size={18} />
          </Link>
          {/* The single coral action on this screen. */}
          {canEdit ? (
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={() => openCreate(week.startDayKey)}
            >
              <Plus size={16} />
              {t('agenda.addButton')}
            </Button>
          ) : null}
        </div>
      </div>

      {empty ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={t('agenda.weekEmptyTitle')}
          description={
            canEdit ? t('agenda.weekEmptyDescription') : t('agenda.weekEmptyReadOnly')
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
          {week.days.map((day, dayIndex) => (
            <FadeIn key={day.dayKey} index={dayIndex}>
              <DayColumn
                dayKey={day.dayKey}
                occurrences={day.occurrences}
                readerTimeZone={week.readerTimeZone}
                horseNames={horseNames}
                isToday={day.dayKey === todayKey}
                canEdit={canEdit}
                onOpen={setSelected}
                onAdd={openCreate}
              />
            </FadeIn>
          ))}
        </div>
      )}

      {selected !== null ? (
        <OccurrenceDetailDialog
          open
          onClose={() => setSelected(null)}
          occurrence={selected}
          readerTimeZone={week.readerTimeZone}
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
