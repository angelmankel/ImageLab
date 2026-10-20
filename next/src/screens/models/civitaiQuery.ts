/**
 * The Models screen's pure layer (rule 13: every CivitAI API feature). No imports, so
 * `tests/civitai-api.test.cjs` can require it straight from TypeScript (Node strips the types).
 *
 *   - the vocabularies: model types, sorts, periods, base models, NSFW levels, licences, formats
 *   - `ModelFilters` (what the UI holds) → `buildModelsQuery` (the exact /api/v1/models query)
 *   - `buildImagesQuery` for /api/v1/images (sample images with generation `meta`)
 *   - the NSFW browsing-level bitmask helpers
 *   - "installed" matching of a CivitAI version/file against the servers' hashes and file lists
 *   - the active-filter summary (count + removable chips)
 */

// ── vocabularies ───────────────────────────────────────────────────────────

/** Every `types` value /api/v1/models accepts. */
export const MODEL_TYPES = [
  'Checkpoint', 'LORA', 'LoCon', 'DoRA', 'TextualInversion', 'Hypernetwork', 'AestheticGradient',
  'Controlnet', 'Upscaler', 'MotionModule', 'VAE', 'Poses', 'Wildcards', 'Workflows', 'Detection', 'Other',
] as const;
export type ModelType = typeof MODEL_TYPES[number];

export const TYPE_LABEL: Record<ModelType, string> = {
  Checkpoint: 'Checkpoint', LORA: 'LoRA', LoCon: 'LyCORIS', DoRA: 'DoRA', TextualInversion: 'Embedding',
  Hypernetwork: 'Hypernetwork', AestheticGradient: 'Aesthetic', Controlnet: 'ControlNet', Upscaler: 'Upscaler',
  MotionModule: 'Motion', VAE: 'VAE', Poses: 'Poses', Wildcards: 'Wildcards', Workflows: 'Workflow',
  Detection: 'Detection', Other: 'Other',
};
export function typeLabel(t: string): string { return (TYPE_LABEL as Record<string, string>)[t] ?? t; }

export const SORTS = [
  'Highest Rated', 'Most Downloaded', 'Newest', 'Most Liked', 'Most Discussed', 'Most Collected', 'Most Images',
] as const;
export type Sort = typeof SORTS[number];
/** Short labels for narrow pills. */
export const SORT_SHORT: Record<Sort, string> = {
  'Highest Rated': 'Rating', 'Most Downloaded': 'Downloads', Newest: 'Newest', 'Most Liked': 'Likes',
  'Most Discussed': 'Discussed', 'Most Collected': 'Collected', 'Most Images': 'Images',
};

export const PERIODS = ['AllTime', 'Year', 'Month', 'Week', 'Day'] as const;
export type Period = typeof PERIODS[number];
export const PERIOD_LABEL: Record<Period, string> = { AllTime: 'All time', Year: 'Year', Month: 'Month', Week: 'Week', Day: 'Day' };

/** CivitAI's `baseModels` filter takes these label strings exactly. The first row is the board's. */
export const MAIN_BASE_MODELS = [
  'SD 1.5', 'SDXL 1.0', 'Pony', 'Illustrious', 'NoobAI', 'Flux.1 D', 'Flux.1 S', 'SD 3.5',
  'Wan Video 2.2 T2V-A14B', 'Hunyuan Video', 'MiniMax H3',
] as const;
export const MORE_BASE_MODELS = [
  'Anima', 'Krea 2', 'ZImageTurbo', 'ZImageBase', 'Flux.1 Krea', 'Flux.2 D', 'Flux.2 Klein 9B', 'Flux.2 Klein 4B',
  'Qwen', 'Chroma', 'HiDream', 'SD 3', 'SD 2.1', 'SDXL Lightning', 'SDXL Turbo', 'Illustrious 1.0',
  'Wan Video 2.2 I2V-A14B', 'Wan Video 14B t2v', 'LTXV 2.3', 'Other',
] as const;
/** Short label for a chip ("Wan Video 2.2 T2V-A14B" → "Wan 2.2"). */
export function baseModelShort(b: string): string {
  if (b === 'Wan Video 2.2 T2V-A14B') return 'Wan 2.2';
  if (b === 'Wan Video 2.2 I2V-A14B') return 'Wan 2.2 I2V';
  if (b === 'Wan Video 14B t2v') return 'Wan 2.1';
  if (b === 'Hunyuan Video') return 'Hunyuan';
  if (b === 'SDXL 1.0') return 'SDXL';
  if (b === 'ZImageTurbo') return 'Z-Image Turbo';
  if (b === 'ZImageBase') return 'Z-Image';
  return b;
}

