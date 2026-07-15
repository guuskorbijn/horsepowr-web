/**
 * Age helpers — age is always DERIVED from a date of birth, never stored.
 * Mirrors the RN app's src/utils/age.ts so both clients read DOB identically.
 */

/**
 * Whole years between a date of birth and a reference date (default: now).
 * Returns null for missing/invalid/future dates.
 */
export function deriveAgeYears(
  dateOfBirth: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  if (dob.getTime() > now.getTime()) return null;

  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    years -= 1;
  }
  return years < 0 ? null : years;
}

/** Human label for a derived age, e.g. "12 yr" — or null when unknown. */
export function formatAge(
  dateOfBirth: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const years = deriveAgeYears(dateOfBirth, now);
  if (years === null) return null;
  return years === 1 ? '1 yr' : `${years} yr`;
}
