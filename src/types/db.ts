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

export interface OrganizationRow {
  id: string;
  name: string;
  location: string | null;
  country: string | null;
  created_at: string;
}

export interface LocationRow {
  id: string;
  org_id: string;
  name: string;
  country: string | null;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  org_id: string | null;
  role: UserRole;
  name: string | null;
  email: string | null;
  created_at: string;
}

export interface HorseRow {
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

export interface SessionRow {
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

export interface MeasurementRow {
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

export interface SessionGaitSegmentsRow {
  session_id: string;
  segments: GaitSegmentJson[];
  classifier_kind: string;
  classifier_version: number;
  computed_at: string;
}

/** Shape stored in session_gait_segments.segments (jsonb). startTs/endTs are ms
 *  offsets from sessions.started_at. Mirrors RN src/types/gait.ts GaitSegment. */
export interface GaitSegmentJson {
  gait: 'inactive' | 'walk' | 'trot' | 'canter';
  startTs: number;
  endTs: number;
}

type Identity<T> = T;
type InsertOf<T, Optional extends keyof T> = Identity<
  Omit<T, Optional> & Partial<Pick<T, Optional>>
>;

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: InsertOf<OrganizationRow, 'id' | 'created_at' | 'location' | 'country'>;
        Update: Partial<OrganizationRow>;
      };
      locations: {
        Row: LocationRow;
        Insert: InsertOf<LocationRow, 'id' | 'created_at' | 'country'>;
        Update: Partial<LocationRow>;
      };
      profiles: {
        Row: ProfileRow;
        Insert: InsertOf<ProfileRow, 'created_at' | 'org_id' | 'name' | 'email' | 'role'>;
        Update: Partial<ProfileRow>;
      };
      horses: {
        Row: HorseRow;
        Insert: InsertOf<
          HorseRow,
          'id' | 'created_at' | 'location_id' | 'discipline' | 'photo_url' | 'active' | 'max_hr'
        >;
        Update: Partial<HorseRow>;
      };
      sessions: {
        Row: SessionRow;
        Insert: InsertOf<
          SessionRow,
          | 'id' | 'created_at' | 'ended_at' | 'notes' | 'synced' | 'training_type'
          | 'environment' | 'location_name' | 'physical_rating' | 'mental_rating'
          | 'injury_concern' | 'injury_recovery'
        >;
        Update: Partial<SessionRow>;
      };
      measurements: {
        Row: MeasurementRow;
        Insert: InsertOf<
          MeasurementRow,
          'id' | 'hr_bpm' | 'rr_ms' | 'speed_ms' | 'altitude_m' | 'lat' | 'lng'
        >;
        Update: Partial<MeasurementRow>;
      };
      session_gait_segments: {
        Row: SessionGaitSegmentsRow;
        Insert: InsertOf<
          SessionGaitSegmentsRow,
          'classifier_kind' | 'classifier_version' | 'computed_at'
        >;
        Update: Partial<SessionGaitSegmentsRow>;
      };
    };
  };
}
