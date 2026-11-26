/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit 3166118, do not edit here.
 *
 * Source: horsepowr/src/services/health/healthReminders.ts
 *
 * CLAUDE.md forbids importing the RN repo as a build dependency, and Vercel
 * builds this repo alone, so shared domain logic is copied rather than linked.
 * The copy is deliberate and checked: `npm run check:mirror` fails when this
 * file and its source have drifted, so the duplication is visible instead of
 * silent. Fix a bug in the mobile repo and re-run the mirror; never patch here.
 *
 * These modules are PURE on purpose — that is what makes them safe to mirror.
 * Anything touching Supabase, storage or React stays on its own side.
 */

/**
 * Which health records need attention because their validity runs out.
 *
 * PURE, and mirrored to the web, so the phone's Today screen and the web
 * dashboard list exactly the same vaccinations. It reports dates and day
 * counts only — "expires in 9 days" — never a health statement: whether a
 * horse needs a vaccination is the vet's call, not the software's.
 *
 * A record counts once per horse and kind: when a newer vaccination of the
 * same title supersedes an older one, only the newest is considered, so
 * renewing a vaccination makes its reminder disappear without anyone having
 * to delete the old entry.
 */

export interface ExpiringRecordInput {
  id: string;
  horse_id: string;
  kind: string;
  title: string;
  /** YYYY-MM-DD */
  occurred_on: string;
  /** YYYY-MM-DD, or null when the record does not expire. */
  valid_until: string | null;
}

export type ReminderState = 'expired' | 'due-soon';

export interface HealthReminder {
  recordId: string;
  horseId: string;
  kind: string;
  title: string;
  validUntil: string;
  /** Whole days from `todayKey` to `validUntil`; negative once expired. */
  daysLeft: number;
  state: ReminderState;
}

/** How far ahead a reminder appears. */
export const REMINDER_WINDOW_DAYS = 30;
/** How long an expired record keeps being shown before it is assumed handled. */
export const EXPIRED_GRACE_DAYS = 60;

function dayNumber(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

function seriesKey(r: ExpiringRecordInput): string {
  return `${r.horse_id}|${r.kind}|${r.title.trim().toLowerCase()}`;
}

export function expiringRecords(
  records: readonly ExpiringRecordInput[],
  todayKey: string,
  windowDays: number = REMINDER_WINDOW_DAYS,
): HealthReminder[] {
  const today = dayNumber(todayKey);
  if (today === null) return [];

  // Newest record per series wins.
  const latest = new Map<string, ExpiringRecordInput>();
  for (const record of records) {
    const key = seriesKey(record);
    const current = latest.get(key);
    if (current === undefined || record.occurred_on > current.occurred_on) latest.set(key, record);
  }

  const out: HealthReminder[] = [];
  for (const record of latest.values()) {
    if (record.valid_until === null) continue;
    const until = dayNumber(record.valid_until);
    if (until === null) continue;
    const daysLeft = until - today;
    if (daysLeft > windowDays || daysLeft < -EXPIRED_GRACE_DAYS) continue;
    out.push({
      recordId: record.id,
      horseId: record.horse_id,
      kind: record.kind,
      title: record.title,
      validUntil: record.valid_until,
      daysLeft,
      state: daysLeft < 0 ? 'expired' : 'due-soon',
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title));
}
