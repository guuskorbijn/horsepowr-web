import { PageHeader } from '@/components/ui/PageHeader';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireSessionContext } from '@/lib/session';
import { listHorses } from '@/data/horseRepository';
import { getServerT } from '@/i18n/server';
import { AnalystChat } from '@/components/analyst/AnalystChat';

/**
 * Analyst chat route. Authenticated like every other app page (the (app) layout's
 * requireSessionContext redirects logged-out users to /login). The chat itself is
 * a client component talking to POST /api/analyst/chat — this server component only
 * loads one horse name so the example questions are real, and renders the header.
 */
async function firstHorseName(): Promise<string | undefined> {
  const ctx = await requireSessionContext();
  if (!ctx.org) return undefined;
  try {
    const supa = await getServerSupabase();
    const horses = await listHorses(supa, ctx.org.id, { activeOnly: true });
    return horses[0]?.name;
  } catch {
    return undefined;
  }
}

export default async function AnalystPage() {
  const [name, t] = await Promise.all([firstHorseName(), getServerT()]);

  return (
    <>
      <PageHeader title={t('analystPage.title')} description={t('analystPage.description')} />
      <AnalystChat firstHorseName={name} />
    </>
  );
}
