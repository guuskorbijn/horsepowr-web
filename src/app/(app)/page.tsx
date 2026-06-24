import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';

export default function CommandCenterPage() {
  return (
    <>
      <PageHeader
        title="Command center"
        description="Your stable at a glance — horses by location with their latest session."
      />
      <EmptyState
        icon={<LayoutDashboard size={28} />}
        title="The command center lands here"
        description="Once data loads, you'll see every horse grouped by location with its last session summary."
      />
    </>
  );
}
