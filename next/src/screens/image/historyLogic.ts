/**
 * The history grid's pure part (tested in tests/history.test.cjs): image results and run results
 * as one tile shape, newest first, the All · Images · Videos · ★ filter, and the This step / All
 * scope (`inStep`: which step made a tile).
 */
export type HistoryFilter = 'all' | 'images' | 'videos' | 'liked';

/** Which kind of step makes a result: image results come from Image steps, clips from Video, runs from Workflow. */
export type ResultSource = 'image' | 'video' | 'workflow';

export interface TileSource { key: string; url: string; kind: 'image' | 'video'; filename: string; createdAt: number; source?: ResultSource }
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

export type HistoryScope = 'step' | 'all';
export interface StepLike { id: string; kind: string }

/**
 * Does this tile belong to `step`? A tile tagged with a step that still exists belongs to that
 * step; an untagged one (made before tagging, or its step was removed) to the first step of the
 * kind that makes it.
 */
export function inStep(tile: { key: string; source?: ResultSource }, step: StepLike, steps: readonly StepLike[], tags: Readonly<Record<string, string>>): boolean {
  const tag = tags[tile.key];
  if (tag && steps.some((s) => s.id === tag)) return tag === step.id;
  return !!tile.source && steps.find((s) => s.kind === tile.source)?.id === step.id;
}

/** The step a new result is credited to: the active step when it makes that kind, else the first step that does. */
export function creditStep(source: ResultSource, activeId: string, steps: readonly StepLike[]): string | null {
  const active = steps.find((s) => s.id === activeId);
  if (active && active.kind === source) return active.id;
  return steps.find((s) => s.kind === source)?.id ?? null;
}