/** CivitAI browsing-level bits (the `nsfwLevel` bitfield on models and images). */
export const LEVEL_BITS = { G: 1, PG: 2, PG13: 4, R: 8, X: 16, XXX: 32 } as const;
export const ALL_LEVELS = 63;
/**
 * The board's four-step NSFW picker, each a cumulative mask: a MAX rating, not a filter — every
 * step also shows everything below it. The labels say so ("Up to …"; Donny 10-20: "is this a
 * filter or a level?"); the pickers are titled "Max rating".
 */
export const NSFW_LEVELS = [
  { key: 'none', label: 'Safe only', mask: 1 },
  { key: 'soft', label: 'Up to Soft', mask: 7 },
  { key: 'mature', label: 'Up to Mature', mask: 15 },
  { key: 'x', label: 'Everything', mask: 63 },
] as const;
export type NsfwLevelKey = typeof NSFW_LEVELS[number]['key'];

export function maskForLevel(key: NsfwLevelKey): number {
  return NSFW_LEVELS.find((l) => l.key === key)?.mask ?? 7;
}
/** The picker step a mask belongs to: the smallest level whose mask covers every set bit. */
export function levelForMask(mask: number): NsfwLevelKey {
  const m = mask & ALL_LEVELS;
  for (const l of NSFW_LEVELS) if ((m & ~l.mask) === 0) return l.key;
  return 'x';
}
/** The /images API's `nsfw` enum for a level mask: the highest step the mask reaches. */
export function nsfwEnumForMask(mask: number): 'None' | 'Soft' | 'Mature' | 'X' {
  const m = mask & ALL_LEVELS;
  if (m & (LEVEL_BITS.X | LEVEL_BITS.XXX)) return 'X';
  if (m & LEVEL_BITS.R) return 'Mature';
  if (m & (LEVEL_BITS.PG | LEVEL_BITS.PG13)) return 'Soft';
  return 'None';
}
/** /images answers `nsfwLevel` as a name ("None" | "Soft" | "Mature" | "X"), /models as bits: one bitfield. */
export function levelBits(nsfwLevel: number | string | undefined | null): number {
  if (typeof nsfwLevel === 'number') return nsfwLevel;
  switch (nsfwLevel) {
    case 'None': return LEVEL_BITS.G;
    case 'Soft': return LEVEL_BITS.PG13;
    case 'Mature': return LEVEL_BITS.R;
    case 'X': return LEVEL_BITS.X;
    case 'XXX': case 'Blocked': return LEVEL_BITS.XXX;
    default: return 0;
  }
}
/** Does an item (model or image) with this `nsfwLevel` pass the chosen mask?
 *  An unrated item (0) counts as G. */
export function passesMask(nsfwLevel: number | string | undefined | null, mask: number): boolean {
  const lvl = levelBits(nsfwLevel);
  return lvl === 0 ? (mask & 1) !== 0 : (lvl & mask) !== 0;
}
/** Is an image "adult" relative to the mask (blur it until tapped)? */
export function isBeyondMask(nsfwLevel: number | string | undefined | null, mask: number): boolean {
  const lvl = levelBits(nsfwLevel);
  return lvl !== 0 && (lvl & ~mask) !== 0 && (lvl & mask) === 0;
}

export const COMMERCIAL_USE = ['Image', 'RentCivit', 'Rent', 'Sell'] as const;
export const COMMERCIAL_LABEL: Record<string, string> = { None: 'None', Image: 'Images', RentCivit: 'Rent on Civit', Rent: 'Rent', Sell: 'Sell', SellMerge: 'Sell merges' };
export const FILE_FORMATS = ['SafeTensor', 'PickleTensor', 'GGUF', 'Diffusers', 'Core ML', 'ONNX', 'Other'] as const;
export const FP_PRECISIONS = ['fp16', 'fp8', 'bf16', 'fp32', 'nf4'] as const;
export const CHECKPOINT_TYPES = ['Trained', 'Merge'] as const;

// ── filters ────────────────────────────────────────────────────────────────

export type Tri = 'any' | 'only' | 'hide';

