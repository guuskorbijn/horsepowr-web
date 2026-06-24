import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

/** The project's Supabase client, typed against the frozen schema. */
export type Supa = SupabaseClient<Database>;
