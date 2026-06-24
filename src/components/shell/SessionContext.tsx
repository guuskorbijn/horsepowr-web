'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { capabilitiesFor, type Capabilities } from '@/lib/roles';
import type { SessionUser } from '@/components/shell/UserMenu';

interface SessionContextValue {
  user: SessionUser;
  capabilities: Capabilities;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ user, capabilities: capabilitiesFor(user.role) }),
    [user],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}

/** Convenience: the signed-in user's role. */
export function useRole() {
  return useSession().user.role;
}

/** Convenience: capability check, e.g. `useCan('canEdit')`. */
export function useCan(capability: keyof Capabilities): boolean {
  return useSession().capabilities[capability];
}
