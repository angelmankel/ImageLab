/**
 * Settings, the pure part (node tests in tests/settingsLogic.test.cjs): the search over the row
 * registry (every typed word must match the label, hint or keywords; case- and
 * diacritics-insensitive; label hits rank first), the highlight segments for a matched string,
 * the `#/settings/<category>` sub-route the phone pushes so Android back closes a category, and
 * the one-line summaries the phone list shows under each category. No imports.
 */

export type CategoryId = 'servers' | 'ai' | 'models' | 'appearance' | 'sounds' | 'about';
export const CATEGORY_IDS: readonly CategoryId[] = ['servers', 'ai', 'models', 'appearance', 'sounds', 'about'];

/** What the search reads from a row; the registry's rows carry more (group, control). */
export interface SearchableRow {
  id: string;
  category: CategoryId;
  label: string;
  hint?: string;
  keywords?: readonly string[];
}

/** Lower-case, diacritics stripped, whitespace collapsed. "Modèle  Préférée" → "modele preferee". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function queryTokens(query: string): string[] {
  const q = normalize(query);
  return q ? q.split(' ') : [];
}

const LABEL_PREFIX = 100;
const LABEL_HIT = 60;
const KEYWORD_HIT = 40;
const HINT_HIT = 20;

/** 0 = no match. Every token must hit somewhere; the score adds the best place each token hit. */
export function scoreRow(row: SearchableRow, query: string): number {
  const toks = queryTokens(query);
  if (!toks.length) return 0;
  const label = normalize(row.label);
  const hint = row.hint ? normalize(row.hint) : '';
  const keys = (row.keywords ?? []).map(normalize);
  let score = 0;
  for (const t of toks) {
    let best = 0;
    if (label.startsWith(t) || label.includes(` ${t}`)) best = LABEL_PREFIX;
    else if (label.includes(t)) best = LABEL_HIT;
    else if (keys.some((k) => k.includes(t))) best = KEYWORD_HIT;
    else if (hint.includes(t)) best = HINT_HIT;
    if (!best) return 0;
    score += best;
  }
  return score;
}

/** The rows that match, best first; ties keep the registry order. Empty query → no rows. */
export function searchRows<R extends SearchableRow>(rows: readonly R[], query: string): R[] {
  if (!queryTokens(query).length) return [];
  return rows
    .map((row, i) => ({ row, i, score: scoreRow(row, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.row);
}

/** How many rows match per category (0 for the quiet ones), in CATEGORY_IDS order. */
export function countByCategory(rows: readonly SearchableRow[], query: string): Record<CategoryId, number> {
  const out = Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Record<CategoryId, number>;
  for (const r of searchRows(rows, query)) out[r.category] += 1;
  return out;
}

/** Matching rows grouped under their category, categories in CATEGORY_IDS order, empty ones left out. */
export function groupByCategory<R extends SearchableRow>(rows: readonly R[]): Array<{ category: CategoryId; rows: R[] }> {
  return CATEGORY_IDS
    .map((category) => ({ category, rows: rows.filter((r) => r.category === category) }))
    .filter((g) => g.rows.length > 0);
}

export interface Segment { text: string; hit: boolean }

/**
 * `text` cut into plain and hit segments, one hit per query token occurrence, matched on the
 * normalized text but cut on the original (so "Modèle" lights up for "modele").
 */
export function highlight(text: string, query: string): Segment[] {
  const toks = queryTokens(query);
  if (!toks.length || !text) return [{ text, hit: false }];
  // Per original char → its normalized chars; `origAt[n]` = the original index of normalized char n.
  let norm = '';
  const origAt: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const n = normalize(text[i]) || (text[i] === ' ' ? ' ' : '');
    for (let j = 0; j < n.length; j++) { norm += n[j]; origAt.push(i); }
  }
  const hit = new Array<boolean>(text.length).fill(false);
  for (const t of toks) {
    let from = 0;
    for (;;) {
      const at = norm.indexOf(t, from);
      if (at < 0) break;
      for (let n = at; n < at + t.length; n++) hit[origAt[n]] = true;
      from = at + 1;
    }
  }
  const out: Segment[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && last.hit === hit[i]) last.text += text[i];
    else out.push({ text: text[i], hit: hit[i] });
  }
  return out;
}

// --- the phone's sub-route -------------------------------------------------------------------

/** `#/settings/ai` → 'ai'; `#/settings`, `#/settings/nope`, `#/library/ai` → null. */
export function categoryOfHash(hash: string): CategoryId | null {
  const [screen, seg] = hash.replace(/^#\/?/, '').split('?')[0].split('/');
  if (screen !== 'settings' || !seg) return null;
  return (CATEGORY_IDS as readonly string[]).includes(seg) ? (seg as CategoryId) : null;
}

export function hashOfCategory(c: CategoryId | null): string {
  return c ? `#/settings/${c}` : '#/settings';
}

/** The AI helper's provider page: `#/settings/ai/openrouter` → 'openrouter'; anything else → null.
 *  The caller checks the id against the provider catalogue. */
export function providerOfHash(hash: string): string | null {
  const [screen, cat, id] = hash.replace(/^#\/?/, '').split('?')[0].split('/');
  return screen === 'settings' && cat === 'ai' && id ? decodeURIComponent(id) : null;
}

export function hashOfProvider(id: string): string {
  return `#/settings/ai/${encodeURIComponent(id)}`;
}

// --- the phone list's one-line summaries ------------------------------------------------------

export function serversSummary(total: number, online: number): string {
  if (!total) return 'No servers yet';
  return `${total} server${total === 1 ? '' : 's'} · ${online} online`;
}

/** `status` is the providers' line ("Using OpenRouter · claude-sonnet-4", "Local · not set up"). */
export function aiSummary(status: string, promptStyle: string): string {
  return `${status} · ${promptStyle === 'illustrious' ? 'Illustrious tags' : 'Generic SDXL'}`;
}

export function modelsSummary(hasKey: boolean, previewLabel: string): string {
  return `${hasKey ? 'CivitAI key set' : 'No CivitAI key'} · previews: ${previewLabel}`;
}

export function appearanceSummary(tilePx: number): string {
  return `Library tiles ${tilePx}px`;
}

export function soundsSummary(volume: number): string {
  const pct = Math.round(volume * 100);
  return pct ? `Volume ${pct}%` : 'Off';
}
