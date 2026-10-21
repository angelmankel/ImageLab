/**
 * Item 42: every change to the snippet library (snippets + categories) as ONE app undo step
 * (`~/app/undo`, Ctrl+Z / the Undo button; no Undo toasts). The pure rules are `snippetModel.ts`.
 * Also the small preview picture: any image → a ~192 px WebP data URL kept with the snippet.
 *
 * For other agents (item 47 AI part): `addSnippets([{ name, text, categoryId }])` saves several at
 * once as one undo step; `useStore.getState().addSnippet(...)` still works for one.
 */
import { useStore } from '@/lib/store';
import type { LayerKind, Snippet, SnippetCategory } from '@/lib/types';
import { pushUndo } from '~/app/undo';
import { nanoid } from '~/app/ids';
import * as M from './snippetModel';

type Lib = { snippets: Snippet[]; snippetCategories: SnippetCategory[] };

const snap = (): Lib => { const s = useStore.getState(); return { snippets: s.snippets, snippetCategories: s.snippetCategories }; };
const put = (l: Lib) => useStore.setState({ snippets: l.snippets, snippetCategories: l.snippetCategories });

/** Run a library change as one undo step. `fn` returns the new arrays (or null = no change). */
export function libChange(label: string, fn: (l: Lib) => Partial<Lib> | null): void {
  const before = snap();
  const patch = fn(before);
  if (!patch) return;
  const after: Lib = { ...before, ...patch };
  put(after);
  pushUndo({ label, undo: () => put(before), redo: () => put(after) });
}

export interface NewSnippet { text: string; name?: string; categoryId?: string; kind?: LayerKind; image?: string }

/** Add snippets (name made from the text when empty). Returns their ids. */
export function addSnippets(items: NewSnippet[]): string[] {
  const ids: string[] = [];
  libChange(items.length === 1 ? 'Add snippet' : `Add ${items.length} snippets`, (l) => {
    const known = new Set(l.snippetCategories.map((c) => c.id));
    const add: Snippet[] = items.filter((it) => it.text.trim()).map((it) => {
      const id = nanoid(10);
      ids.push(id);
      return {
        id, name: it.name?.trim() || M.autoName(it.text), text: it.text.trim(), tag: '', weight: 1, kind: it.kind ?? 'positive',
        categoryId: it.categoryId && known.has(it.categoryId) ? it.categoryId : M.UNCATEGORIZED,
        ...(it.image ? { image: it.image } : {}),
      };
    });
    return add.length ? { snippets: [...l.snippets, ...add] } : null;
  });
  return ids;
}

export function updateSnippet(id: string, patch: Partial<Omit<Snippet, 'id'>>): void {
  libChange('Edit snippet', (l) => ({ snippets: l.snippets.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
}

export function deleteSnippets(ids: Iterable<string>): void {
  const set = new Set(ids);
  if (!set.size) return;
  libChange(set.size === 1 ? 'Delete snippet' : `Delete ${set.size} snippets`, (l) => ({ snippets: l.snippets.filter((s) => !set.has(s.id)) }));
}

export function duplicateSnippets(ids: Iterable<string>): string[] {
  const set = new Set(ids);
  let added: string[] = [];
  libChange('Duplicate snippet', (l) => {
    const r = M.duplicateSnippets(l.snippets, set, () => nanoid(10));
    added = r.added;
    return { snippets: r.snippets };
  });
  return added;
}

export function moveSnippets(ids: Iterable<string>, categoryId: string): void {
  const set = new Set(ids);
  libChange('Move snippets', (l) => ({ snippets: M.moveSnippets(l.snippets, set, categoryId) }));
}

export function addCategory(name: string, icon?: string, hue?: number): string {
  const id = nanoid(10);
  libChange('New category', (l) => {
    const nm = M.uniqueName(name.trim() || 'New category', l.snippetCategories.map((c) => c.name));
    // New categories go just before Uncategorized (it stays last).
    const cats = l.snippetCategories.slice();
    const u = cats.findIndex((c) => c.id === M.UNCATEGORIZED);
    const cat: SnippetCategory = { id, name: nm, ...(icon ? { icon } : {}), ...(hue !== undefined ? { hue } : {}) };
    if (u >= 0) cats.splice(u, 0, cat); else cats.push(cat);
    return { snippetCategories: cats };
  });
  return id;
}

export function updateCategory(id: string, patch: Partial<Omit<SnippetCategory, 'id'>>): void {
  libChange('Edit category', (l) => ({
    snippetCategories: l.snippetCategories.map((c) => (c.id === id ? { ...c, ...patch, name: patch.name !== undefined ? (patch.name.trim() || c.name) : c.name } : c)),
  }));
}

export function reorderCategory(from: number, to: number): void {
  libChange('Reorder categories', (l) => ({ snippetCategories: M.reorder(l.snippetCategories, from, to) }));
}

export function deleteCategory(id: string): void {
  libChange('Delete category', (l) => {
    const r = M.deleteCategory(l.snippets, l.snippetCategories, id);
    return { snippets: r.snippets, snippetCategories: r.cats };
  });
}

export function mergeCategory(from: string, into: string): void {
  libChange('Merge categories', (l) => {
    const r = M.mergeCategory(l.snippets, l.snippetCategories, from, into);
    return { snippets: r.snippets, snippetCategories: r.cats };
  });
}

/** Any picture → a small square-ish WebP data URL (longest side `max`) for a snippet's tile. */
export async function snippetPicture(blob: Blob, max = 192): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const url = c.toDataURL('image/webp', 0.8);
  return url.startsWith('data:image/webp') ? url : c.toDataURL('image/jpeg', 0.82);
}