/** Everything the UI can ask for. One object, persisted; `buildModelsQuery` turns it into the URL. */
export interface ModelFilters {
  query: string;
  tag: string;
  username: string;
  types: ModelType[];
  baseModels: string[];
  sort: Sort;
  period: Period;
  /** Browsing-level bitmask (`browsingLevel`); also applied client-side. */
  nsfwMask: number;
  /** Minimum rating (1–5), 0 = any. */
  rating: number;
  /** The local ♥ list (fetched by `ids`). */
  favorites: boolean;
  /** CivitAI's own favourites (`favorites=true`, needs the API key). */
  accountFavorites: boolean;
  followed: boolean;
  hidden: boolean;
  earlyAccess: Tri;
  supportsGeneration: boolean;
  primaryFileOnly: boolean;
  allowNoCredit: boolean;
  allowDerivatives: boolean;
  allowDifferentLicenses: boolean;
  /** Required commercial permissions (OR on the API). */
  commercialUse: string[];
  fileFormats: string[];
  /** Client-side: keep models with a file in one of these precisions. */
  fp: string[];
  checkpointType: '' | 'Trained' | 'Merge';
  /** Client-side, against the servers' files. */
  installed: Tri;
  /** `ids` — the local favourites list is fetched this way. */
  ids: number[];
  catalog: 'civitai' | 'red';
}

export const DEFAULT_FILTERS: ModelFilters = {
  // AllTime + X (10-19): with `period=Month` CivitAI answers a search like "pony diffusion" with 0
  // models, and the pod is for adult work, so a Soft default hid nearly every cover behind a pill.
  query: '', tag: '', username: '', types: [], baseModels: [], sort: 'Most Downloaded', period: 'AllTime',
  nsfwMask: ALL_LEVELS, rating: 0, favorites: false, accountFavorites: false, followed: false, hidden: false, earlyAccess: 'any',
  supportsGeneration: false, primaryFileOnly: false, allowNoCredit: false, allowDerivatives: false,
  allowDifferentLicenses: false, commercialUse: [], fileFormats: [], fp: [], checkpointType: '',
  installed: 'any', ids: [], catalog: 'civitai',
};

/** Saved filters from an older build can hold values the API now rejects. */
export function sanitizeFilters(raw: Partial<ModelFilters> | null | undefined): ModelFilters {
  const f: ModelFilters = { ...DEFAULT_FILTERS, ...(raw ?? {}) };
  if (!(SORTS as readonly string[]).includes(f.sort)) f.sort = DEFAULT_FILTERS.sort;
  if (!(PERIODS as readonly string[]).includes(f.period)) f.period = DEFAULT_FILTERS.period;
  f.types = (Array.isArray(f.types) ? f.types : []).filter((t) => (MODEL_TYPES as readonly string[]).includes(t));
  f.baseModels = Array.isArray(f.baseModels) ? f.baseModels.filter((b) => typeof b === 'string') : [];
  f.nsfwMask = typeof f.nsfwMask === 'number' && f.nsfwMask > 0 ? f.nsfwMask & ALL_LEVELS : DEFAULT_FILTERS.nsfwMask;
  f.ids = Array.isArray(f.ids) ? f.ids.filter((n) => Number.isInteger(n)) : [];
  for (const k of ['commercialUse', 'fileFormats', 'fp'] as const) if (!Array.isArray(f[k])) f[k] = [];
  return f;
}

export interface QueryOptions {
  limit?: number;
  cursor?: string | null;
  page?: number;
}

/** Append `key=v` for each value (CivitAI reads repeated keys as arrays). */
function appendAll(qp: URLSearchParams, key: string, values: readonly string[] | undefined) {
  for (const v of values ?? []) if (v) qp.append(key, v);
}

/**
 * The exact query string for GET /api/v1/models. Only non-default values are sent; the
 * client-side-only filters (`fp`, `installed`, `earlyAccess: 'hide'`) do not appear.
 * `nsfw` is sent both ways (the API hides every NSFW-flagged model unless asked outright).
 */
