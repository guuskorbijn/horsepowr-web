/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 *
 * Source: horsepowr/src/types/calendar.ts
 *
 * CLAUDE.md forbids importing the RN repo as a build dependency, and Vercel
 * builds this repo alone, so shared domain logic is copied rather than linked.
 * The copy is deliberate and checked: `npm run check:mirror` fails when this
 * file and its source have drifted, so the duplication is visible instead of
 * silent. Fix a bug in the mobile repo and re-run the mirror; never patch here.
 *
 * These modules are PURE on purpose — that is what makes them safe to mirror.
 * Anything touching Supabase, storage or React stays on its own side.
 */

import type { TrainingTargets } from '@/services/calendar/trainingTargets';

/**
 * Calendar / planning domain types (Phase 1).
 *
 * Field names are snake_case, matching the database columns exactly. That is a
 * deliberate departure from the camelCase used for the newer `Horse` fields:
 * this is the first MUTABLE synced entity, and its sync pushes a list of
 * changed FIELD NAMES to the server (see SYNCABLE_EVENT_FIELDS). If the local
 * and remote names diverged, every dirty-field list would need a translation
 * table that could silently drift out of date. `Session` already works this
 * way for the same reason.
 */

export type CalendarEventType =
  | 'training'
  | 'vet'
  | 'farrier'
  | 'physio'
  | 'competition'
  | 'other';

export const CALENDAR_EVENT_TYPES: readonly CalendarEventType[] = [
  'training',
  'vet',
  'farrier',
  'physio',
  'competition',
  'other',
] as const;

export type CalendarEventStatus = 'planned' | 'done' | 'cancelled';

export const CALENDAR_EVENT_STATUSES: readonly CalendarEventStatus[] = [
  'planned',
  'done',
  'cancelled',
] as const;

export interface CalendarEvent {
  /** Client-generated uuid — the idempotency key for offline creates. */
  id: string;
  org_id: string;
  /** Null for a stable-wide item (farrier visit, team meeting). */
  horse_id: string | null;
  type: CalendarEventType;
  title: string;
  notes: string | null;
  /** UTC ISO instant. */
  starts_at: string;
  /** UTC ISO instant, or null for an open-ended item. */
  ends_at: string | null;
  all_day: boolean;
  /** IANA zone the event is rendered in, e.g. 'Europe/Amsterdam'. */
  timezone: string;
  location_id: string | null;
  assignee_id: string | null;
  status: CalendarEventStatus;
  created_by: string;
  /** Training only. Null for every other type (enforced by a DB check too). */
  targets: TrainingTargets | null;
  /**
   * WHICH KIND of training is planned, mirroring `sessions.training_type`, so
   * starting a session from a plan has something to prefill. Training only
   * (a DB check enforces it). Plain string rather than the `TrainingType`
   * union because the column is plain text on both tables and the vocabulary
   * is enforced in the app — two enums that could drift apart would be worse
   * than none.
   */
  training_type: string | null;
  /** RFC 5545 RRULE without DTSTART, or null for a one-off. */
  recurrence_rule: string | null;
  created_at: string;
  /** Server-set via trigger. The conflict-resolution clock. */
  updated_at: string;
  /** Soft-delete tombstone. Monotonic: the DB refuses to clear it. */
  deleted_at: string | null;
}

/**
 * A per-occurrence deviation from a recurring master, keyed by the occurrence's
 * ORIGINAL start. Null fields mean "inherit from the master".
 */
export interface CalendarEventOverride {
  id: string;
  event_id: string;
  /** The UTC instant this occurrence was expanded at, before any move. */
  original_start: string;
  cancelled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  title: string | null;
  notes: string | null;
  assignee_id: string | null;
  status: CalendarEventStatus | null;
  targets: TrainingTargets | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * One resolved item on the agenda: a single event, or one expanded occurrence
 * of a recurring master with its override already applied.
 *
 * This is a DERIVED, read-only view — never persisted. Recurring occurrences
 * are expanded over the visible range by a pure function, so there is no row
 * to store and no infinite series to materialise.
 */
export interface EventOccurrence {
  /**
   * Stable identity for list keys and navigation: the master's id for a
   * one-off, or `${eventId}@${originalStart}` for a recurring occurrence.
   */
  key: string;
  /** The underlying (master) event's id. */
  event_id: string;
  /** Null for a one-off; the expanded original start for a recurrence. */
  original_start: string | null;
  /** True when this item came out of a recurrence expansion. */
  recurring: boolean;
  horse_id: string | null;
  type: CalendarEventType;
  title: string;
  notes: string | null;
  /** Effective UTC start, after any override move. */
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  timezone: string;
  location_id: string | null;
  assignee_id: string | null;
  status: CalendarEventStatus;
  targets: TrainingTargets | null;
}

/**
 * Columns a local (offline) edit may push to an already-synced event.
 *
 * Absent on purpose: `id`, `org_id`, `created_by`, `created_at`, `updated_at`.
 * Identity and provenance are set once at creation; `updated_at` is server-set
 * because it is the conflict clock and a wrong device clock must not win it.
 */
export const SYNCABLE_EVENT_FIELDS = [
  'horse_id',
  'type',
  'title',
  'notes',
  'starts_at',
  'ends_at',
  'all_day',
  'timezone',
  'location_id',
  'assignee_id',
  'status',
  'targets',
  'training_type',
  'recurrence_rule',
  'deleted_at',
] as const;

export type SyncableEventField = (typeof SYNCABLE_EVENT_FIELDS)[number];

export const SYNCABLE_OVERRIDE_FIELDS = [
  'cancelled',
  'starts_at',
  'ends_at',
  'title',
  'notes',
  'assignee_id',
  'status',
  'targets',
  'deleted_at',
] as const;

export type SyncableOverrideField = (typeof SYNCABLE_OVERRIDE_FIELDS)[number];
