import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AppShell } from '@/components/shell/AppShell';
import { EmptyState } from '@/components/ui/states';
import { requireSessionContext } from '@/lib/session';

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSessionContext();
  const user = {
    name: ctx.profile.name ?? ctx.email,
    email: ctx.email,
    role: ctx.role,
  };

  return (
    <AppShell user={user} org={ctx.org} locations={ctx.locations}>
      {ctx.org ? (
        children
      ) : (
        <EmptyState
          icon={<ShieldAlert size={28} />}
          title="No organization yet"
          description="Your account isn't linked to a stable yet. Ask an admin to add you to an organization, then refresh."
        />
      )}
    </AppShell>
  );
}