export function buildModelsQuery(f: ModelFilters, o: QueryOptions = {}): string {
  const qp = new URLSearchParams();
  qp.set('limit', String(Math.max(1, Math.min(100, o.limit ?? 40))));
  if (o.cursor) qp.set('cursor', o.cursor);
  else if (o.page && o.page > 1) qp.set('page', String(o.page));
  if (f.query.trim()) qp.set('query', f.query.trim());
  if (f.tag.trim()) qp.set('tag', f.tag.trim());
  if (f.username.trim()) qp.set('username', f.username.trim());
  appendAll(qp, 'types', f.types);
  appendAll(qp, 'baseModels', f.baseModels);
  qp.set('sort', f.sort);
  // A text search is always all-time: CivitAI returns 0 results for `query=…&period=Month`
  // (checked 10-19 with "pony diffusion" and "juggernaut").
  if (!f.query.trim()) qp.set('period', f.period);
  if (f.rating > 0) qp.set('rating', String(f.rating));
  if (f.accountFavorites) qp.set('favorites', 'true');
  if (f.followed) qp.set('followed', 'true');
  if (f.hidden) qp.set('hidden', 'true');
  if (f.primaryFileOnly) qp.set('primaryFileOnly', 'true');
  if (f.allowNoCredit) qp.set('allowNoCredit', 'true');
  if (f.allowDerivatives) qp.set('allowDerivatives', 'true');
  if (f.allowDifferentLicenses) qp.set('allowDifferentLicenses', 'true');
  appendAll(qp, 'allowCommercialUse', f.commercialUse);
  if (f.earlyAccess === 'only') qp.set('earlyAccess', 'true');
  if (f.supportsGeneration) qp.set('supportsGeneration', 'true');
  if (f.checkpointType) qp.set('checkpointType', f.checkpointType);
  appendAll(qp, 'fileFormats', f.fileFormats);
  const mask = f.nsfwMask & ALL_LEVELS;
  // None = G only: ask the API to drop NSFW models outright. Otherwise only the flag goes out:
  // /models answers HTTP 400 (ZodError, "expected number") to a `browsingLevel` query param
  // (checked 10-19), so the level mask is enforced client-side only. /images does accept it.
  qp.set('nsfw', mask > 1 ? 'true' : 'false');
  appendAll(qp, 'ids', f.ids.map(String));
  return qp.toString();
}

export const CIVITAI_API = 'https://civitai.com/api/v1';
export const CIVITAI_RED_API = 'https://civitai.red/api/v1';
export function apiBase(catalog: ModelFilters['catalog']): string { return catalog === 'red' ? CIVITAI_RED_API : CIVITAI_API; }
export function modelsUrl(f: ModelFilters, o: QueryOptions = {}): string { return `${apiBase(f.catalog)}/models?${buildModelsQuery(f, o)}`; }

// ── images ─────────────────────────────────────────────────────────────────

export const IMAGE_SORTS = ['Most Reactions', 'Most Comments', 'Newest'] as const;
export type ImageSort = typeof IMAGE_SORTS[number];

export interface ImagesQuery {
  modelId?: number;
  modelVersionId?: number;
  username?: string;
  postId?: number;
  /** 'all' = omit (both); true = only NSFW; false = only SFW. */
  nsfw?: boolean | 'all';
  /** Browsing-level bitmask (`browsingLevel`). */
  nsfwMask?: number;
  sort?: ImageSort;
  period?: Period;
  limit?: number;
  cursor?: string | null;
  page?: number;
  /** Ask for generation `meta` (without it the API sends `meta: null`). */
  withMeta?: boolean;
}

/** The query string for GET /api/v1/images. */
export function buildImagesQuery(q: ImagesQuery): string {
  const qp = new URLSearchParams();
  qp.set('limit', String(Math.max(1, Math.min(200, q.limit ?? 20))));
  if (q.modelId) qp.set('modelId', String(q.modelId));
  if (q.modelVersionId) qp.set('modelVersionId', String(q.modelVersionId));
  if (q.username) qp.set('username', q.username);
  if (q.postId) qp.set('postId', String(q.postId));
  // /images hides every adult picture unless asked outright (checked 10-20: no `nsfw` = 80 safe
  // pictures, `nsfw=X` = 100 mixed for the same version), so the level mask always goes out as the
  // API's enum too; an explicit true / false wins.
  if (q.nsfw === true) qp.set('nsfw', 'true');
  else if (q.nsfw === false) qp.set('nsfw', 'false');
  else qp.set('nsfw', nsfwEnumForMask(q.nsfwMask ?? ALL_LEVELS));
  if (q.nsfwMask && q.nsfwMask !== ALL_LEVELS) qp.set('browsingLevel', String(q.nsfwMask & ALL_LEVELS));
  if (q.sort) qp.set('sort', q.sort);
  if (q.period) qp.set('period', q.period);
  if (q.cursor) qp.set('cursor', q.cursor);
  else if (q.page && q.page > 1) qp.set('page', String(q.page));
  if (q.withMeta !== false) qp.set('withMeta', 'true');
  return qp.toString();
}

