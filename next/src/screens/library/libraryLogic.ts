/**
 * Library (rule 12) — the pure part: one item shape for images and videos, and the filter / sort /
 * count / grid-size helpers the screens use. No React, no stores, no `@/` value imports, so
 * `tests/library.test.cjs` can load it straight from the source.
 */
import type { HistoryEntry } from '@/lib/types';
import { formatWhen } from '~/lib/time';

export type Kind = 'all' | 'image' | 'video' | 'fav';
export type SortKey = 'newest' | 'oldest' | 'favourites';
export type TileSize = 's' | 'm' | 'l';
/** 'all' · 'favourites' · a collection id. */
export type Bucket = string;

/** One tile: a generated image (with its history entry) or a video result. */
export interface LibItem {
  /** History id for images; the result url for videos (also the id kept in collections). */
  key: string;
  kind: 'image' | 'video';
  url: string;
  filename: string;
  createdAt: number;
  liked: boolean;
  entry?: HistoryEntry;
}

export interface CollectionLike { id: string; name: string; itemIds: readonly string[] }

export interface LibFilter {
  kind: Kind;
  bucket: Bucket;
  search: string;
  collections: readonly CollectionLike[];
}

/** The words a search matches: prompt, negative, model, file name, AI tags/description. */
export function haystack(it: LibItem): string {
  const e = it.entry;
  return [it.filename, e?.positive, e?.negative, e?.model, e?.workflow?.checkpoints?.[0]?.name, e?.description, e?.aiPrompt, ...(e?.tags ?? []), e ? String(e.seed) : '']
    .filter(Boolean).join(' • ').toLowerCase();
}

/** Every word of the query must appear (any order). */
export function matchesSearch(it: LibItem, q: string): boolean {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const h = haystack(it);
  return words.every((w) => h.includes(w));
}

export function inBucket(it: LibItem, bucket: Bucket, collections: readonly CollectionLike[]): boolean {
  if (bucket === 'all') return true;
  if (bucket === 'favourites') return it.liked;
  const c = collections.find((x) => x.id === bucket);
  return !!c && c.itemIds.includes(it.key);
}

export function matchesKind(it: LibItem, kind: Kind): boolean {
  if (kind === 'all') return true;
  if (kind === 'fav') return it.liked;
  return it.kind === kind;
}

export function filterItems(items: readonly LibItem[], f: LibFilter): LibItem[] {
  return items.filter((it) => matchesKind(it, f.kind) && inBucket(it, f.bucket, f.collections) && matchesSearch(it, f.search));
}

/** Newest / oldest by time; favourites = starred first, newest first inside each group. */
export function sortItems(items: readonly LibItem[], sort: SortKey): LibItem[] {
  const out = items.slice();
  if (sort === 'oldest') out.sort((a, b) => a.createdAt - b.createdAt);
  else if (sort === 'favourites') out.sort((a, b) => Number(b.liked) - Number(a.liked) || b.createdAt - a.createdAt);
  else out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

/** How many items each picker entry holds: all, favourites, and every collection (by id). */
export function bucketCounts(items: readonly LibItem[], collections: readonly CollectionLike[]): Record<string, number> {
  const keys = new Set(items.map((i) => i.key));
  const out: Record<string, number> = { all: items.length, favourites: items.filter((i) => i.liked).length };
  for (const c of collections) out[c.id] = c.itemIds.filter((id) => keys.has(id)).length;
  return out;
}

/** The label on the collection picker. */
export function bucketLabel(bucket: Bucket, collections: readonly CollectionLike[]): string {
  if (bucket === 'all') return 'All items';
  if (bucket === 'favourites') return 'Favourites';
  return collections.find((c) => c.id === bucket)?.name ?? 'All items';
}

const MAX_COLS: Record<TileSize, number> = { s: 7, m: 5, l: 3 };
const MIN_COLS: Record<TileSize, number> = { s: 4, m: 3, l: 2 };
const MIN_TILE: Record<TileSize, number> = { s: 96, m: 150, l: 220 };

/** Columns for a grid `width` px wide: the size's maximum (medium = 5), fewer as it narrows, never below its minimum (medium = 3). */
export function gridColumns(width: number, size: TileSize, gap = 8): number {
  if (!(width > 0)) return MAX_COLS[size];
  const fit = Math.floor((width + gap) / (MIN_TILE[size] + gap));
  return Math.max(MIN_COLS[size], Math.min(MAX_COLS[size], fit));
}

/** Toggle one key in a list (multi-select). */
export function toggleKey(list: readonly string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

/** Drop picked keys that are no longer visible. Returns the same array when nothing changed. */
export function prunePicked(picked: readonly string[], visible: readonly LibItem[]): readonly string[] {
  if (!picked.length) return picked;
  const keys = new Set(visible.map((i) => i.key));
  const next = picked.filter((k) => keys.has(k));
  return next.length === picked.length ? picked : next;
}

/** The settings grid on the detail panel: Model · Size · Steps · CFG · Sampler · Seed. */
export function settingsCells(entry: HistoryEntry | undefined): Array<{ label: string; value: string }> {
  if (!entry) return [];
  const w = entry.workflow;
  const model = w?.checkpoints?.[0]?.name || entry.model || '';
  const dash = '—';
  return [
    { label: 'Model', value: model ? prettyModel(model) : dash },
    { label: 'Size', value: w?.width && w?.height ? `${w.width} × ${w.height}` : dash },
    { label: 'Steps', value: w?.steps != null ? String(w.steps) : dash },
    { label: 'CFG', value: w?.cfg != null ? String(w.cfg) : dash },
    { label: 'Sampler', value: w?.sampler ? prettySampler(w.sampler) : dash },
    { label: 'Seed', value: String(entry.seed ?? dash) },
  ];
}

/** "models/illustriousXL_v20.safetensors" → "illustriousXL_v20". */
export function prettyModel(name: string): string {
  return name.replace(/^.*[\\/]/, '').replace(/\.(safetensors|ckpt|pt|pth|gguf|bin)$/i, '');
}

/** "euler_ancestral" → "Euler ancestral", "dpmpp_2m" → "DPM++ 2M". */
export function prettySampler(s: string): string {
  const t = s.replace(/^dpmpp/i, 'DPM++').replace(/_/g, ' ').replace(/\b(\d+)([ms])\b/gi, (_m, n: string, l: string) => n + l.toUpperCase());
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "Today · 2:32 PM", "Yesterday · 9:05 AM", "12 Oct · 6:40 PM", "12 Oct 2025 · 6:40 PM" (`~/lib/time`, list 2 #10). */
export function whenLabel(ts: number, now = Date.now()): string {
  return formatWhen(ts, now);
}

/** 4.2 → "0:04", 75 → "1:15". */
export function durationLabel(sec: number): string {
  if (!(sec >= 0) || !Number.isFinite(sec)) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
