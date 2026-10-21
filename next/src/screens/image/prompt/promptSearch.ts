/**
 * Items 12 + 13: finding tiles. Fuzzy match for the "/" picker and the grid's search box, the
 * Auto grid's "related to what you typed" ranking (words in the prompt that no tile put there,
 * plus `RELATED_WORDS`), the tile name cap and the tile colours (category hue + a per-tile shift,
 * until tiles get real art). No model-specific entries (Pony, Illustrious…) anywhere: `isModelSpecific`.
 * Pure, tested in node (`tests/smartPrompt.test.cjs`).
 */
import { RELATED_WORDS } from './relatedWords';

export interface TileSnippet { id: string; name: string; text: string; categoryId: string; kind: string; layers?: Array<{ kind: string; text: string }> }

/** Model-specific categories and ids: they are a model's tags, not a look (Donny, items 10 + 12). */
const MODEL_CATS = new Set(['pony', 'illustrious', 'noobai', 'noob']);
export function isModelSpecific(s: { id: string; categoryId: string }): boolean {
  return MODEL_CATS.has(s.categoryId) || /^(pony|ill)-/.test(s.id);
}

/** A tile name that fits two short lines: cut at a word with "…" past `max` characters. */
export function tileName(name: string, max = 18): string {
  const n = name.trim();
  if (n.length <= max) return n;
  const cut = n.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[\s·,&-]+$/, '')}…`;
}

const CAT_HUE: Record<string, number> = {
  style: 265, quality: 45, lighting: 32, color: 320, camera: 200, framing: 220, pose: 160, expression: 345,
  outfit: 290, setting: 125, weather: 205, atmosphere: 280, detail: 20,
  'neg-quality': 355, 'neg-anatomy': 5, 'neg-unwanted': 345,
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Item 42: colours picked for categories (Manage → swatches). Kept in step by `useTiles`. */
const CUSTOM_HUE = new Map<string, number>();
export function setCategoryHues(cats: ReadonlyArray<{ id: string; hue?: number }>): void {
  CUSTOM_HUE.clear();
  for (const c of cats) if (typeof c.hue === 'number') CUSTOM_HUE.set(c.id, c.hue);
}

/** A category's own hue (its picked colour, else the built-in one). */
export function categoryHue(categoryId: string): number {
  return CUSTOM_HUE.get(categoryId) ?? CAT_HUE[categoryId] ?? hash(categoryId) % 360;
}

/** The tile's hue: its category's, shifted a little per tile so neighbours differ. */
export function tileHue(s: { id: string; categoryId: string }): number {
  const base = categoryHue(s.categoryId);
  return (base + (hash(s.id) % 31) - 15 + 360) % 360;
}

/** The tile's picture until it has art: a lit gradient in its hue. */
export function tileBackground(hue: number): string {
  return `radial-gradient(120% 80% at 20% 10%, rgba(255,255,255,.14), transparent 55%), linear-gradient(150deg, hsl(${hue} 38% 34%), hsl(${(hue + 28) % 360} 32% 15%))`;
}

/**
 * Fuzzy match: the query's letters in order. Higher is better: a substring beats a scatter, a
 * match at a word start beats one inside a word, earlier beats later. Null = no match.
 * `hits` = the matched character indexes (for highlighting).
 */
export function fuzzy(query: string, target: string): { score: number; hits: number[] } | null {
  const q = query.toLowerCase().trim();
  if (!q) return { score: 0, hits: [] };
  const t = target.toLowerCase();
  const at = t.indexOf(q);
  if (at >= 0) {
    const wordStart = at === 0 || /[\s,·&(-]/.test(t[at - 1]);
    return { score: 1000 - at + (wordStart ? 200 : 0) + (at === 0 ? 100 : 0), hits: Array.from({ length: q.length }, (_, i) => at + i) };
  }
  const hits: number[] = [];
  let score = 0;
  let ti = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const i = t.indexOf(ch, ti);
    if (i < 0) return null;
    const prev = hits[hits.length - 1];
    score += prev === i - 1 ? 8 : 1;
    if (i === 0 || /[\s,·&(-]/.test(t[i - 1])) score += 6;
    hits.push(i);
    ti = i + 1;
  }
  return { score: score - hits[0] * 0.1, hits };
}

/** Rank snippets for a query (name counts double their text). Empty query → as given. */
export function searchTiles<S extends TileSnippet>(snippets: S[], query: string): S[] {
  if (!query.trim()) return snippets;
  const scored: Array<{ s: S; score: number }> = [];
  for (const s of snippets) {
    const n = fuzzy(query, s.name);
    const t = fuzzy(query, s.text);
    const score = Math.max(n ? n.score * 2 : -1, t ? t.score : -1);
    if (score >= 0) scored.push({ s, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.s);
}

const STOP = new Set(['the', 'and', 'with', 'for', 'from', 'into', 'onto', 'over', 'under', 'very', 'this', 'that', 'his', 'her', 'their', 'its', 'are', 'was', 'has', 'have', 'lone', 'one', 'two', 'some', 'very', 'best', 'high', 'detailed', 'quality', 'masterpiece']);

/**
 * A word's plain form, used on BOTH sides of a match (so it only has to be consistent, not a real
 * lemma): flooded → flood, running → run, cities → city, cats → cat, rainy → rain.
 */
export function stem(w: string): string {
  let r = w;
  if (r.length > 4 && r.endsWith('ies')) return `${r.slice(0, -3)}y`;
  if (r.length > 5 && r.endsWith('ing')) r = r.slice(0, -3);
  else if (r.length > 5 && r.endsWith('ed')) r = r.slice(0, -2);
  else if (r.length > 3 && r.endsWith('s') && !r.endsWith('ss')) return r.slice(0, -1);
  else if (r.length > 4 && r.endsWith('y') && !r.endsWith('ey')) return r.slice(0, -1);
  // runn(ing) → run, stopp(ed) → stop
  if (r !== w && r.length > 3 && r[r.length - 1] === r[r.length - 2] && !/[aeiouls]/.test(r[r.length - 1])) r = r.slice(0, -1);
  return r;
}

/**
 * The prompt's words for matching (item 46): whole words only. Tokens with digits or underscores
 * (LoRA trigger tags like `s1_dram`, `4ur4_illu`, sizes like `8k`) are not words and are skipped,
 * so they never turn into junk stems.
 */
export function wordsOf(text: string): string[] {
  const toks = text.toLowerCase().split(/[^a-z0-9_'-]+/);
  const out: string[] = [];
  for (const raw of toks) {
    for (const t of raw.split(/-/)) {
      const w = t.replace(/^'+|'+$/g, '');
      if (w.length < 3 || /[\d_']/.test(w) || STOP.has(w)) continue;
      out.push(stem(w));
    }
  }
  return out;
}

/**
 * The Auto grid: tiles related to the words typed in the prompt, best first, with the words that
 * found something. `typed` = the prompt text without the parts tiles put there.
 */
export function relatedTiles<S extends TileSnippet>(snippets: S[], typed: string, categoryNames: Record<string, string> = {}): { tiles: S[]; words: string[] } {
  const words = Array.from(new Set(wordsOf(typed)));
  if (!words.length) return { tiles: [], words: [] };
  const used = new Set<string>();
  const scored: Array<{ s: S; score: number; i: number }> = [];
  snippets.forEach((s, i) => {
    const name = new Set(wordsOf(s.name));
    const body = new Set([...wordsOf(s.text), ...wordsOf(categoryNames[s.categoryId] ?? '')]);
    let score = 0;
    for (const w of words) {
      let hit = 0;
      if (name.has(w)) hit += 4;
      if (body.has(w)) hit += 2;
      if (!hit && w.length >= 5) for (const t of [...name, ...body]) if (t.length >= 5 && (t.startsWith(w) || w.startsWith(t))) { hit += 1; break; }
      let rel = 0;
      for (const r of RELATED_WORDS[w] ?? []) {
        const rs = stem(r);
        if (name.has(rs)) rel += 2; else if (body.has(rs)) rel += 1;
      }
      hit += Math.min(2, rel);
      if (hit) used.add(w);
      score += hit;
    }
    if (score > 0) scored.push({ s, score, i });
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return { tiles: scored.map((x) => x.s), words: words.filter((w) => used.has(w)) };
}
