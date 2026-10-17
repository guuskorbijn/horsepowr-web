import { LogoMark } from '@/components/brand/Logo';

/**
 * The dashboard's opening.
 *
 * The mark earns its place HERE and nowhere else in the product. On a phone
 * every screen is unambiguously this app, so the mobile build carries no logo
 * in any header; in a browser it is one tab among twenty, and the first thing
 * on the landing page is where that ambiguity is worth resolving.
 *
 * Sized and spaced to read as a masthead rather than a badge: the mark is large
 * enough to be the first thing seen, and the stable's own name sits above the
 * title so the page opens with WHOSE stable this is, not whose software.
 */
export function DashboardHero({
  title,
  description,
  orgName,
}: {
  title: string;
  description: string;
  orgName: string | null;
}) {
  return (
    <div className="mb-8 flex items-start gap-4">
      <LogoMark size={48} className="mt-0.5 shrink-0" />
      <div>
        {orgName ? (
          <p className="text-[13px] font-medium uppercase tracking-wide text-text-tertiary">
            {orgName}
          </p>
        ) : null}
        <h1 className="font-display text-[32px] font-semibold leading-9 text-text-primary">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-[15px] text-text-secondary">{description}</p>
      </div>
    </div>
  );
}
