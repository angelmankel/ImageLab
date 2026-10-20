/**
 * "Parameters before download" (models-picker brief, item 5), the pure part: a model picked
 * before it is on the pod is a pending record keyed by kind + expected file name; its parameters
 * are editable at once; it lands (becomes a real, enabled entry) when a server's list carries the
 * file. Imports nothing, so `tests/pendingLogic.test.cjs` loads it from source.
 */

/** Every kind the list component knows (`kindSpecs.ModelKind` is this type). */
export type PendingKind = 'checkpoint' | 'lora' | 'embedding' | 'controlnet' | 'vae' | 'clip' | 'upscale' | 'other';

/** The `ServerInfo` lists a kind's files can appear in. */
export type ServerList = 'models' | 'diffusionModels' | 'loras' | 'embeddings' | 'controlnets' | 'vaes' | 'textEncoders' | 'upscaleModels';

export interface PendingRecord {
  /** `kind:file` (file lower-cased) — one record per kind + file. */
  key: string;
  kind: PendingKind;
  /** The file name a server will list once downloaded (embeddings: no extension). */
  file: string;
  /** The main-store entry that waits for it (LoRA / embedding / ControlNet; a checkpoint has none). */
  entryId?: string;
  modelId: number;
  versionId: number;
  modelName: string;
  versionName: string;
  modelType: string;
  baseModel?: string;
  trainedWords: string[];
  thumb?: string;
  /** The user's On/Off choice, restored when the file lands (the store entry stays off meanwhile). */
  userOn: boolean;
  /** The pending checkpoint's merge ratio (other kinds keep their weight on the store entry). */
  weight: number;
  addedAt: number;
  /** Which step's store holds the waiting entry: undefined = the Image step's workflow; 'video' / 'workflow' otherwise. */
  scope?: string;
  /** The ComfyUI folder the download goes to when the kind's default is wrong (Wan experts: `diffusion_models`). */
  folder?: string;
  /** The server list the file will show up in when the kind's default is wrong. */
  list?: ServerList;
}

/** What a pick must carry for a record (structural: the modal's `ModelPick` fits). */
export interface PickLike {
  installed: boolean;
  file: string | null;
  model: { id: number; name: string; type: string; baseModel?: string };
  version: { id: number; name: string; trainedWords: string[]; baseModel?: string; file?: { name: string } };
  thumb?: string;
}

export const stripExt = (name: string): string => name.replace(/\.(safetensors|ckpt|pt|pth|bin|sft|gguf)$/i, '');
export const baseName = (name: string): string => name.split('/').pop() ?? name;

/** The name a server will list the picked file under: its own name, no folder; embeddings lose the extension. */
export function expectedFileName(kind: PendingKind, pick: Pick<PickLike, 'file' | 'version'>): string {
  const raw = baseName(pick.file ?? pick.version.file?.name ?? '');
  return kind === 'embedding' ? stripExt(raw) : raw;
}

export function pendingKey(kind: PendingKind, file: string): string {
  return `${kind}:${file.toLowerCase()}`;
}

export interface RecordHome { scope?: string; folder?: string; list?: ServerList }

export function recordFromPick(kind: PendingKind, pick: PickLike, now: number, entryId?: string, userOn = true, weight = 0.5, home: RecordHome = {}): PendingRecord {
  const file = expectedFileName(kind, pick);
  const r: PendingRecord = {
    key: pendingKey(kind, file), kind, file, entryId,
    modelId: pick.model.id, versionId: pick.version.id, modelName: pick.model.name, versionName: pick.version.name,
    modelType: pick.model.type, baseModel: pick.version.baseModel ?? pick.model.baseModel,
    trainedWords: [...(pick.version.trainedWords ?? [])], thumb: pick.thumb, userOn, weight, addedAt: now,
  };
  if (home.scope) r.scope = home.scope;
  if (home.folder) r.folder = home.folder;
  if (home.list) r.list = home.list;
  return r;
}

/**
 * The name a server lists `expected` under, if any: exact, under a subfolder (`SDXL/x.safetensors`),
 * or (embeddings are listed without their extension) by stem. Case-insensitive on the base name.
 */
