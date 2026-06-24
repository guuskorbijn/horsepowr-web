'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from '@/types/db';

/**
 * Browser-side Supabase client (anon key only). Used by client components for
 * interactive reads/writes under RLS. A single instance is reused per tab.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getBrowserSupabase() {
  if (!client) {
    client = createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  }
  return client;
}
