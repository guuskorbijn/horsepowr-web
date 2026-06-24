/**
 * View-model types — shapes the UI renders, decoupled from raw DB rows. The
 * single ChartSeries shape is shared by the single-session, comparison and
 * trend charts so one renderer serves all three (DRY / SOLID).
 */
import type { GaitKey } from '@/theme/tokens';
import type { HorseRow, SessionRow } from '@/types/db';

/** One sample on a time axis. `t` is ms elapsed from session start. */
export interface ChartPoint {
  t: number;
  v: number;
}

export type SeriesKind = 'hr' | 'speed' | 'altitude';

export interface ChartSeries {
  key: string;
  kind: SeriesKind;
  label: string;
  unit: string;
  /** Stroke colour (hex or CSS var). */
  color: string;
  points: ChartPoint[];
}

/** A contiguous run of one estimated gait, in ms offsets from session start. */
export interface GaitBand {
  gait: GaitKey;
  startTs: number;
  endTs: number;
}

/** Ordered GPS track point (for the route map). */
export interface RoutePoint {
  lat: number;
  lng: number;
  t: number;
  speed: number | null;
}

/** Descriptive, measured summary of a session. No judgments. */
export interface SessionMetrics {
  durationMs: number;
  /** Total GPS distance in metres, or null when there's no GPS. */
  distanceM: number | null;
  avgHr: number | null;
  peakHr: number | null;
  minHr: number | null;
  avgSpeedMs: number | null;
  maxSpeedMs: number | null;
  altitudeGainM: number | null;
  hrSampleCount: number;
  gpsSampleCount: number;
}

/** A session paired with its horse — the common list/row shape. */
export interface SessionWithHorse {
  session: SessionRow;
  horse: HorseRow;
}

/** Last-session glance used on the command center horse cards. */
export interface HorseLastSession {
  horse: HorseRow;
  lastSession: SessionRow | null;
  metrics: SessionMetrics | null;
}
