import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import type { SessionUser } from '@/components/shell/UserMenu';

/**
 * Authenticated app shell layout.
 *
 * WP-W1 ships the shell with a placeholder session so the UI boots and both
 * themes render. WP-W2 replaces this with a real Supabase session fetch
 * (redirect to /login when unauthenticated) and WP-W3 supplies the real org +
 * locations from repositories. The shape passed to <AppShell> stays the same.
 */
const PLACEHOLDER_USER: SessionUser = {
  name: 'Signed-in user',
  email: 'user@example.com',
  role: 'trainer',
};

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell user={PLACEHOLDER_USER} org={null} locations={[]}>
      {children}
    </AppShell>
  );
}
