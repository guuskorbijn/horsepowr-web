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

export type TrainingType =
  | 'dressage'
  | 'cross_country'
  | 'conditioning'
  | 'other';

export type OrganizationRow = {
  id: string;
  name: string;
  location: string | null;
  country: string | null;
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
  physical_rating: number | null;
  mental_rating: number | null;
  injury_concern: boolean;
  injury_recovery: boolean;
}

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

type InsertOf<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

/** Per-table shape matching `supabase gen types` output (incl. Relationships,
 *  which the typed client requires — without it, Insert/Update degrade to never). */
interface TableDef<Row, Insert> {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      organizations: TableDef<
        OrganizationRow,
        InsertOf<OrganizationRow, 'id' | 'created_at' | 'location' | 'country'>
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
          'id' | 'created_at' | 'location_id' | 'discipline' | 'photo_url' | 'active' | 'max_hr'
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
