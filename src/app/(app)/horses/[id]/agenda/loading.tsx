import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonTable } from '@/components/ui/states';

/** Streamed while the horse's agenda resolves (copy not localised; see dossier/loading). */
export default function HorseAgendaLoading() {
  return (
    <>
      <PageHeader title="Agenda" />
      <SkeletonTable rows={6} cols={7} />
    </>
  );
}
