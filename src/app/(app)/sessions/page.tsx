import { Activity } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';

export default function SessionsPage() {
  return (
    <>
      <PageHeader
        title="Sessions"
        description="Every recorded session, newest first. Open one for the deep view."
      />
      <EmptyState
        icon={<Activity size={28} />}
        title="Sessions will appear here"
        description="Recorded on the mobile app and synced to Supabase — this view reads them."
      />
    </>
  );
}
