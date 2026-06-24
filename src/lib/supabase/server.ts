import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from '@/types/db';

/**
 * Server-side Supabase client (anon key only) wired to Next's cookie store for
 * App-Router session handling. Use in server components / route handlers. The
 * service-role key is never used here.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` is called from a Server Component where mutating cookies is
          // not allowed. Safe to ignore — the middleware refreshes the session.
        }
      },
    },
  });
}
