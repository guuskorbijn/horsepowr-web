/**
 * Public environment access. ONLY NEXT_PUBLIC_* vars — these are anon/public by
 * design. The Supabase service-role key must never be referenced anywhere in
 * this app. Reading it here (or anywhere) is a hard violation of the security
 * model (anon key + RLS only).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.local.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  /** Optional — name of the deployed AI session-summary Edge Function. */
  aiSummaryFunction: process.env.NEXT_PUBLIC_AI_SUMMARY_FUNCTION ?? '',
} as const;
