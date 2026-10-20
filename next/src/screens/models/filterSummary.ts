/**
 * The desktop filter bar's pure layer (Models board + Donny's 10-20 layout): what each labelled
 * dropdown chip says ("Type: Checkpoint", "Base: SDXL +2", "Base: Any"), whether it is lit (not at
 * its default), which filters live under "More", and the removable chips of the active-filter row
 * (the store's filters + the Downloaded source). No React, no store: `tests/filterSummary.test.cjs`.
 */
import {
  MODEL_TYPES, MAIN_BASE_MODELS, MORE_BASE_MODELS, KIND_LABEL, typeLabel, baseModelShort, activeFilters,
  type ModelFilters, type ModelKindKey, type FilterKey, type ModelType,
} from './civitaiQuery';

/** The types the Type menu lists first; the rarely used rest sit under "Other types". */
export const ROW_TYPES: ModelType[] = MODEL_TYPES.filter((t) => !['AestheticGradient', 'Detection', 'Other', 'DoRA'].includes(t));
export const OTHER_TYPES: ModelType[] = MODEL_TYPES.filter((t) => !ROW_TYPES.includes(t));

/** A chip's value: `none` when empty, the one label, or "first +n". */
export function summarize(labels: readonly string[], none: string): string {
  if (!labels.length) return none;
  return labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`;
}

export interface ChipState {
  /** What follows "Label: " (empty for More at rest: the chip just says "More"). */
  value: string;
  /** Not at its default: ember. */
  on: boolean;
  /** How many choices are on (for the menu's Clear). */
  count: number;
}

export type SourceKey = 'civitai' | 'installed';

/** Source: Downloaded (the pod) · ★ Favourites (local) · CivitAI account favourites. */
export function sourceChip(source: SourceKey, f: Pick<ModelFilters, 'favorites' | 'accountFavorites'>): ChipState {
  const labels = [source === 'installed' ? 'Downloaded' : '', f.favorites ? 'Favourites' : '', f.accountFavorites ? 'CivitAI favourites' : ''].filter(Boolean);
  return { value: summarize(labels, 'All CivitAI'), on: labels.length > 0, count: labels.length };
}

/** Type: the chosen types, or the step's kind (locked, always lit). */
export function typeChip(f: Pick<ModelFilters, 'types'>, kind: ModelKindKey | null | undefined): ChipState & { locked: boolean } {
  if (kind) return { value: KIND_LABEL[kind], on: true, count: 0, locked: true };
  return { value: summarize(f.types.map(typeLabel), 'Any'), on: f.types.length > 0, count: f.types.length, locked: false };
}

/** Base: the chosen base models (main row first, then the rest, as the menu lists them). */
export function baseChip(f: Pick<ModelFilters, 'baseModels'>): ChipState {
  const order = [...MAIN_BASE_MODELS, ...MORE_BASE_MODELS] as readonly string[];
  const rank = (b: string) => { const i = order.indexOf(b); return i < 0 ? order.length : i; };
  const sorted = [...f.baseModels].sort((a, b) => rank(a) - rank(b));
  return { value: summarize(sorted.map(baseModelShort), 'Any'), on: sorted.length > 0, count: sorted.length };
}

/** Whether a chosen base model is one of the long tail (the Base menu opens that list then). */
export function hasMoreBase(f: Pick<ModelFilters, 'baseModels'>): boolean {
  return f.baseModels.some((b) => (MORE_BASE_MODELS as readonly string[]).includes(b));
}

/** Tags: the picked tags. */
export function tagsChip(selected: readonly string[]): ChipState {
  return { value: summarize(selected.map((t) => `#${t}`), 'Any'), on: selected.length > 0, count: selected.length };
}

/** Filters that have their own place (search, row-1 selects, Source / Type / Base menus); the rest are "More". */
const NOT_MORE: readonly FilterKey[] = ['query', 'types', 'baseModels', 'period', 'nsfwMask', 'favorites', 'accountFavorites', 'sort'];

export function isMoreKey(key: FilterKey): boolean { return !NOT_MORE.includes(key); }

/** More: everything else that is set (Followed, Early access, Made on-site, licence, formats, tag, creator…). */
export function moreChip(f: ModelFilters): ChipState {
  const labels = activeFilters(f).filter((a) => isMoreKey(a.key)).map((a) => a.label);
  return { value: summarize(labels, ''), on: labels.length > 0, count: labels.length };
}

/** One removable chip of the active-filter row: a store filter, or the Downloaded source. */
export interface ActiveChip { key: FilterKey | 'source'; label: string }

/** The active-filter row: Downloaded first, then every set filter (the kind-locked type is not removable, so it is left out). */
export function activeChips(f: ModelFilters, source: SourceKey, kind: ModelKindKey | null | undefined): ActiveChip[] {
  const out: ActiveChip[] = source === 'installed' ? [{ key: 'source', label: 'Downloaded' }] : [];
  for (const a of activeFilters(f)) if (!(kind && a.key === 'types')) out.push(a);
  return out;
}
