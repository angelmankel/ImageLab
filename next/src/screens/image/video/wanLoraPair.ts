/**
 * Wan 2.2 LoRA pairs (Donny, 10-20: "make high/low noise loras both show in the same component").
 * A Wan 2.2 LoRA ships as a HIGH-noise and a LOW-noise file; one `VideoLora` holds both (`name` =
 * the high file, `nameLow` = the low one) and the card shows both. Pure: which of a CivitAI
 * version's files are the pair, and what one pick of that version sets on the entry and what
 * must still download. No React, no stores: tests/wanLoraPair.test.cjs.
 */
import { baseName, findInstalledName, type PickFileLike, type PickLike } from '../model/pendingLogic';

const MODEL_EXT = /\.(safetensors|ckpt|pt|pth|bin|sft|gguf)$/i;

/**
 * 'high' / 'low' when the file name says which noise expert it is for ("…_high_noise", "HighNoise",
 * "anime_low"); null when it says neither or both ("…highlow_merged"). A letter right before or
 * after the word does not count ("flow", "slow", "lowrank" are not low).
 */
export function noiseOf(name: string): 'high' | 'low' | null {
  const n = baseName(name);
  const says = (w: string) => new RegExp(`(^|[^a-z])${w}[-_ .]?(noise)?(?![a-z])`, 'i').test(n);
  const high = says('high'), low = says('low');
  return high && !low ? 'high' : low && !high ? 'low' : null;
}

const isModelFile = (f: PickFileLike) => (f.type == null || f.type === 'Model') && MODEL_EXT.test(f.name);

/** The high and low file of a version when it ships as a split pair; null otherwise. */
export function splitHighLow<F extends PickFileLike>(files: readonly F[] | undefined): { high: F; low: F } | null {
  const model = (files ?? []).filter(isModelFile);
  const high = model.find((f) => noiseOf(f.name) === 'high');
  const low = model.find((f) => noiseOf(f.name) === 'low');
  return high && low ? { high, low } : null;
}

/** The file the pod's version download fetches (ImageLabCore `_pick_file`): the primary, else the first safetensors, else the first. */
export function versionDownloadFile<F extends PickFileLike>(files: readonly F[] | undefined): F | undefined {
  const all = files ?? [];
  return all.find((f) => f.primary) ?? all.find((f) => /\.safetensors$/i.test(f.name)) ?? all[0];
}

/** Which slot a pick is for: a new entry, an entry's high (main) file, or its low file. */
export type PairSlot = 'add' | 'high' | 'low';

export interface PairPlan {
  /** The high (or only) file; undefined = leave the slot alone. */
  name?: string;
  /** The low file; null = none (a single-file add); undefined = leave the slot alone. */
  nameLow?: string | null;
  /** Files no server lists yet: a pending record each. `downloadUrl` when the version download
   *  (the pod fetches only the version's primary file) does not bring this one. */
  pending: Array<{ file: string; downloadUrl?: string }>;
}

/**
 * What one pick sets. A version with a split pair fills both slots (on 'add' / 'high') or just the
 * low one (on 'low'); a single-file version fills the slot picked for. Installed files take the
 * server's name; the rest the expected name plus a pending entry.
 */
export function planPairPick(pick: PickLike, slot: PairSlot, serverLoras: readonly string[]): PairPlan {
  const files: PickFileLike[] = pick.version.files ?? (pick.version.file ? [pick.version.file] : []);
  const pair = splitHighLow(files);
  const viaVersion = versionDownloadFile(files);
  const pending: PairPlan['pending'] = [];
  const resolve = (f: PickFileLike): string => {
    const installed = findInstalledName(serverLoras, baseName(f.name), 'lora');
    if (installed) return installed;
    const file = baseName(f.name);
    pending.push({ file, ...(f !== viaVersion && f.downloadUrl ? { downloadUrl: f.downloadUrl } : {}) });
    return file;
  };
  if (pair) {
    if (slot === 'low') return { nameLow: resolve(pair.low), pending };
    return { name: resolve(pair.high), nameLow: resolve(pair.low), pending };
  }
  const single = pick.installed && pick.file ? pick.file : viaVersion ? resolve(viaVersion) : undefined;
  if (single === undefined) return { pending };
  if (slot === 'low') return { nameLow: single, pending };
  return slot === 'add' ? { name: single, nameLow: null, pending } : { name: single, pending };
}

/** The eyebrow over the card's main file: what that file is, by the entry's state. */
export function highSlotLabel(l: { nameLow?: string | null; expert: 'high' | 'low' | 'both' }): string {
  if (l.nameLow) return 'High noise';
  return l.expert === 'high' ? 'High noise' : l.expert === 'low' ? 'Low noise' : 'Both experts · one file';
}
