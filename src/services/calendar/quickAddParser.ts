/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit 16f41a2, do not edit here.
 *
 * Source: horsepowr/src/services/calendar/quickAddParser.ts
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

import type { CalendarEventType } from '@/types/calendar';

/**
 * "hoefsmid Bella dinsdag 9u" -> farrier, horse Bella, next Tuesday 09:00.
 * "interval Milano elke ma/do 8:30" -> training, Milano, weekly on Mon+Thu.
 * "dierenarts Luna 12 dec 10:30 60 min" -> vet, Luna, 12 Dec, 10:30, 60 min.
 *
 * PURE and mirrored to the web. Dutch and English keywords. It never guesses
 * silently: anything it recognised is returned field by field, and the form
 * opens pre-filled so the person confirms. Unrecognised words stay in the
 * title, so nothing typed is lost.
 */

export interface QuickAddResult {
  type: CalendarEventType | null;
  title: string;
  horseId: string | null;
  /** YYYY-MM-DD */
  dayKey: string | null;
  /** HH:MM */
  time: string | null;
  durationMin: number | null;
  /** RRULE when a repeat was typed. */
  recurrenceRule: string | null;
}

const TYPE_WORDS: Array<[RegExp, CalendarEventType]> = [
  [/^(hoefsmid|smid|farrier|beslaan|bekappen)$/i, 'farrier'],
  [/^(dierenarts|da|vet|vaccinatie|vaccination|enting)$/i, 'vet'],
  [/^(fysio|physio|fysiotherapie|osteopaat)$/i, 'physio'],
  [/^(wedstrijd|concours|competition|show|proef)$/i, 'competition'],
  [/^(training|interval|intervaltraining|dressuur|dressage|springen|jumping|cross|conditie|duurrit|buitenrit|longeren)$/i, 'training'],
];

const WEEKDAYS: Array<[RegExp, number]> = [
  [/^(ma|maandag|mon|monday)$/i, 1],
  [/^(di|dinsdag|tue|tues|tuesday)$/i, 2],
  [/^(wo|woensdag|wed|wednesday)$/i, 3],
  [/^(do|donderdag|thu|thur|thursday)$/i, 4],
  [/^(vr|vrijdag|fri|friday)$/i, 5],
  [/^(za|zaterdag|sat|saturday)$/i, 6],
  [/^(zo|zondag|sun|sunday)$/i, 7],
];
const BYDAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const MONTHS: Array<[RegExp, number]> = [
  [/^jan/i, 1], [/^feb/i, 2], [/^(mrt|maa|mar)/i, 3], [/^apr/i, 4], [/^(mei|may)/i, 5], [/^jun/i, 6],
  [/^jul/i, 7], [/^aug/i, 8], [/^sep/i, 9], [/^(okt|oct)/i, 10], [/^nov/i, 11], [/^dec/i, 12],
];

