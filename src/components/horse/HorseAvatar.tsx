import { HorseIcon } from '@/components/icons/HorseIcon';

/**
 * Avatar for horse list/overview rows: renders the horse photo when one is set,
 * otherwise the neutral HorseIcon placeholder. Kept in one place so the
 * management list and the dashboard cards render the photo identically.
 */
export function HorseAvatar({
  photoUrl,
  name,
}: {
  photoUrl: string | null;
  name: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className="h-9 w-9 shrink-0 rounded-full border border-line bg-surface-muted object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
      <HorseIcon size={18} />
    </span>
  );
}
