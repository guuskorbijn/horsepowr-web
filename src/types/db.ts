import type { CalendarEventStatus, CalendarEventType } from '@/types/calendar';
/**
 * Database types — hand-authored mirror of the HorsePowr Supabase schema.
 *
 * The Supabase CLI was not authenticated in the build environment, so these
 * types are transcribed verbatim from the RN repo's migrations (the frozen
 * schema, read-only): supabase/migrations/0001_init.sql … 20260621000001.
 * SHAPED like `supabase gen types typescript` output so they can be swapped for
 * generated types later with no call-site changes.
 *
 * SCHEMA IS FROZEN — these types are descriptive only; do not add tables here to
 * "make a feature work". If a column is missing, it's missing in the DB too.
 */

export type UserRole = 'trainer' | 'owner' | 'vet';

/** Constrained vocabulary for horses.sex (20260715000000_horse_richer_data.sql). */
export type HorseSex = 'mare' | 'gelding' | 'stallion';

export type TrainingType =
  | 'dressage'
  | 'cross_country'
  | 'conditioning'
  | 'other';

/** The vocabulary, as a value. Mirrors RN `src/types/session.ts`. */
export const TRAINING_TYPES: readonly TrainingType[] = [
  'dressage',
  'cross_country',
  'conditioning',
  'other',
] as const;

/** Narrows a stored string to the known vocabulary, or null. */
export function asTrainingType(value: string | null | undefined): TrainingType | null {
  if (value == null) return null;
  return (TRAINING_TYPES as readonly string[]).includes(value)
    ? (value as TrainingType)
    : null;
}

export type OrganizationRow = {
  id: string;
  name: string;
  location: string | null;
  country: string | null;
  logo_url: string | null;
  created_at: string;
}

export type LocationRow = {
  id: string;
  org_id: string;
  name: string;
  country: string | null;
  created_at: string;
}

export type ProfileRow = {
  id: string;
  org_id: string | null;
  role: UserRole;
  name: string | null;
  email: string | null;
  created_at: string;
}

export type HorseRow = {
  id: string;
  org_id: string;
  location_id: string | null;
  name: string;
  discipline: string | null;
  photo_url: string | null;
  active: boolean;
  max_hr: number;
  // Richer data model (Block C — 20260715000000_horse_richer_data.sql). All
  // nullable. Age is DERIVED from date_of_birth in the UI, never stored.
  date_of_birth: string | null;
  sex: HorseSex | null;
  breed: string | null;
  level: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  chip_number: string | null;
  created_at: string;
}

export type SessionRow = {
  id: string;
  horse_id: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  synced: boolean;
  created_at: string;
  // WP9 structured annotations
  training_type: TrainingType | null;
  environment: string | null;
  location_name: string | null;
  /**
   * The agenda item this recording was started from (Phase 1, live on remote).
   * Optional here because older rows predate it and PostgREST returns null.
   */
  planned_event_id?: string | null;
  /**
   * Phase 2 PROPOSAL columns (20261016000000_sessions_planned_link.sql, not
   * applied to remote). PostgREST omits a column it does not have, so these
   * are optional and read as absent until that migration lands. Never write
   * them from web.
   */
  planned_occurrence_start?: string | null;
  planned_targets_snapshot?: unknown;
  /**
   * Provenance (20261126000001_sessions_source.sql, applied). Optional
   * because rows read through older selects omit them.
   */
  source?: SessionSource;
  source_file_sha256?: string | null;
  external_id?: string | null;
  physical_rating: number | null;
  mental_rating: number | null;
  injury_concern: boolean;
  injury_recovery: boolean;
}

export type SessionSource =
  | 'recorded'
  | 'import_tcx'
  | 'import_gpx'
  | 'import_fit'
  | 'import_csv'
  | 'polar_accesslink';

