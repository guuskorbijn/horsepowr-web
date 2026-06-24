import { GitCompareArrows } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';

export default function ComparePage() {
  return (
    <>
      <PageHeader
        title="Compare"
        description="Overlay two or more sessions of the same horse on a shared elapsed-time axis."
      />
      <EmptyState
        icon={<GitCompareArrows size={28} />}
        title="Pick sessions to compare"
        description="Comparison overlays HR, speed and altitude so you can read change over time."
      />
    </>
  );
}
