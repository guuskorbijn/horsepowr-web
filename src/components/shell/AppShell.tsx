import type { ReactNode } from 'react';
import { Sidebar } from '@/components/shell/Sidebar';
import { TopBar } from '@/components/shell/TopBar';
import { OrgProvider } from '@/components/shell/OrgContext';
import type { SessionUser } from '@/components/shell/UserMenu';
import type { LocationRow, OrganizationRow } from '@/types/db';

/** Desktop shell: persistent left sidebar + top context bar around the page. */
export function AppShell({
  user,
  org,
  locations,
  children,
}: {
  user: SessionUser;
  org: OrganizationRow | null;
  locations: LocationRow[];
  children: ReactNode;
}) {
  return (
    <OrgProvider org={org} locations={locations}>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </OrgProvider>
  );
}
