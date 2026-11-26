import type { AgendaDay, AgendaItem } from '@/services/calendar/agendaService';

/**
 * Geometry for the time-grid view. PURE: minutes from midnight on the
 * reader's clock -> rows; overlapping items share the column in lanes
 * (greedy, like every calendar app); a drag snaps to a quarter hour.
 */

export const SNAP_MIN = 15;
export const DEFAULT_LENGTH_MIN = 45;
export const MIN_LENGTH_MIN = 20;

export interface PlacedItem {
  item: AgendaItem;
  startMin: number;
  lengthMin: number;
  lane: number;
  lanes: number;
}

export interface TimeGridDay {
  dayKey: string;
  isToday: boolean;
  allDay: AgendaItem[];
  placed: PlacedItem[];
}

export interface TimeGridLayout {
  days: TimeGridDay[];
  /** First and last hour shown (inclusive start, exclusive end). */
  fromHour: number;
  toHour: number;
}

function minutesOf(time: string | null): number | null {
  if (time === null) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function lengthOf(item: AgendaItem): number {
  const { starts_at, ends_at } = item.occurrence;
  if (ends_at === null) return DEFAULT_LENGTH_MIN;
  const min = Math.round((Date.parse(ends_at) - Date.parse(starts_at)) / 60_000);
  return Math.max(MIN_LENGTH_MIN, Number.isFinite(min) ? min : DEFAULT_LENGTH_MIN);
}

export function layoutTimeGrid(days: readonly AgendaDay[], fromHour = 6, toHour = 21): TimeGridLayout {
  let from = fromHour;
  let to = toHour;
  const out: TimeGridDay[] = days.map((day) => {
    const allDay: AgendaItem[] = [];
    const timed: Array<{ item: AgendaItem; startMin: number; lengthMin: number }> = [];
    for (const item of day.items) {
      const start = item.occurrence.all_day ? null : minutesOf(item.readerTime);
      if (start === null) allDay.push(item);
      else timed.push({ item, startMin: start, lengthMin: lengthOf(item) });
    }
    timed.sort((a, b) => a.startMin - b.startMin || b.lengthMin - a.lengthMin);

    // Greedy lanes within clusters of overlapping items.
    const placed: PlacedItem[] = [];
    let cluster: PlacedItem[] = [];
    let clusterEnd = -1;
    const flush = (): void => {
      const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
      for (const p of cluster) p.lanes = lanes;
      placed.push(...cluster);
      cluster = [];
    };
    for (const t of timed) {
      if (t.startMin >= clusterEnd && cluster.length > 0) flush();
      const laneEnds: number[] = [];
      for (const p of cluster) laneEnds[p.lane] = Math.max(laneEnds[p.lane] ?? -1, p.startMin + p.lengthMin);
      let lane = laneEnds.findIndex((end) => end <= t.startMin);
      if (lane < 0) lane = laneEnds.length;
      cluster.push({ ...t, lane, lanes: 1 });
      clusterEnd = Math.max(clusterEnd, t.startMin + t.lengthMin);
      from = Math.min(from, Math.floor(t.startMin / 60));
      to = Math.max(to, Math.ceil((t.startMin + t.lengthMin) / 60));
    }
    if (cluster.length > 0) flush();
    return { dayKey: day.dayKey, isToday: day.isToday, allDay, placed };
  });
  return { days: out, fromHour: Math.max(0, from), toHour: Math.min(24, to) };
}

/** A pointer offset (px from the grid's top) to snapped minutes after midnight. */
export function snapMinutes(offsetPx: number, pxPerHour: number, fromHour: number): number {
  const raw = fromHour * 60 + (offsetPx / pxPerHour) * 60;
  return Math.max(0, Math.min(24 * 60 - SNAP_MIN, Math.round(raw / SNAP_MIN) * SNAP_MIN));
}

export function formatMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
