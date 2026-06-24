import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/states';
import { HorseIcon } from '@/components/icons/HorseIcon';

export default function HorsesPage() {
  return (
    <>
      <PageHeader
        title="Horses"
        description="Manage horses and locations, and view your team."
      />
      <EmptyState
        icon={<HorseIcon size={28} />}
        title="Your horses will live here"
        description="Trainers can add and edit horses and locations from the big screen."
      />
    </>
  );
}
