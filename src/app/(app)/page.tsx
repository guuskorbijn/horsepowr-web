import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getHorsesWithLastSession } from '@/services/sessionListService';
import { CommandCenter } from '@/components/command/CommandCenter';
import { getServerT } from '@/i18n/server';
import type { HorseLastSession } from '@/types/view';

type LoadResult =
  | { status: 'ok'; horses: HorseLastSession[] }
  | { status: 'error' }
  | { status: 'no-org' };

async function load(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const horses = await getHorsesWithLastSession(supa, ctx.org.id);
    return { status: 'ok', horses };
  } catch {
    return { status: 'error' };
  }
}

export default async function CommandCenterPage() {
  const [result, t] = await Promise.all([load(), getServerT()]);

  return (
    <>
      <PageHeader title={t('command.title')} description={t('command.description')} />
      {result.status === 'error' ? (
        <ErrorState description={t('command.errorLoad')} />
      ) : result.status === 'no-org' || result.horses.length === 0 ? (
        <EmptyState
          icon={<LayoutDashboard size={28} />}
          title={t('command.emptyTitle')}
          description={t('command.emptyDescription')}
        />
      ) : (
        <CommandCenter horses={result.horses} />
      )}
    </>
  );
}