export function findInstalledName(list: readonly string[], expected: string, kind: PendingKind): string | undefined {
  if (!expected) return undefined;
  const want = expected.toLowerCase();
  const wantStem = stripExt(want);
  for (const n of list) {
    const b = baseName(n).toLowerCase();
    if (b === want) return n;
    if (kind === 'embedding' && stripExt(b) === wantStem) return n;
  }
  return undefined;
}

/**
 * Records that have landed (with the server's name for the file) and those still waiting. `lists`
 * is keyed by kind (the kind's default list) and, for records that name one, by `ServerList`.
 */
export function reconcile(records: readonly PendingRecord[], lists: Partial<Record<string, readonly string[]>>): { landed: Array<{ record: PendingRecord; file: string }>; waiting: PendingRecord[] } {
  const landed: Array<{ record: PendingRecord; file: string }> = [];
  const waiting: PendingRecord[] = [];
  for (const r of records) {
    const list = (r.list && lists[r.list]) ?? lists[r.kind] ?? [];
    const file = findInstalledName(list, r.file, r.kind);
    if (file) landed.push({ record: r, file }); else waiting.push(r);
  }
  return { landed, waiting };
}

/** The ComfyUI folder the download manager puts each kind in. */
export function folderForKind(kind: PendingKind): string {
  switch (kind) {
    case 'checkpoint': return 'checkpoints';
    case 'lora': return 'loras';
    case 'embedding': return 'embeddings';
    case 'controlnet': return 'controlnet';
    case 'vae': return 'vae';
    case 'clip': return 'text_encoders';
    case 'upscale': return 'upscale_models';
    default: return 'other';
  }
}

/** The `ServerInfo` list a kind's files are listed in by default. */
export function listForKind(kind: PendingKind): ServerList {
  switch (kind) {
    case 'checkpoint': return 'models';
    case 'lora': return 'loras';
    case 'embedding': return 'embeddings';
    case 'controlnet': return 'controlnets';
    case 'vae': return 'vaes';
    case 'clip': return 'textEncoders';
    case 'upscale': return 'upscaleModels';
    default: return 'models';
  }
}

/** Where a pending record's download goes and which list it lands in (its own say, else the kind's default). */
export const recordFolder = (r: Pick<PendingRecord, 'kind' | 'folder'>): string => r.folder ?? folderForKind(r.kind);

/** True when a named file is not on any server list yet (an empty list = not known, never "missing"). */
export function isMissing(files: readonly string[], name: string, kind: PendingKind): boolean {
  if (!name || !files.length) return false;
  return !findInstalledName(files, name, kind);
}

/** Two file names are the same file: equal base names, case ignored (embeddings: by stem). */
export function sameFile(a: string, b: string, kind: PendingKind = 'lora'): boolean {
  if (!a || !b) return false;
  const x = baseName(a).toLowerCase();
  const y = baseName(b).toLowerCase();
  return x === y || (kind === 'embedding' && stripExt(x) === stripExt(y));
}

export interface DownloadRowLike { version_id: number; status: 'downloading' | 'completed' | 'failed' | 'cancelled'; percent: number; error?: string | null }

/** The manager's state for a version across servers: the active one first, else the latest word. */
export function downloadProgress(rows: readonly DownloadRowLike[], versionId: number): { status: DownloadRowLike['status']; percent: number; error?: string | null } | null {
  const mine = rows.filter((r) => r.version_id === versionId);
  if (!mine.length) return null;
  const active = mine.find((r) => r.status === 'downloading');
  const r = active ?? mine.find((r) => r.status === 'completed') ?? mine.find((r) => r.status === 'failed') ?? mine[0];
  return { status: r.status, percent: Math.max(0, Math.min(100, r.percent || 0)), error: r.error };
}

export interface MetaLike { name?: string; images: string[]; trainedWords: string[]; civitaiUrl?: string; baseModel?: string; resolved: boolean }

/** The hash cache's data when it has any, else what the pick told us. */
export function metaWithPending<M extends MetaLike>(meta: M, record: PendingRecord | undefined): M {
  if (!record || meta.name) return meta;
  return {
    ...meta,
    name: record.modelName,
    images: meta.images.length ? meta.images : record.thumb ? [record.thumb] : [],
    trainedWords: meta.trainedWords.length ? meta.trainedWords : record.trainedWords,
    civitaiUrl: meta.civitaiUrl ?? `https://civitai.com/models/${record.modelId}?modelVersionId=${record.versionId}`,
    baseModel: meta.baseModel ?? record.baseModel,
  };
}
