/**
 * Item 9 (Starters): the pure side of the top section's filters. Tags = the comma parts that
 * recur most across the loaded prompts (weights and brackets stripped, boilerplate quality tags
 * left out); a picture passes when its prompt has every picked tag, matches the search words and
 * has the picked shape. Tested in node (`tests/starters.test.cjs`).
 */

export type Shape = 'any' | 'portrait' | 'landscape' | 'square';

/** Boilerplate every prompt has: not worth a tag. */
const BORING = /^(masterpiece|best quality|high quality|highest quality|amazing quality|very aesthetic|absurdres|highres|ultra detailed|highly detailed|detailed|8k|4k|uhd|hdr|newest|recent|score_\d.*|source_\w+|rating_\w+|safe|general|sensitive|questionable|explicit|break|embedding:.*|<lora:.*)$/;

/** A prompt's comma parts, plain: "(Neon Rain:1.2)" → "neon rain". */
export function promptTags(prompt: string): string[] {
  const out: string[] = [];
  for (const raw of prompt.split(/[,\n]+/)) {
    const t = raw
      .replace(/<[^>]*>/g, ' ')
      .replace(/:\s*-?\d*\.?\d+\s*\)?/g, '')
      .replace(/[()[\]{}]/g, '')
      .replace(/\\/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!t || t.length > 32 || t.split(' ').length > 4 || BORING.test(t)) continue;
    out.push(t);
  }
  return out;
}

/** The tags that recur in at least two prompts, most frequent first (ties: alphabetical). */
export function topTags(prompts: string[], max = 18): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of prompts) for (const t of new Set(promptTags(p))) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([tag, count]) => ({ tag, count }));
}

export function shapeOf(w: number, h: number): Exclude<Shape, 'any'> {
  if (!w || !h) return 'square';
  const r = w / h;
  return r > 1.1 ? 'landscape' : r < 0.9 ? 'portrait' : 'square';
}

/** Does a picture pass the filters? */
export function passes(p: { prompt: string; width?: number; height?: number }, f: { tags: string[]; query: string; shape: Shape }): boolean {
  if (f.shape !== 'any' && shapeOf(p.width ?? 0, p.height ?? 0) !== f.shape) return false;
  if (f.tags.length) {
    const have = new Set(promptTags(p.prompt));
    if (!f.tags.every((t) => have.has(t))) return false;
  }
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    const hay = p.prompt.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return false;
  }
  return true;
}