export type MeasurementRow = {
  id: string;
  session_id: string;
  timestamp: string;
  hr_bpm: number | null;
  rr_ms: number[] | null;
  speed_ms: number | null;
  altitude_m: number | null;
  lat: number | null;
  lng: number | null;
}

export type SessionGaitSegmentsRow = {
  session_id: string;
  segments: GaitSegmentJson[];
  classifier_kind: string;
  classifier_version: number;
  computed_at: string;
}

/** Shape stored in session_gait_segments.segments (jsonb). startTs/endTs are ms
 *  offsets from sessions.started_at. Mirrors RN src/types/gait.ts GaitSegment. */
export type GaitSegmentJson = {
  gait: 'inactive' | 'walk' | 'trot' | 'canter';
  startTs: number;
  endTs: number;
}


/**
 * `calendar_events` as PostgREST returns it. Mirrors the RN migration
 * 20261015000000_calendar_events.sql; the domain shape (with `targets` parsed)
 * lives in `src/types/calendar.ts`.
 *
 * `targets` is `unknown` on purpose: it is jsonb, and the repository runs it
 * through the zod schema rather than trusting the column's shape.
 *
 * `training_type` is optional because the migration that adds it is still a
 * proposal on the RN side. PostgREST simply omits a column it does not have,
 * and the repository drops it from writes when the server rejects it.
 */
export type CalendarEventRow = {
  id: string;
  org_id: string;
  horse_id: string | null;
  type: CalendarEventType;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  timezone: string;
  location_id: string | null;
  assignee_id: string | null;
  status: CalendarEventStatus;
  created_by: string;
  targets: unknown;
  training_type?: string | null;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
  deleted_at: string | null;
}

