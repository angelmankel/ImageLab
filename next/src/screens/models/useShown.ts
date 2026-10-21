/**
 * What the grid shows: the CivitAI pages narrowed by the client-side filters, or — Downloaded —
 * the pod's CivitAI-known files filtered by the same search / type / base / NSFW; both locked to
 * the picker's kind and, with tags picked, ranked by tag overlap (`rankByTags`).
 */
import { useMemo } from 'react';
import type { CivitaiModel } from '@/lib/civitai';
import { narrowPage, passesMask, kindTypes } from './civitaiQuery';
import { rankByTags, matchesLocal } from './tags';
import { useModels } from './modelsStore';
import { useInstalled, useInstalledModels } from './useInstalled';

export interface Shown {
  items: CivitaiModel[];
  hidden: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  total: number | null;
  /** Everything loaded (before tag ranking), for the tag groups. */
  pool: CivitaiModel[];
}

export function useShown(): Shown {
  const source = useModels((s) => s.source);
  const filters = useModels((s) => s.filters);
  const kind = useModels((s) => s.kind);
  const selectedTags = useModels((s) => s.selectedTags);
  const items = useModels((s) => s.items);
  const loading = useModels((s) => s.loading);
  const loadingMore = useModels((s) => s.loadingMore);
  const error = useModels((s) => s.error);
  const nextCursor = useModels((s) => s.nextCursor);
  const totalItems = useModels((s) => s.totalItems);
  const favourites = useModels((s) => s.favourites);
  const installed = useInstalled();
  const installedModels = useInstalledModels();

  const shown = useMemo(() => {
    const types = kindTypes(kind) ?? filters.types;
    let pool: CivitaiModel[];
    let hidden: number;
    const q = filters.query.trim();
    if (source === 'installed') {
      // The search runs INSIDE the chosen source (fix list 2, added item — replaces "a typed search
      // always searches CivitAI"): Downloaded filters the server's models locally, never the API.
      pool = installedModels.filter((m) => matchesLocal(m, q))
        .filter((m) => (!types.length || types.includes(m.type as never))
          && (!filters.baseModels.length || m.modelVersions.some((v) => filters.baseModels.some((b) => v.baseModel === b || v.baseModel?.startsWith(b))))
          && (!filters.favorites || favourites.includes(m.id))
          && (!filters.tag || m.tags.some((t) => t.toLowerCase() === filters.tag.toLowerCase()))
          && passesMask(m.nsfwLevel, filters.nsfwMask));
      hidden = installedModels.length - pool.length;
    } else {
      // Favourites / Account ★ load their whole list (planSearch keeps the query off the API):
      // the search filters it here.
      const localSearch = (filters.favorites || filters.accountFavorites) && q;
      pool = narrowPage(items, filters, installed.known ? installed.model : undefined)
        .filter((m) => (!kind || types.includes(m.type as never)) && (!localSearch || matchesLocal(m, q)));
      hidden = items.length - pool.length;
    }
    const list = selectedTags.length ? rankByTags(pool, selectedTags).map((r) => r.model) : pool;
    return { items: list, hidden, pool };
  }, [source, filters, kind, selectedTags, items, installed, installedModels, favourites]);

  if (source === 'installed') return { ...shown, loading: false, loadingMore: false, error: null, hasMore: false, total: shown.items.length };
  return { ...shown, loading, loadingMore, error, hasMore: !!nextCursor, total: selectedTags.length > 1 ? null : totalItems };
}