function weekdayOf(word: string): number | null {
  for (const [re, n] of WEEKDAYS) if (re.test(word)) return n;
  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function addDays(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoWeekday(dayKey: string): number {
  return ((new Date(`${dayKey}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/** Next occurrence of a weekday, today counting when it matches. */
function nextWeekday(todayKey: string, weekday: number): string {
  const diff = (weekday - isoWeekday(todayKey) + 7) % 7;
  return addDays(todayKey, diff);
}

function normaliseHorse(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function parseQuickAdd(
  input: string,
  ctx: { todayKey: string; horses: ReadonlyArray<{ id: string; name: string }> },
): QuickAddResult {
  const result: QuickAddResult = {
    type: null, title: '', horseId: null, dayKey: null, time: null, durationMin: null, recurrenceRule: null,
  };
  let text = ` ${input.trim()} `;

  // Horse: the longest horse name contained in the text wins ("Zephyr van de Rith").
  const folded = normaliseHorse(text);
  const horse = [...ctx.horses]
    .sort((a, b) => b.name.length - a.name.length)
    .find((h) => {
      const n = normaliseHorse(h.name);
      return n.length > 1 && new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(folded);
    });
  if (horse) {
    result.horseId = horse.id;
    const at = folded.indexOf(normaliseHorse(horse.name));
    text = text.slice(0, at) + ' ' + text.slice(at + horse.name.length);
  }

  // Repeat: "elke ma/do", "every mon,thu", "elke 6 weken", "every 10 days", "wekelijks".
  text = text.replace(/\b(elke|iedere|every)\s+(\d{1,3})\s+(dagen|dag|days|day|weken|week|weeks)\b/i, (_m, _e, n, unit) => {
    const daily = /^d/i.test(unit);
    result.recurrenceRule = `FREQ=${daily ? 'DAILY' : 'WEEKLY'}${Number(n) > 1 ? `;INTERVAL=${Number(n)}` : ''}`;
    return ' ';
  });
  text = text.replace(/\b(elke|iedere|every)\s+([a-z]{2,9}(?:\s*[/,&+]\s*[a-z]{2,9}|\s+(?:en|and)\s+[a-z]{2,9})*)/i, (m, _e, list: string) => {
    const days = list.split(/\s*(?:[/,&+]|\ben\b|\band\b)\s*/i).map(weekdayOf);
    if (days.length === 0 || days.some((d) => d === null)) return m;
    const unique = [...new Set(days as number[])].sort();
    result.recurrenceRule = `FREQ=WEEKLY;BYDAY=${unique.map((d) => BYDAY[d]).join(',')}`;
    // The series starts on the soonest of its days, today included.
    if (result.dayKey === null) result.dayKey = unique.map((d) => nextWeekday(ctx.todayKey, d)).sort()[0] ?? null;
    return ' ';
  });
  text = text.replace(/\b(dagelijks|daily|elke dag|every day)\b/i, () => {
    result.recurrenceRule = 'FREQ=DAILY';
    return ' ';
  });
  text = text.replace(/\b(wekelijks|weekly)\b/i, () => {
    result.recurrenceRule = 'FREQ=WEEKLY';
    return ' ';
  });

  // Duration: "60 min", "1,5 uur", "90m", "2h".
  text = text.replace(/\b(\d{1,3}(?:[.,]\d)?)\s*(min|minuten|minutes|m|uur|u\b|h|hours?)\b/i, (m, n, unit) => {
    const value = Number(String(n).replace(',', '.'));
    const minutes = /^(uur|u|h|hour|hours)$/i.test(unit) ? Math.round(value * 60) : Math.round(value);
    // "9u" with no space directly before a weekday-free context is a TIME, not 9 hours.
    if (/^(u|h)$/i.test(unit) && value <= 23 && Number.isInteger(value) && !/\s/.test(m.replace(/\d/g, ''))) {
      result.time = `${pad(value)}:00`;
      return ' ';
    }
    result.durationMin = minutes;
    return ' ';
  });

  // Time: "9:30", "09.30", "om 14 uur" handled above, "14u15".
  text = text.replace(/\b(?:om\s+|at\s+)?([01]?\d|2[0-3])[:.u]([0-5]\d)\b/i, (_m, h, mi) => {
    result.time = `${pad(Number(h))}:${mi}`;
    return ' ';
  });

  // Date: vandaag/morgen/overmorgen, weekday, "12 dec", "12-12", "2026-12-12".
  text = text.replace(/\b(vandaag|today)\b/i, () => ((result.dayKey = ctx.todayKey), ' '));
  text = text.replace(/\b(overmorgen)\b/i, () => ((result.dayKey = addDays(ctx.todayKey, 2)), ' '));
  text = text.replace(/\b(morgen|tomorrow)\b/i, () => ((result.dayKey = addDays(ctx.todayKey, 1)), ' '));
  text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/, (_m, y, mo, d) => ((result.dayKey = `${y}-${mo}-${d}`), ' '));
  text = text.replace(/\b(\d{1,2})\s+([a-z]{3,9})\.?\b/i, (m, d, mon) => {
    const month = MONTHS.find(([re]) => re.test(mon))?.[1];
    if (month === undefined) return m;
    const year = Number(ctx.todayKey.slice(0, 4));
    let key = `${year}-${pad(month)}-${pad(Number(d))}`;
    if (key < ctx.todayKey) key = `${year + 1}-${pad(month)}-${pad(Number(d))}`;
    result.dayKey = key;
    return ' ';
  });
  text = text.replace(/\b(\d{1,2})[-/](\d{1,2})\b/, (_m, d, mo) => {
    const year = Number(ctx.todayKey.slice(0, 4));
    let key = `${year}-${pad(Number(mo))}-${pad(Number(d))}`;
    if (key < ctx.todayKey) key = `${year + 1}-${pad(Number(mo))}-${pad(Number(d))}`;
    result.dayKey = key;
    return ' ';
  });

  // Remaining words: a weekday sets the day; a type word sets the type; the
  // rest is the title (type words also stay in the title, they read well).
  const words = text.split(/\s+/).filter((w) => w.length > 0 && !/^(om|at|op|on)$/i.test(w));
  const kept: string[] = [];
  for (const word of words) {
    const wd = weekdayOf(word);
    if (wd !== null && result.dayKey === null) {
      result.dayKey = nextWeekday(ctx.todayKey, wd);
      continue;
    }
    if (result.type === null) {
      const hit = TYPE_WORDS.find(([re]) => re.test(word));
      if (hit) result.type = hit[1];
    }
    kept.push(word);
  }
  const title = kept.join(' ').trim();
  result.title = title.length > 0 ? title.charAt(0).toUpperCase() + title.slice(1) : '';
  return result;
}
