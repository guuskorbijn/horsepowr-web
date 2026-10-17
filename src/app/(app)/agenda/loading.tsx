import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonWeek } from '@/components/ui/states';

/**
 * Next.js streams this while the agenda's server component resolves.
 *
 * It mirrors the real page's header and grid, so the route does not flash an
 * empty frame before settling. The copy is intentionally not localised: this
 * renders for a few hundred milliseconds and reading the locale cookie here
 * would mean doing async work in the thing that exists to avoid a wait.
 */
export default function AgendaLoading() {
  return (
    <>
      <PageHeader title="Agenda" />
      <div className="mb-4 h-10" />
      <SkeletonWeek />
    </>
  );
}
