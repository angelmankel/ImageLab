/**
 * What the history panel needs for Collections (FIXLIST 21): an item lookup for the tiles' covers
 * and counts, and — when a collection is picked — its pictures as history tiles (results it holds
 * plus imported pictures, newest added first).
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { HistoryEntry, ImportedImage } from '@/lib/types';
import type { Tile } from '../historyLogic';
import { useCollectionsUi } from './collectionActions';
import { shownIds } from './collectionsLogic';
import { importedUrl, useImportedUrlsTick } from './importedUrls';
import type { ItemLookup } from './CollectionsRow';

const importedTile = (i: ImportedImage): Tile<HistoryEntry> => ({
  key: i.id, url: importedUrl(i.id), kind: i.mime.startsWith('video/') ? 'video' : 'image',
  filename: i.name, createdAt: i.createdAt, liked: !!i.liked, entry: null,
});

export interface CollectionView {
  lookup: ItemLookup;
  /** The picked collection's pictures, or null when none is picked (the normal history). */
  tiles: Tile<HistoryEntry>[] | null;
  name: string | null;
  isImported: (key: string) => boolean;
}

export function useCollectionView(all: readonly Tile<HistoryEntry>[]): CollectionView {
  const collections = useStore((s) => s.collections);
  const imported = useStore((s) => s.importedImages);
  const active = useCollectionsUi((s) => s.active);
  const tick = useImportedUrlsTick();
  return useMemo(() => {
    void tick; // new object URLs → new tiles
    const byKey = new Map(all.map((t) => [t.key, t]));
    const imp = new Map(imported.map((i) => [i.id, i]));
    const lookup: ItemLookup = {
      exists: (id) => byKey.has(id) || imp.has(id),
      url: (id) => byKey.get(id)?.url ?? (imp.has(id) ? importedUrl(id) : ''),
      isVideo: (id) => byKey.get(id)?.kind === 'video' || !!imp.get(id)?.mime.startsWith('video/'),
    };
    const c = active ? collections.find((x) => x.id === active) ?? null : null;
    const tiles = c ? shownIds(c, lookup.exists).map((id) => byKey.get(id) ?? importedTile(imp.get(id)!)) : null;
    return { lookup, tiles, name: c?.name ?? null, isImported: (key: string) => imp.has(key) };
  }, [all, collections, imported, active, tick]);
}
