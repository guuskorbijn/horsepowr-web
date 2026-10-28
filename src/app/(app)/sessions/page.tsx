import Link from 'next/link';
import { Activity, FileUp } from 'lucide-react';
import { log } from '@/lib/log';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { getOrgSessions } from '@/services/sessionListService';
import { SessionsList } from '@/components/sessions/SessionsList';
import { getServerT } from '@/i18n/server';
import type { SessionWithHorse } from '@/types/view';

type LoadResult =
  | { status: 'ok'; sessions: SessionWithHorse[]; canImport: boolean }
  | { status: 'error' }
  | { status: 'no-org' };

async function loadSessions(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return { status: 'no-org' };
  try {
    const supa = await getServerSupabase();
    const sessions = await getOrgSessions(supa, ctx.org.id, { finishedOnly: false });
    return { status: 'ok', sessions, canImport: ctx.capabilities.canImport };
  } catch (err: unknown) {
    log.error('sessions: could not load', { error: err instanceof Error ? err.message : String(err) });
    return { status: 'error' };
  }
}

export default async function SessionsPage() {
  const [result, t] = await Promise.all([loadSessions(), getServerT()]);

  return (
    <>
      <PageHeader
        title={t('sessionsPage.title')}
        description={t('sessionsPage.description')}
        action={
          result.status === 'ok' && result.canImport ? (
            <Link
              href="/sessions/import"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line-strong px-3 text-[13px] font-medium text-text-primary hover:bg-surface-muted"
            >
              <FileUp size={15} />
              {t('import.button')}
            </Link>
          ) : null
        }
      />
      {result.status === 'error' ? (
        <ErrorState description={t('sessionsPage.errorLoad')} />
      ) : result.status === 'no-org' || result.sessions.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} />}
          title={t('sessionsPage.emptyTitle')}
          description={t('sessionsPage.emptyDescription')}
        />
      ) : (
        <SessionsList sessions={result.sessions} showFilters />
      )}
    </>
  );
}