/** /api/v1/tags and /api/v1/creators share one shape. */
export function buildListQuery(q: { query?: string; limit?: number; page?: number }): string {
  const qp = new URLSearchParams();
  qp.set('limit', String(Math.max(1, Math.min(200, q.limit ?? 20))));
  if (q.query?.trim()) qp.set('query', q.query.trim());
  if (q.page && q.page > 1) qp.set('page', String(q.page));
  return qp.toString();
}

// ── client-side narrowing of a page ────────────────────────────────────────

/** The bits of a CivitAI model this module reads (structural, so it stays import-free). */
export interface FileLike {
  name: string;
  hashes?: Partial<Record<string, string | undefined>>;
  metadata?: { fp?: string | null; format?: string | null; size?: string | null } | null;
  primary?: boolean;
  type?: string;
}
export interface VersionLike {
  id: number;
  files?: FileLike[];
  earlyAccessDeadline?: string | null;
  paidAccess?: { permanent?: boolean; endsAt?: string | null } | null;
  availability?: string;
}
export interface ModelLike {
  id: number;
  nsfwLevel?: number;
  modelVersions?: VersionLike[];
  hasActivePaidAccess?: boolean;
}

/** Is any version of the model still in paid Early Access? */
export function isEarlyAccess(m: ModelLike): boolean {
  if (m.hasActivePaidAccess) return true;
  const now = Date.now();
  return (m.modelVersions ?? []).some((v) => {
    if (v.availability === 'EarlyAccess') return true;
    if (v.paidAccess?.permanent) return true;
    const ends = v.paidAccess?.endsAt ?? v.earlyAccessDeadline;
    return !!ends && new Date(ends).getTime() > now;
  });
}

/** Does the model have a file in one of the asked precisions ("fp16", "fp8", …)? */
export function hasPrecision(m: ModelLike, fps: readonly string[]): boolean {
  if (!fps.length) return true;
  const want = new Set(fps.map((s) => s.toLowerCase()));
  return (m.modelVersions ?? []).some((v) => (v.files ?? []).some((f) => {
    const fp = (f.metadata?.fp ?? '').toLowerCase();
    return !!fp && want.has(fp);
  }));
}

/**
 * The filters the API cannot do, applied to one loaded page: the browsing-level mask (unauthed
 * calls ignore it server-side), "hide early access", the fp precision, and installed-or-not.
 */
export function narrowPage<M extends ModelLike>(items: M[], f: ModelFilters, installedOf?: (m: M) => InstalledState): M[] {
  return items.filter((m) => {
    if (!passesMask(m.nsfwLevel, f.nsfwMask)) return false;
    if (f.earlyAccess === 'hide' && isEarlyAccess(m)) return false;
    if (!hasPrecision(m, f.fp)) return false;
    if (f.installed !== 'any' && installedOf) {
      const inst = installedOf(m).installed > 0;
      if ((f.installed === 'only') !== inst) return false;
    }
    return true;
  });
}

// ── installed matching ─────────────────────────────────────────────────────

export interface InstalledIndex {
  /** Every hashed local file's hash, upper-cased (any algorithm the node stores). */
  hashes: Set<string>;
  /** Every model file name the servers list (`SDXL/foo.safetensors`, `foo.pt`, embeddings without extension). */
  names: Set<string>;
  /** Base names (no folder) of the above, for a cheap suffix match. */
  baseNames: Set<string>;
}

export function buildInstalledIndex(localHashes: Iterable<string>, serverNames: Iterable<string>): InstalledIndex {
  const hashes = new Set<string>();
  for (const h of localHashes) if (h) hashes.add(h.toUpperCase());
  const names = new Set<string>();
  const baseNames = new Set<string>();
  for (const n of serverNames) {
    if (!n) continue;
    names.add(n);
    const base = n.split('/').pop() ?? n;
    baseNames.add(base);
    baseNames.add(base.replace(/\.[^.]+$/, ''));
  }
  return { hashes, names, baseNames };
}

