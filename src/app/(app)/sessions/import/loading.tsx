import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonPanels } from '@/components/ui/states';

/** Streamed while the import page resolves (copy not localised; see dossier/loading). */
export default function ImportLoading() {
  return (
    <>
      <PageHeader title="Import a ride" />
      <SkeletonPanels />
    </>
  );
}
