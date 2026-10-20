/**
 * The history grid's pure part (tested in tests/history.test.cjs): image results and run results
 * as one tile shape, newest first, and the All · Images · Videos · ★ filter.
 */
export type HistoryFilter = 'all' | 'images' | 'videos' | 'liked';

export interface TileSource { key: string; url: string; kind: 'image' | 'video'; filename: string; createdAt: number }
export interface EntryLike { id: string; liked?: boolean }

export interface Tile<E extends EntryLike = EntryLike> extends TileSource {
  liked: boolean;
  /** The history entry for an image result (favourite, fullscreen pager); run results have none. */
  entry: E | null;
  entryId?: string;
}

export function mergeTiles<E extends EntryLike>(images: ReadonlyArray<TileSource & { entry: E }>, ...runs: ReadonlyArray<TileSource>[]): Tile<E>[] {
  const out: Tile<E>[] = images.map((i) => ({ ...i, liked: !!i.entry.liked, entry: i.entry, entryId: i.entry.id }));
  for (const list of runs) for (const r of list) out.push({ ...r, liked: false, entry: null });
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function filterTiles<E extends EntryLike>(tiles: readonly Tile<E>[], filter: HistoryFilter): Tile<E>[] {
  if (filter === 'images') return tiles.filter((t) => t.kind === 'image');
  if (filter === 'videos') return tiles.filter((t) => t.kind === 'video');
  if (filter === 'liked') return tiles.filter((t) => t.liked);
  return [...tiles];
}
