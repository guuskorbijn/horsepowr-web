import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AppShell } from '@/components/shell/AppShell';
import { EmptyState } from '@/components/ui/states';
import { requireSessionContext } from '@/lib/session';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { getServerLocale } from '@/i18n/server';

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const [ctx, locale] = await Promise.all([requireSessionContext(), getServerLocale()]);
  const user = {
    name: ctx.profile.name ?? ctx.email,
    email: ctx.email,
    role: ctx.role,
  };

  return (
    <LocaleProvider initialLocale={locale}>
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
    </LocaleProvider>
  );
}
