import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonPanels } from '@/components/ui/states';

/**
 * Streamed while this route's server component resolves.
 *
 * Every route has one of these. Ten of the twelve did not, which meant
 * navigating to them held the last page on screen and then swapped it whole —
 * the single thing that made the app feel like separate pages rather than one.
 * The copy is deliberately not localised: this renders for a few hundred
 * milliseconds, and reading the locale cookie here would mean doing async work
 * inside the thing that exists to avoid a wait.
 */
export default function HorseDetailLoading() {
  return (
    <>
      <PageHeader title="Horse" />
      <SkeletonPanels count={2} tiles />
    </>
  );
}
