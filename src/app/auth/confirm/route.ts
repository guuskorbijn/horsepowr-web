import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Magic-link / email confirmation handler. Supports both the PKCE `code` flow
 * (default for the @supabase/ssr browser client) and the `token_hash` OTP flow,
 * so it works whichever email template the project uses. On success it lands the
 * user at `next` (validated to a same-app path); on failure, back to /login.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const rawNext = searchParams.get('next');
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const supa = await getServerSupabase();

  if (code) {
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supa.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const failed = new URL('/login', origin);
  failed.searchParams.set('error', 'link-expired');
  return NextResponse.redirect(failed);
}
