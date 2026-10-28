import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/env', () => ({
  env: { supabaseUrl: 'http://localhost:54321', supabaseAnonKey: 'anon', aiSummaryFunction: '' },
}));

// A signed-out visitor: the auth check finds no user.
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

const { updateSession } = await import('@/lib/supabase/middleware');

describe('auth gate (smoke)', () => {
  it.each(['/agenda', '/horses/abc/agenda', '/sessions/import'])(
    'sends a signed-out visitor from %s to /login, remembering where they were going',
    async (path) => {
      const response = await updateSession(new NextRequest(`http://localhost:3000${path}`));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location') ?? '');
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('next')).toBe(path);
    },
  );

  it('lets the login page through', async () => {
    const response = await updateSession(new NextRequest('http://localhost:3000/login'));
    expect(response.headers.get('location')).toBeNull();
  });
});
