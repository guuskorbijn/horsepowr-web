import { LogoMark } from '@/components/brand/Logo';

/**
 * The dashboard's opening.
 *
 * ONE place for a logo, and it is here. The org's own mark leads when the
 * stable has uploaded one, because the page should open with whose stable this
 * is rather than whose software; the HorsePowr mark stands in when it has not.
 * It used to float loose between the heading and the search box, which read as
 * a stray image rather than a masthead.
 *
 * The mobile app carries no logo in any header at all — on a phone every
 * screen is unambiguously this app. A browser tab is not, and this is the one
 * screen where resolving that is worth the space.
 */
export function DashboardHero({
  title,
  description,
  orgName,
  orgLogoUrl,
}: {
  title: string;
  description: string;
  orgName: string | null;
  orgLogoUrl: string | null;
}) {
  return (
    <div className="mb-8 flex items-center gap-5">
      {orgLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={orgLogoUrl}
          alt={orgName ? `${orgName} logo` : 'Stable logo'}
          className="h-14 w-14 shrink-0 rounded-xl object-contain"
        />
      ) : (
        <LogoMark size={56} className="shrink-0" />
      )}
      <div className="min-w-0">
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