/** `calendar_event_overrides` as PostgREST returns it. */
export type CalendarEventOverrideRow = {
  id: string;
  event_id: string;
  original_start: string;
  cancelled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  title: string | null;
  notes: string | null;
  assignee_id: string | null;
  status: CalendarEventStatus | null;
  targets: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

type InsertOf<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

/** Per-table shape matching `supabase gen types` output (incl. Relationships,
 *  which the typed client requires — without it, Insert/Update degrade to never). */
interface TableDef<Row, Insert> {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
}

export const CONTACT_ROLES = ['owner', 'vet', 'farrier', 'physio', 'rider', 'other'] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

/** `contacts` (20261126000003). Soft-deleted. */
export type ContactRow = {
  id: string;
  org_id: string;
  name: string;
  role: ContactRole;
  company: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type HorseContactRow = {
  horse_id: string;
  contact_id: string;
  created_at: string;
};

export const HEALTH_RECORD_KINDS = [
  'note', 'vaccination', 'deworming', 'injury', 'treatment', 'dental', 'other',
] as const;
export type HealthRecordKind = (typeof HEALTH_RECORD_KINDS)[number];

/**
 * `horse_health_records` (20261126000003). What the stable wants to
 * remember — never interpreted by HorsePowr. Soft-deleted.
 */
export type HealthRecordRow = {
  id: string;
  org_id: string;
  horse_id: string;
  kind: HealthRecordKind;
  /** YYYY-MM-DD */
  occurred_on: string;
  title: string;
  body: string | null;
  /** YYYY-MM-DD; a vaccination's expiry. */
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PolarInboxRow = {
  id: string;
  org_id: string;
  user_id: string;
  polar_exercise_id: string;
  started_at: string;
  duration_sec: number | null;
  sport: string | null;
  has_hr: boolean;
  tcx: string;
  suggested_horse_id: string | null;
  status: 'pending' | 'imported' | 'dismissed';
  session_id: string | null;
  created_at: string;
  updated_at: string;
};

/** `training_templates` (20261127000001). */
export type TrainingTemplateRow = {
  id: string;
  org_id: string;
  name: string;
  training_type: string | null;
  duration_min: number | null;
  targets: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** `event_checklist_items` (20261127000001). */
export type ChecklistItemRow = {
  id: string;
  org_id: string;
  event_id: string;
  label: string;
  done: boolean;
  position: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      organizations: TableDef<
        OrganizationRow,
        InsertOf<OrganizationRow, 'id' | 'created_at' | 'location' | 'country' | 'logo_url'>
      >;
      locations: TableDef<
        LocationRow,
        InsertOf<LocationRow, 'id' | 'created_at' | 'country'>
      >;
      profiles: TableDef<
        ProfileRow,
        InsertOf<ProfileRow, 'created_at' | 'org_id' | 'name' | 'email' | 'role'>
      >;
      horses: TableDef<
        HorseRow,
        InsertOf<
          HorseRow,
          | 'id' | 'created_at' | 'location_id' | 'discipline' | 'photo_url' | 'active' | 'max_hr'
          | 'date_of_birth' | 'sex' | 'breed' | 'level' | 'height_cm' | 'weight_kg' | 'chip_number'
        >
      >;
      sessions: TableDef<
        SessionRow,
        InsertOf<
          SessionRow,
          | 'id' | 'created_at' | 'ended_at' | 'notes' | 'synced' | 'training_type'
          | 'environment' | 'location_name' | 'physical_rating' | 'mental_rating'
          | 'injury_concern' | 'injury_recovery'
        >
      >;
      measurements: TableDef<
        MeasurementRow,
        InsertOf<
          MeasurementRow,
          'id' | 'hr_bpm' | 'rr_ms' | 'speed_ms' | 'altitude_m' | 'lat' | 'lng'
        >
      >;
      calendar_events: TableDef<
        CalendarEventRow,
        InsertOf<
          CalendarEventRow,
          | 'created_at' | 'updated_at' | 'deleted_at' | 'notes' | 'ends_at'
          | 'all_day' | 'horse_id' | 'location_id' | 'assignee_id' | 'status'
          | 'targets' | 'training_type' | 'recurrence_rule'
        >
      >;
      calendar_event_overrides: TableDef<
        CalendarEventOverrideRow,
        InsertOf<
          CalendarEventOverrideRow,
          | 'created_at' | 'updated_at' | 'deleted_at' | 'cancelled' | 'starts_at'
          | 'ends_at' | 'title' | 'notes' | 'assignee_id' | 'status' | 'targets'
        >
      >;
      contacts: TableDef<
        ContactRow,
        InsertOf<
          ContactRow,
          | 'id' | 'role' | 'company' | 'phone' | 'email' | 'notes' | 'created_by'
          | 'created_at' | 'updated_at' | 'deleted_at'
        >
      >;
      horse_contacts: TableDef<HorseContactRow, InsertOf<HorseContactRow, 'created_at'>>;
      horse_health_records: TableDef<
        HealthRecordRow,
        InsertOf<
          HealthRecordRow,
          | 'id' | 'kind' | 'body' | 'valid_until' | 'created_by' | 'created_at'
          | 'updated_at' | 'deleted_at'
        >
      >;
      polar_inbox: TableDef<
        PolarInboxRow,
        InsertOf<
          PolarInboxRow,
          'id' | 'duration_sec' | 'sport' | 'has_hr' | 'suggested_horse_id' | 'status'
          | 'session_id' | 'created_at' | 'updated_at'
        >
      >;
      training_templates: TableDef<
        TrainingTemplateRow,
        InsertOf<TrainingTemplateRow, 'id' | 'training_type' | 'duration_min' | 'targets' | 'created_by' | 'created_at' | 'updated_at' | 'deleted_at'>
      >;
      event_checklist_items: TableDef<
        ChecklistItemRow,
        InsertOf<ChecklistItemRow, 'id' | 'done' | 'position' | 'updated_by' | 'created_at' | 'updated_at'>
      >;
      session_gait_segments: TableDef<
        SessionGaitSegmentsRow,
        InsertOf<
          SessionGaitSegmentsRow,
          'classifier_kind' | 'classifier_version' | 'computed_at'
        >
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
