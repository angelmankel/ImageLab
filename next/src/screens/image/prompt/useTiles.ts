/**
 * Items 12 + 13: the library as tiles — the main store's snippets without the model-specific
 * ones (Pony, Illustrious…), split by prompt kind, plus category names. Memoised on the store's
 * arrays, so the selectors never hand out fresh arrays.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { Snippet, SnippetCategory } from '@/lib/types';
import { isModelSpecific } from './promptSearch';
import { snippetTextFor } from './promptSections';

export interface Tiles {
  positive: Snippet[];
  negative: Snippet[];
  categories: SnippetCategory[];
  categoryNames: Record<string, string>;
}

/** Category order for the grid: Style first (the old Style row), then the library's own order. */
const FIRST = ['style'];

export function useTiles(): Tiles {
  const snippets = useStore((s) => s.snippets);
  const cats = useStore((s) => s.snippetCategories);
  return useMemo(() => {
    const ok = snippets.filter((s) => !isModelSpecific(s));
    const categories = cats.filter((c) => !isModelSpecific({ id: '', categoryId: c.id }));
    categories.sort((a, b) => (FIRST.includes(b.id) ? 1 : 0) - (FIRST.includes(a.id) ? 1 : 0));
    const categoryNames: Record<string, string> = {};
    for (const c of cats) categoryNames[c.id] = c.name.replace(/^negative\s*[·:\-–—]\s*/i, '');
    return {
      positive: ok.filter((s) => snippetTextFor(s, 'positive')),
      negative: ok.filter((s) => snippetTextFor(s, 'negative')),
      categories,
      categoryNames,
    };
  }, [snippets, cats]);
}
