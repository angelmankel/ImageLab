/**
 * Quick search ("spotlight") matching and ranking. Pure: the node tests run this file in a bare
 * `vm` context, so it may only have type imports.
 *
 * Every word of the query must appear somewhere in an item (its label, group or keywords), in any
 * order. Matches in the label count most, a label that starts with the query most of all, then a
 * word in the label that starts with a query word; shorter labels win ties, and group order
 * breaks what is left.
 */

export type SpotlightItem = {
  id: string;
  group: string;
  label: string;
  /** A second line: what it does or where it goes. */
  description?: string;
  /** Extra words it should be found by (not shown). */
  keywords?: string;
  run: () => void;
};

export function spotlightScore(item: Pick<SpotlightItem, 'label' | 'group' | 'keywords' | 'description'>, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const label = item.label.toLowerCase();
  const hay = `${label} ${item.group.toLowerCase()} ${(item.keywords ?? '').toLowerCase()} ${(item.description ?? '').toLowerCase()}`;
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.every((w) => hay.includes(w))) return 0;
  let score = 10;
  if (label.startsWith(q)) score += 100;
  else if (label.includes(q)) score += 40;
  const labelWords = label.split(/[^a-z0-9]+/).filter(Boolean);
  for (const w of words) {
    if (labelWords.some((lw) => lw.startsWith(w))) score += 25;
    else if (label.includes(w)) score += 10;
  }
  return score - Math.min(label.length, 80) * 0.1;
}

/** The best `limit` matches, best first. An empty query keeps the given order. */
export function rankSpotlight<T extends SpotlightItem>(items: T[], query: string, groupOrder: string[] = [], limit = 60): T[] {
  const groupRank = (g: string) => { const i = groupOrder.indexOf(g); return i < 0 ? groupOrder.length : i; };
  return items
    .map((item, index) => ({ item, index, score: spotlightScore(item, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || groupRank(a.item.group) - groupRank(b.item.group) || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.item);
}
