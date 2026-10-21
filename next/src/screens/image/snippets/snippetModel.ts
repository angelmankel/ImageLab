/**
 * Item 42: the pure side of the snippet + category system — auto names, category reorder / merge /
 * delete (snippets land in Uncategorized), move, duplicate, the colour palette. No store, no React:
 * tested in node (`tests/snippetModel.test.cjs`). The store calls live in `snippetOps.ts`.
 */

export const UNCATEGORIZED = 'uncategorized';

interface S { id: string; name: string; text: string; categoryId: string; layers?: Array<{ text: string }> }
interface C { id: string; name: string; icon?: string; hue?: number }

/** The colours a category can wear (hues), shown as swatches. */
export const CATEGORY_HUES = [265, 220, 200, 160, 125, 45, 32, 20, 355, 320, 290] as const;

/** Emoji offered for a category's icon (any text may be typed too). */
export const CATEGORY_EMOJI = ['🎨', '⭐', '💡', '🌈', '📷', '🖼', '🤸', '😀', '👗', '🏞', '🌧', '✨', '🔍', '📁', '🔥', '🌙', '🌸', '🏙', '🐉', '🤖', '🧙', '🎬', '🖌', '🧪'] as const;

/**
 * A name from the text when none was typed: the first part (up to `,` `.` or a new line), weights
 * and brackets dropped, at most 4 words / 28 characters, first letter upper-case.
 */
export function autoName(text: string): string {
  const first = text.split(/[,\n]|\.(?=\s|$)/)[0] ?? '';
  let t = first.replace(/[()[\]{}]/g, ' ').replace(/:\s*-?\d*\.?\d+\s*$/, '').replace(/\s+/g, ' ').trim();
  if (!t) t = text.replace(/[()[\]{}:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return 'Snippet';
  const words = t.split(' ').slice(0, 4);
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > 28) break;
    out = next;
  }
  if (!out) out = t.slice(0, 28);
  return out[0].toUpperCase() + out.slice(1);
}

/** `name`, or "name 2", "name 3"… when it is taken (case-insensitive). */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const set = new Set(Array.from(taken, (n) => n.toLowerCase()));
  if (!set.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) { const n = `${name} ${i}`; if (!set.has(n.toLowerCase())) return n; }
}

/** A copy of the list with the item at `from` moved to index `to`. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length) return out;
  const [m] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, m);
  return out;
}

/** Every snippet in `ids` moves to `categoryId`. */
export function moveSnippets<T extends S>(snippets: readonly T[], ids: ReadonlySet<string>, categoryId: string): T[] {
  return snippets.map((s) => (ids.has(s.id) && s.categoryId !== categoryId ? { ...s, categoryId } : s));
}

/** Delete a category: its snippets go to Uncategorized (which itself can never go). */
export function deleteCategory<T extends S, K extends C>(snippets: readonly T[], cats: readonly K[], id: string): { snippets: T[]; cats: K[] } {
  if (id === UNCATEGORIZED) return { snippets: snippets.slice(), cats: cats.slice() };
  return { snippets: snippets.map((s) => (s.categoryId === id ? { ...s, categoryId: UNCATEGORIZED } : s)), cats: cats.filter((c) => c.id !== id) };
}

/** Merge `from` into `into`: its snippets move, the category goes. */
export function mergeCategory<T extends S, K extends C>(snippets: readonly T[], cats: readonly K[], from: string, into: string): { snippets: T[]; cats: K[] } {
  if (from === into || from === UNCATEGORIZED || !cats.some((c) => c.id === into)) return { snippets: snippets.slice(), cats: cats.slice() };
  return { snippets: snippets.map((s) => (s.categoryId === from ? { ...s, categoryId: into } : s)), cats: cats.filter((c) => c.id !== from) };
}

/** A duplicate right after the original, named "… copy" (unique). */
export function duplicateSnippets<T extends S>(snippets: readonly T[], ids: ReadonlySet<string>, newId: () => string): { snippets: T[]; added: string[] } {
  const out: T[] = [];
  const added: string[] = [];
  const names = snippets.map((s) => s.name);
  for (const s of snippets) {
    out.push(s);
    if (ids.has(s.id)) {
      const id = newId();
      const name = uniqueName(`${s.name} copy`, names);
      names.push(name);
      out.push({ ...s, id, name });
      added.push(id);
    }
  }
  return { snippets: out, added };
}

/** Per category id: how many snippets it holds (unknown categories count as Uncategorized). */
export function countByCategory(snippets: readonly S[], cats: readonly C[]): Map<string, number> {
  const known = new Set(cats.map((c) => c.id));
  const m = new Map<string, number>();
  for (const s of snippets) {
    const id = known.has(s.categoryId) ? s.categoryId : UNCATEGORIZED;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}