/** A CivitAI file is on a server when one of its hashes is hashed locally, or a server lists its name. */
export function fileInstalled(f: FileLike, idx: InstalledIndex): boolean {
  for (const h of Object.values(f.hashes ?? {})) if (h && idx.hashes.has(h.toUpperCase())) return true;
  if (!f.name) return false;
  if (idx.names.has(f.name)) return true;
  const base = f.name.split('/').pop() ?? f.name;
  return idx.baseNames.has(base) || idx.baseNames.has(base.replace(/\.[^.]+$/, ''));
}

export function versionInstalled(v: VersionLike, idx: InstalledIndex): boolean {
  return (v.files ?? []).some((f) => (f.type === 'Model' || f.type == null || f.primary) && fileInstalled(f, idx));
}

export interface InstalledState {
  /** How many versions have a file on a server. */
  installed: number;
  total: number;
  /** The id of the newest installed version, if any. */
  versionId?: number;
}

export function modelInstalled(m: ModelLike, idx: InstalledIndex): InstalledState {
  const versions = m.modelVersions ?? [];
  let installed = 0;
  let versionId: number | undefined;
  for (const v of versions) {
    if (versionInstalled(v, idx)) { installed++; if (versionId == null) versionId = v.id; }
  }
  return { installed, total: versions.length, versionId };
}

/** Which ComfyUI folder a CivitAI model type lands in (the download manager's default). */
export function folderForType(type: string): string {
  switch (type) {
    case 'Checkpoint': return 'checkpoints';
    case 'LORA': case 'LoCon': case 'DoRA': return 'loras';
    case 'TextualInversion': return 'embeddings';
    case 'Hypernetwork': return 'hypernetworks';
    case 'Controlnet': return 'controlnet';
    case 'Upscaler': return 'upscale_models';
    case 'VAE': return 'vae';
    case 'MotionModule': return 'animatediff_models';
    default: return 'other';
  }
}

// ── active-filter summary ──────────────────────────────────────────────────

export type FilterKey = keyof ModelFilters;
export interface ActiveFilter { key: FilterKey; label: string }

/** The filters that differ from the defaults, as removable chips (sort is not a filter). */
export function activeFilters(f: ModelFilters): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const d = DEFAULT_FILTERS;
  if (f.query.trim()) out.push({ key: 'query', label: `“${f.query.trim()}”` });
  if (f.types.length) out.push({ key: 'types', label: f.types.map(typeLabel).join(', ') });
  if (f.baseModels.length) out.push({ key: 'baseModels', label: f.baseModels.map(baseModelShort).join(', ') });
  if (f.period !== d.period) out.push({ key: 'period', label: PERIOD_LABEL[f.period] });
  if (f.nsfwMask !== d.nsfwMask) out.push({ key: 'nsfwMask', label: NSFW_LEVELS.find((l) => l.key === levelForMask(f.nsfwMask))?.label ?? 'NSFW' });
  if (f.tag.trim()) out.push({ key: 'tag', label: `#${f.tag.trim()}` });
  if (f.username.trim()) out.push({ key: 'username', label: `by ${f.username.trim()}` });
  if (f.rating > 0) out.push({ key: 'rating', label: `${f.rating}★+` });
  if (f.favorites) out.push({ key: 'favorites', label: 'Favourites' });
  if (f.accountFavorites) out.push({ key: 'accountFavorites', label: 'CivitAI favourites' });
  if (f.followed) out.push({ key: 'followed', label: 'Followed' });
  if (f.hidden) out.push({ key: 'hidden', label: 'Hidden' });
  if (f.earlyAccess !== 'any') out.push({ key: 'earlyAccess', label: f.earlyAccess === 'only' ? 'Early access' : 'No early access' });
  if (f.supportsGeneration) out.push({ key: 'supportsGeneration', label: 'Made on-site' });
  if (f.primaryFileOnly) out.push({ key: 'primaryFileOnly', label: 'Primary file' });
  if (f.allowNoCredit) out.push({ key: 'allowNoCredit', label: 'No credit' });
  if (f.allowDerivatives) out.push({ key: 'allowDerivatives', label: 'Derivatives' });
  if (f.allowDifferentLicenses) out.push({ key: 'allowDifferentLicenses', label: 'Relicense' });
  if (f.commercialUse.length) out.push({ key: 'commercialUse', label: f.commercialUse.map((c) => COMMERCIAL_LABEL[c] ?? c).join(', ') });
  if (f.fileFormats.length) out.push({ key: 'fileFormats', label: f.fileFormats.join(', ') });
  if (f.fp.length) out.push({ key: 'fp', label: f.fp.join(', ') });
  if (f.checkpointType) out.push({ key: 'checkpointType', label: f.checkpointType });
  if (f.installed !== 'any') out.push({ key: 'installed', label: f.installed === 'only' ? 'Installed' : 'Not installed' });
  if (f.ids.length) out.push({ key: 'ids', label: `${f.ids.length} ids` });
  return out;
}

