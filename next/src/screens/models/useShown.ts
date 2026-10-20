/**
 * What the grid / list shows: the CivitAI pages narrowed by the client-side filters, or — Source
 * = Installed — the servers' CivitAI-known files filtered by the same search / type / base chips.
 */
import { useMemo } from 'react';
import type { CivitaiModel } from '@/lib/civitai';
import { narrowPage, passesMask } from './civitaiQuery';
import { useModels } from './modelsStore';
import { useInstalled, useInstalledModels } from './useInstalled';

export function useShown(): { items: CivitaiModel[]; hidden: number; loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; total: number | null } {
  const source = useModels((s) => s.source);
  const filters = useModels((s) => s.filters);
  const items = useModels((s) => s.items);
  const loading = useModels((s) => s.loading);
  const loadingMore = useModels((s) => s.loadingMore);
  const error = useModels((s) => s.error);
  const nextCursor = useModels((s) => s.nextCursor);
  const totalItems = useModels((s) => s.totalItems);
  const installed = useInstalled();
  const installedModels = useInstalledModels();

  const shown = useMemo(() => {
    if (source === 'installed') {
      const q = filters.query.trim().toLowerCase();
      const list = installedModels.filter((m) =>
        (!q || m.name.toLowerCase().includes(q) || m.modelVersions.some((v) => v.files.some((f) => f.name.toLowerCase().includes(q))))
        && (!filters.types.length || filters.types.includes(m.type as never))
        && (!filters.baseModels.length || m.modelVersions.some((v) => filters.baseModels.some((b) => v.baseModel === b || v.baseModel?.startsWith(b))))
        && passesMask(m.nsfwLevel, filters.nsfwMask));
      return { items: list, hidden: installedModels.length - list.length };
    }
    const list = narrowPage(items, filters, installed.known ? installed.model : undefined);
    return { items: list, hidden: items.length - list.length };
  }, [source, filters, items, installed, installedModels]);

  if (source === 'installed') return { ...shown, loading: false, loadingMore: false, error: null, hasMore: false, total: shown.items.length };
  return { ...shown, loading, loadingMore, error, hasMore: !!nextCursor, total: totalItems };
}
