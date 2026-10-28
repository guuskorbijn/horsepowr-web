import Link from 'next/link';
import { ArrowLeft, FileUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { ImportFlow } from '@/components/import/ImportFlow';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listHorses } from '@/data/horseRepository';
import { getServerT } from '@/i18n/server';
import { log } from '@/lib/log';

type LoadResult =
  | { status: 'ok'; horses: Array<{ id: string; name: string; maxHr: number }> }
  | { status: 'read-only' }
  | { status: 'error' };

async function load(): Promise<LoadResult> {
  const ctx = await requireSessionContext();
  if (!ctx.org || !ctx.capabilities.canImport) return { status: 'read-only' };
  try {
    const horses = await listHorses(await getServerSupabase(), ctx.org.id);
    return { status: 'ok', horses: horses.map((h) => ({ id: h.id, name: h.name, maxHr: h.max_hr })) };
  } catch (err: unknown) {
    log.error('import: could not load horses', { error: err instanceof Error ? err.message : String(err) });
    return { status: 'error' };
  }
}

/**
 * Import a ride from a Polar Flow export (TCX, GPX, FIT). Trainer-only, the
 * same split RLS enforces on sessions and measurements.
 */
export default async function ImportPage() {
  const [result, t] = await Promise.all([load(), getServerT()]);
  return (
    <>
      <Link
        href="/sessions"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft size={15} /> {t('nav.sessions')}
      </Link>
      <PageHeader title={t('import.title')} description={t('import.description')} />
      {result.status === 'read-only' ? (
        <EmptyState icon={<FileUp size={28} />} title={t('import.title')} description={t('import.readOnly')} />
      ) : result.status === 'error' ? (
        <ErrorState description={t('sessionsPage.errorLoad')} />
      ) : (
        <ImportFlow horses={result.horses} />
      )}
    </>
  );
}
