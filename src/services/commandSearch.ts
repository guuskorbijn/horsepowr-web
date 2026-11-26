/**
 * Ranking for the ⌘K palette. PURE: label prefix beats word start beats
 * contains; keywords count a little less than the label; ties keep input
 * order (so actions stay above pages above horses). Accent-insensitive.
 */
export interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function score(text: string, q: string): number {
  if (text.startsWith(q)) return 100;
  if (text.split(/[\s→/-]+/).some((w) => w.startsWith(q))) return 70;
  if (text.includes(q)) return 40;
  return 0;
}

export function rankCommands<T extends Command>(items: readonly T[], query: string, limit = 30): T[] {
  const q = fold(query.trim());
  if (q === '') return items.slice(0, limit);
  return items
    .map((item, index) => ({
      item,
      index,
      s: Math.max(score(fold(item.label), q), score(fold(item.keywords ?? ''), q) * 0.8),
    }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.item);
}