export function activeFilterCount(f: ModelFilters): number { return activeFilters(f).length; }

/** A new filter set with one filter back at its default. */
export function clearFilter(f: ModelFilters, key: FilterKey): ModelFilters {
  return { ...f, [key]: DEFAULT_FILTERS[key] };
}

/** Everything back to the defaults except the catalog. */
export function clearAllFilters(f: ModelFilters): ModelFilters {
  return { ...DEFAULT_FILTERS, catalog: f.catalog, sort: f.sort };
}

/** Toggle one value in a list filter. */
export function toggleIn<T>(list: readonly T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

// ── small formatting (pure, for tiles and the panel) ───────────────────────

export function fmtCount(n: number | undefined | null): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(v);
}

export function fmtSizeKB(kb: number | undefined | null): string {
  if (!kb) return '';
  const mb = kb / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/** The first 8 of the AutoV2 / SHA256 hash, for the file line. */
export function shortHash(hashes: FileLike['hashes']): string {
  const h = hashes?.AutoV2 ?? hashes?.SHA256 ?? Object.values(hashes ?? {}).find(Boolean) ?? '';
  return (h ?? '').slice(0, 8).toLowerCase();
}

// ── favourites / followed without an API key ───────────────────────────────

export interface SearchPlan {
  /** The filters to send (local favourites become `ids`; `favorites`/`followed` flags only with a key). */
  filters: ModelFilters;
  /** Without a key, "Followed creators" = one request per followed username, merged. */
  usernames?: string[];
  /** Nothing to fetch (favourites on, none saved). */
  empty?: boolean;
}

/**
 * The local ♥ list is the durable one (it lives in the browser, the pod does not): "Favourites"
 * is always fetched by `ids`. CivitAI's account favourites and `followed` need the key; without
 * one, followed creators come from the local Follow list, one request per username.
 */
export function planSearch(f: ModelFilters, ctx: { hasKey: boolean; favouriteIds: readonly number[]; followedUsers: readonly string[] }): SearchPlan {
  let filters = f;
  if (f.favorites) {
    if (!ctx.favouriteIds.length) return { filters: { ...f, favorites: false }, empty: true };
    filters = { ...filters, favorites: false, ids: [...new Set([...f.ids, ...ctx.favouriteIds])] };
  }
  if (f.accountFavorites && !ctx.hasKey) filters = { ...filters, accountFavorites: false };
  if (f.followed && !ctx.hasKey) {
    filters = { ...filters, followed: false };
    if (!ctx.followedUsers.length) return { filters, empty: true };
    if (!filters.username.trim()) return { filters, usernames: ctx.followedUsers.slice(0, 8) };
  }
  return { filters };
}

// ── the picker's kind lock ─────────────────────────────────────────────────

/** What a step's picker asks for; `vae` / `upscale` map to CivitAI's VAE / Upscaler types. */
export type ModelKindKey = 'checkpoint' | 'lora' | 'embedding' | 'controlnet' | 'vae' | 'upscale';

export const KIND_TYPES: Record<ModelKindKey, ModelType[]> = {
  checkpoint: ['Checkpoint'],
  lora: ['LORA', 'LoCon', 'DoRA'],
  embedding: ['TextualInversion'],
  controlnet: ['Controlnet'],
  vae: ['VAE'],
  upscale: ['Upscaler'],
};
export const KIND_LABEL: Record<ModelKindKey, string> = { checkpoint: 'Checkpoints', lora: 'LoRAs', embedding: 'Embeddings', controlnet: 'ControlNets', vae: 'VAEs', upscale: 'Upscalers' };

export function kindTypes(kind: ModelKindKey | null | undefined): ModelType[] | null {
  return kind ? KIND_TYPES[kind] : null;
}

/** The filters a search really uses: the picker's kind replaces the type chips; the first chosen tag is the API's one `tag`. */
export function effectiveFilters(f: ModelFilters, kind: ModelKindKey | null | undefined, selectedTags: readonly string[]): ModelFilters {
  const types = kindTypes(kind);
  return { ...f, types: types ?? f.types, tag: selectedTags[0] ?? f.tag };
}
