import { SkeletonCardGrid } from '@/components/ui/states';

/** Streamed while the command center resolves. Same shape as what follows. */
export default function CommandCenterLoading() {
  return (
    <>
      <div className="mb-8 h-20" />
      <SkeletonCardGrid count={6} />
    </>
  );
}
