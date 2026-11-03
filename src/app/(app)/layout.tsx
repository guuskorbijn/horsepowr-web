import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AppShell } from '@/components/shell/AppShell';
import { TimeZoneSync } from '@/components/shell/TimeZoneSync';
import { ReaderTimeZoneProvider } from '@/lib/readerTimeZoneContext';
import { getReaderTimeZone } from '@/lib/readerTimeZone.server';
import { EmptyState } from '@/components/ui/states';
import { requireSessionContext } from '@/lib/session';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { getServerLocale } from '@/i18n/server';

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const [ctx, locale, reader] = await Promise.all([
    requireSessionContext(),
    getServerLocale(),
    getReaderTimeZone(),
  ]);
  const user = {
    name: ctx.profile.name ?? ctx.email,
    email: ctx.email,
    role: ctx.role,
  };

  return (
    <LocaleProvider initialLocale={locale}>
      <ReaderTimeZoneProvider timeZone={reader.timeZone}>
        <TimeZoneSync />
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
      </ReaderTimeZoneProvider>
    </LocaleProvider>
  );
}
