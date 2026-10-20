/**
 * Rule 6: the pure side of the snippet chips and the snippet browser. Which snippets belong to a
 * prompt kind, which categories have any, the chip order (the library's own order — chips never
 * move), search, and the small list helpers the Undo needs. No store, no React: tested in node.
 */
import type { Layer, LayerKind, Snippet, SnippetCategory } from '@/lib/types';

export const UNCATEGORIZED = 'uncategorized';

/** A snippet counts for a kind when it is of that kind or is a preset with a part of that kind. */
export function ofKind(snippets: Snippet[], kind: LayerKind): Snippet[] {
  return snippets.filter((s) => s.kind === kind || !!s.layers?.some((l) => l.kind === kind));
}

/** The category a snippet lands in: its own, or Uncategorized when that category is gone. */
export function categoryOf(s: Snippet, known: ReadonlySet<string>): string {
  return known.has(s.categoryId) ? s.categoryId : UNCATEGORIZED;
}

/** The categories that have at least one of `snippets`, in the library's order (never re-sorted). */
export function categoriesWith(categories: SnippetCategory[], snippets: Snippet[]): SnippetCategory[] {
  const known = new Set(categories.map((c) => c.id));
  const used = new Set(snippets.map((s) => categoryOf(s, known)));
  return categories.filter((c) => used.has(c.id));
}

/** The snippets of one category, in the library's order. */
export function inCategory(snippets: Snippet[], categories: SnippetCategory[], categoryId: string): Snippet[] {
  const known = new Set(categories.map((c) => c.id));
  return snippets.filter((s) => categoryOf(s, known) === categoryId);
}

/** Per category id: how many snippets it has and how many of them are in the prompt (the browser's list). */
export function categoryCounts(snippets: Snippet[], categories: SnippetCategory[], inPrompt: ReadonlySet<string>): Map<string, { total: number; on: number }> {
  const known = new Set(categories.map((c) => c.id));
  const out = new Map<string, { total: number; on: number }>();
  for (const s of snippets) {
    const id = categoryOf(s, known);
    const row = out.get(id) ?? { total: 0, on: 0 };
    row.total += 1;
    if (inPrompt.has(s.id)) row.on += 1;
    out.set(id, row);
  }
  return out;
}

/** The remembered tab if it still exists, else the first category (or '' with no categories). */
export function pickTab(saved: string | undefined, categories: SnippetCategory[]): string {
  if (saved && categories.some((c) => c.id === saved)) return saved;
  return categories[0]?.id ?? '';
}

/** Ids of the snippets with a part in the prompt right now. */
export function inPromptIds(layers: Layer[]): Set<string> {
  return new Set(layers.map((l) => l.originSnippetId).filter((x): x is string => !!x));
}

/** The snippets in the prompt, in library order (the strip under "In prompt"). */
export function inPromptSnippets(snippets: Snippet[], layers: Layer[]): Snippet[] {
  const ids = inPromptIds(layers);
  return snippets.filter((s) => ids.has(s.id));
}

/** What a snippet puts in the prompt, as one line (the tile preview and the chip tooltip). */
export function previewText(s: Snippet): string {
  return s.layers ? s.layers.map((l) => l.text).join(' · ') : s.text;
}

/** Every word of the query must appear in the name, the text or a preset part (case-insensitive). */
export function searchSnippets(snippets: Snippet[], query: string): Snippet[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return snippets;
  return snippets.filter((s) => {
    const hay = `${s.name} ${previewText(s)}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Where a snippet sits, for putting it back on Undo; -1 when it is not there. */
export function indexOfId<T extends { id: string }>(list: T[], id: string): number {
  return list.findIndex((x) => x.id === id);
}

/** A copy of the list with `item` at `index` (clamped), the Undo of a delete. */
export function insertAt<T>(list: T[], index: number, item: T): T[] {
  const i = Math.max(0, Math.min(index < 0 ? list.length : index, list.length));
  return [...list.slice(0, i), item, ...list.slice(i)];
}

/** A trimmed name and text make a snippet worth saving. */
export function canSave(name: string, text: string): boolean {
  return name.trim().length > 0 && text.trim().length > 0;
}
