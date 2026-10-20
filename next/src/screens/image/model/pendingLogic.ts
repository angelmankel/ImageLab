/**
 * "Parameters before download" (models-picker brief, item 5), the pure part: a model picked
 * before it is on the pod is a pending record keyed by kind + expected file name; its parameters
 * are editable at once; it lands (becomes a real, enabled entry) when a server's list carries the
 * file. Imports nothing, so `tests/pendingLogic.test.cjs` loads it from source.
 */

export type PendingKind = 'checkpoint' | 'lora' | 'embedding' | 'controlnet';

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

export function recordFromPick(kind: PendingKind, pick: PickLike, now: number, entryId?: string, userOn = true, weight = 0.5): PendingRecord {
  const file = expectedFileName(kind, pick);
  return {
    key: pendingKey(kind, file), kind, file, entryId,
    modelId: pick.model.id, versionId: pick.version.id, modelName: pick.model.name, versionName: pick.version.name,
    modelType: pick.model.type, baseModel: pick.version.baseModel ?? pick.model.baseModel,
    trainedWords: [...(pick.version.trainedWords ?? [])], thumb: pick.thumb, userOn, weight, addedAt: now,
  };
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

/** Records that have landed (with the server's name for the file) and those still waiting. */
export function reconcile(records: readonly PendingRecord[], listsByKind: Record<PendingKind, readonly string[]>): { landed: Array<{ record: PendingRecord; file: string }>; waiting: PendingRecord[] } {
  const landed: Array<{ record: PendingRecord; file: string }> = [];
  const waiting: PendingRecord[] = [];
  for (const r of records) {
    const file = findInstalledName(listsByKind[r.kind] ?? [], r.file, r.kind);
    if (file) landed.push({ record: r, file }); else waiting.push(r);
  }
  return { landed, waiting };
}

/** The ComfyUI folder the download manager puts each kind in. */
export function folderForKind(kind: PendingKind): string {
  return kind === 'checkpoint' ? 'checkpoints' : kind === 'lora' ? 'loras' : kind === 'embedding' ? 'embeddings' : 'controlnet';
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
