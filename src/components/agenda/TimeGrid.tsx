'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useLive } from '@/components/live/LiveProvider';
import { cn } from '@/lib/cn';
import { TYPE_ACCENT } from '@/services/calendar/eventTypeAccent';
import {
  formatMinutes,
  layoutTimeGrid,
  snapMinutes,
  type PlacedItem,
} from '@/services/calendar/timeGridLayout';
import type { AgendaDay } from '@/services/calendar/agendaService';
import type { EventOccurrence } from '@/types/calendar';

/**
 * The agenda on an hour axis. Items sit at their time, overlapping items share
 * the day in lanes, today has a live "now" line. Dragging a card (pointer, so
 * it works with mouse, pen and touch) moves it to another day AND time,
 * snapped to the quarter hour, with the target time shown on the ghost. A
 * click without movement opens the item. Recurring items move only that
 * occurrence (an override), exactly like the list view.
 */

const PX_PER_HOUR = 56;
const DRAG_THRESHOLD = 5;

interface DragState {
  item: PlacedItem;
  fromDayKey: string;
  startX: number;
  startY: number;
  moved: boolean;
  dayIndex: number;
  minutes: number;
  /** Pointer offset inside the card, so the card does not jump under the cursor. */
  grabOffsetMin: number;
}

function nowMinutes(timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function TimeGrid({
  days,
  readerTimeZone,
  horseNames,
  canEdit,
  pendingKey,
  onOpen,
  onMove,
  onAdd,
}: {
  days: readonly AgendaDay[];
  readerTimeZone: string;
  horseNames: Record<string, string>;
  canEdit: boolean;
  pendingKey: string | null;
  onOpen: (occurrence: EventOccurrence) => void;
  onMove: (occurrence: EventOccurrence, fromDayKey: string, toDayKey: string, minutes: number) => void;
  onAdd: (dayKey: string, minutes: number) => void;
}) {
  const { t, locale } = useTranslation();
  const { recent } = useLive();
  const grid = useMemo(() => layoutTimeGrid(days), [days]);
  const body = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = (): void => setNow(nowMinutes(readerTimeZone));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [readerTimeZone]);

  const hours = Array.from({ length: grid.toHour - grid.fromHour }, (_, i) => grid.fromHour + i);
  const height = hours.length * PX_PER_HOUR;
  const topOf = (min: number): number => ((min - grid.fromHour * 60) / 60) * PX_PER_HOUR;

  const locate = (clientX: number, clientY: number, grabOffsetMin: number): { dayIndex: number; minutes: number } | null => {
    const el = body.current;
    if (el === null) return null;
    const rect = el.getBoundingClientRect();
    const colW = rect.width / grid.days.length;
    const dayIndex = Math.max(0, Math.min(grid.days.length - 1, Math.floor((clientX - rect.left) / colW)));
    const minutes = snapMinutes(clientY - rect.top - (grabOffsetMin / 60) * PX_PER_HOUR, PX_PER_HOUR, grid.fromHour);
    return { dayIndex, minutes };
  };

  const onPointerDown = (e: ReactPointerEvent, item: PlacedItem, dayKey: string, dayIndex: number): void => {
    if (!canEdit || e.button !== 0) return;
    const card = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const grabOffsetMin = ((e.clientY - card.top) / PX_PER_HOUR) * 60;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ item, fromDayKey: dayKey, startX: e.clientX, startY: e.clientY, moved: false, dayIndex, minutes: item.startMin, grabOffsetMin });
  };

  const onPointerMove = (e: ReactPointerEvent): void => {
    if (drag === null) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD;
    if (!moved) return;
    const at = locate(e.clientX, e.clientY, drag.grabOffsetMin);
    if (at === null) return;
    if (at.dayIndex !== drag.dayIndex || at.minutes !== drag.minutes || !drag.moved) {
      setDrag({ ...drag, moved: true, ...at });
    }
  };

  const onPointerUp = (): void => {
    if (drag === null) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      onOpen(d.item.item.occurrence);
      return;
    }
    const toDay = grid.days[d.dayIndex]?.dayKey;
    if (toDay === undefined) return;
    if (toDay === d.fromDayKey && d.minutes === d.item.startMin) return;
    onMove(d.item.item.occurrence, d.fromDayKey, toDay, d.minutes);
  };

  const weekday = (key: string): string =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', { weekday: 'short', timeZone: 'UTC' });

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* Day headers + all-day row */}
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `3.25rem repeat(${grid.days.length}, minmax(0, 1fr))` }}>
        <div />
        {grid.days.map((day) => (
          <div key={day.dayKey} className="min-w-0 border-l border-line px-2 py-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] uppercase text-text-tertiary">{weekday(day.dayKey)}</span>
              <span className={cn('flex h-7 min-w-7 items-center justify-center rounded-full font-display text-[15px] font-semibold', day.isToday ? 'bg-primary px-1.5 text-on-primary' : 'text-text-primary')}>
                {Number(day.dayKey.slice(8, 10))}
              </span>
            </div>
            <div className="mt-1 space-y-1">
              {day.allDay.map((item) => (
                <button
                  key={item.occurrence.key}
                  type="button"
                  onClick={() => onOpen(item.occurrence)}
                  className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-text-primary"
                  style={{ background: `color-mix(in srgb, ${TYPE_ACCENT[item.occurrence.type]} 18%, transparent)` }}
                >
                  {item.occurrence.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Hour axis + columns */}
      <div className="max-h-[70vh] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `3.25rem 1fr` }}>
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-text-tertiary" style={{ top: topOf(h * 60) }}>
                {h === grid.fromHour ? '' : `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          <div
            ref={body}
            className={cn('relative grid touch-none select-none', drag?.moved && 'cursor-grabbing')}
            style={{ height, gridTemplateColumns: `repeat(${grid.days.length}, minmax(0, 1fr))` }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
          >
            {/* hour lines */}
            {hours.map((h) => (
              <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: topOf(h * 60) }} />
            ))}
            {grid.days.map((day, dayIndex) => (
              <div
                key={day.dayKey}
                className={cn('relative border-l border-line', day.isToday && 'bg-primary-soft/30', drag?.moved && drag.dayIndex === dayIndex && 'bg-primary-soft/60')}
                onDoubleClick={(e) => {
                  if (!canEdit) return;
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onAdd(day.dayKey, snapMinutes(e.clientY - rect.top, PX_PER_HOUR, grid.fromHour));
                }}
              >
                {day.isToday && now !== null && now >= grid.fromHour * 60 && now < grid.toHour * 60 ? (
                  <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: topOf(now) }}>
                    <span className="-ml-1 h-2 w-2 rounded-full bg-danger" />
                    <span className="h-px flex-1 bg-danger" />
                  </div>
                ) : null}
                {day.placed.map((p) => {
                  const o = p.item.occurrence;
                  const isDragged = drag?.moved === true && drag.item.item.occurrence.key === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onPointerDown={(e) => onPointerDown(e, p, day.dayKey, dayIndex)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onOpen(o);
                      }}
                      className={cn(
                        'absolute z-10 overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left shadow-sm transition-[top,left,opacity] duration-300',
                        canEdit ? 'cursor-grab' : 'cursor-pointer',
                        p.item.done && 'opacity-70',
                        p.item.cancelled && 'opacity-40 line-through',
                        isDragged && 'opacity-30',
                        pendingKey === o.key && 'animate-pulse',
                        recent.has(o.event_id) && 'hp-just-changed',
                      )}
                      style={{
                        top: topOf(p.startMin),
                        height: Math.max(22, (p.lengthMin / 60) * PX_PER_HOUR - 2),
                        left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / p.lanes}% - 4px)`,
                        borderLeftColor: TYPE_ACCENT[o.type],
                        background: `color-mix(in srgb, ${TYPE_ACCENT[o.type]} 14%, var(--color-surface))`,
                      }}
                    >
                      <span className="block truncate text-[11px] tabular-nums text-text-secondary">{p.item.readerTime}</span>
                      <span className="block truncate text-[12px] font-medium leading-tight text-text-primary">{o.title}</span>
                      {o.horse_id ? <span className="block truncate text-[11px] text-text-secondary">{horseNames[o.horse_id]}</span> : null}
                    </button>
                  );
                })}
                {/* Ghost at the snapped target */}
                {drag?.moved && drag.dayIndex === dayIndex ? (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-dashed border-primary bg-primary-soft/80 px-1.5 py-1 shadow-lg"
                    style={{ top: topOf(drag.minutes), height: Math.max(22, (drag.item.lengthMin / 60) * PX_PER_HOUR - 2) }}
                  >
                    <span className="block text-[12px] font-semibold tabular-nums text-primary">{formatMinutes(drag.minutes)}</span>
                    <span className="block truncate text-[12px] text-text-primary">{drag.item.item.occurrence.title}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      {canEdit ? (
        <p className="border-t border-line px-3 py-2 text-[12px] text-text-tertiary">{t('agenda.timeGrid.hint')}</p>
      ) : null}
    </div>
  );
}
