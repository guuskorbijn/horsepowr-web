'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { LocationRow, OrganizationRow } from '@/types/db';

interface OrgContextValue {
  org: OrganizationRow | null;
  locations: LocationRow[];
  /** null = "All locations". */
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
  org,
  locations,
  children,
}: {
  org: OrganizationRow | null;
  locations: LocationRow[];
  children: ReactNode;
}) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ org, locations, selectedLocationId, setSelectedLocationId }),
    [org, locations, selectedLocationId],
  );
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within an OrgProvider');
  return ctx;
}
