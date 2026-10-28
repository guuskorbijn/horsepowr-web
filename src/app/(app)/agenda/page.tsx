import { PageHeader } from '@/components/ui/PageHeader';
import { AgendaScreen } from '@/components/agenda/AgendaScreen';
import { getServerT } from '@/i18n/server';
import { parseAgendaQuery, type SearchParamValue } from '@/services/calendar/agendaQuery';

/**
 * The stable's agenda, a day or a week at a time, filterable by horse and by
 * the person an item is assigned to. All state is in the URL.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const [params, t] = await Promise.all([searchParams, getServerT()]);
  return (
    <>
      <PageHeader title={t('agenda.title')} description={t('agenda.description')} />
      <AgendaScreen basePath="/agenda" query={parseAgendaQuery(params)} lockedHorse={false} />
    </>
  );
}
