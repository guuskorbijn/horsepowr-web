import { TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';

export default function TrendsPage() {
  return (
    <>
      <PageHeader
        title="Trends"
        description="Descriptive trends over time — the measured numbers, plotted. No grades, no baselines."
      />
      <EmptyState
        icon={<TrendingUp size={28} />}
        title="Trends will plot here"
        description="Per-horse avg HR, avg speed, distance and duration across sessions, and cross-horse comparison within a location."
      />
    </>
  );
}
