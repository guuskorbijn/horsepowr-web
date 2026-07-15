import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, EmptyState } from '@/components/ui/states';
import { HorseIcon } from '@/components/icons/HorseIcon';
import { ManagementView } from '@/components/manage/ManagementView';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listHorses } from '@/data/horseRepository';
import { listLocations } from '@/data/orgRepository';
import type { HorseRow, LocationRow, UserRole } from '@/types/db';

type LoadResult =
  | {
      status: 'ok';
      orgId: string;
      orgLogoUrl: string | null;
      horses: HorseRow[];
      locations: LocationRow[];
      canManage: boolean;
      user: { name: string; email: string; role: UserRole };
    }
  | { status: 'no-org' }
  | { status: 'error' };

async function load(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const [horses, locations] = await Promise.all([
      listHorses(supa, ctx.org.id),
      listLocations(supa, ctx.org.id),
    ]);
    return {
      status: 'ok',
      orgId: ctx.org.id,
      orgLogoUrl: ctx.org.logo_url,
      horses,
      locations,
      canManage: ctx.capabilities.canManage,
      user: { name: ctx.profile.name ?? ctx.email, email: ctx.email, role: ctx.role },
    };
  } catch {
    return { status: 'error' };
  }
}

export default async function HorsesPage() {
  const result = await load();

  return (
    <>
      <PageHeader title="Horses" description="Manage horses and locations, and view your team." />
      {result.status === 'error' ? (
        <ErrorState description="Could not load management data. Try again." />
      ) : result.status === 'no-org' ? (
        <EmptyState icon={<HorseIcon size={28} />} title="No organization yet" />
      ) : (
        <ManagementView
          orgId={result.orgId}
          orgLogoUrl={result.orgLogoUrl}
          initialHorses={result.horses}
          initialLocations={result.locations}
          canManage={result.canManage}
          currentUser={result.user}
        />
      )}
    </>
  );
}
