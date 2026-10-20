/**
 * What the grid shows: the CivitAI pages narrowed by the client-side filters, or — Downloaded —
 * the pod's CivitAI-known files filtered by the same search / type / base / NSFW; both locked to
 * the picker's kind and, with tags picked, ranked by tag overlap (`rankByTags`).
 */
import { useMemo } from 'react';
import type { CivitaiModel } from '@/lib/civitai';
import { narrowPage, passesMask, kindTypes } from './civitaiQuery';
import { rankByTags, matchesText } from './tags';
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
    if (source === 'installed' && q) {
      // A typed search always searches CivitAI (Donny, 10-20: "the search is only searching what
      // is loaded"): the installed matches lead, then the API's results that are not installed.
      const mine = installedModels.filter((m) => (matchesText(m, q) || m.modelVersions.some((v) => v.files.some((f) => f.name.toLowerCase().includes(q.toLowerCase()))))
        && (!types.length || types.includes(m.type as never)));
      const seen = new Set(mine.map((m) => m.id));
      const fromApi = narrowPage(items, filters, installed.known ? installed.model : undefined)
        .filter((m) => (!kind || types.includes(m.type as never)) && !seen.has(m.id));
      pool = [...mine, ...fromApi];
      hidden = items.length - fromApi.length;
    } else if (source === 'installed') {
      pool = installedModels.filter((m) =>
        matchesText(m, q) || (q && m.modelVersions.some((v) => v.files.some((f) => f.name.toLowerCase().includes(q.toLowerCase())))))
        .filter((m) => (!types.length || types.includes(m.type as never))
          && (!filters.baseModels.length || m.modelVersions.some((v) => filters.baseModels.some((b) => v.baseModel === b || v.baseModel?.startsWith(b))))
          && (!filters.favorites || favourites.includes(m.id))
          && (!filters.tag || m.tags.some((t) => t.toLowerCase() === filters.tag.toLowerCase()))
          && passesMask(m.nsfwLevel, filters.nsfwMask));
      hidden = installedModels.length - pool.length;
    } else {
      pool = narrowPage(items, filters, installed.known ? installed.model : undefined)
        .filter((m) => !kind || types.includes(m.type as never));
      hidden = items.length - pool.length;
    }
    const list = selectedTags.length ? rankByTags(pool, selectedTags).map((r) => r.model) : pool;
    return { items: list, hidden, pool };
  }, [source, filters, kind, selectedTags, items, installed, installedModels, favourites]);

  if (source === 'installed' && !filters.query.trim()) return { ...shown, loading: false, loadingMore: false, error: null, hasMore: false, total: shown.items.length };
  return { ...shown, loading, loadingMore, error, hasMore: !!nextCursor, total: selectedTags.length > 1 ? null : totalItems };
}
