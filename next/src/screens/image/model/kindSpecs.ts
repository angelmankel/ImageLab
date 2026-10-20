/**
 * The model kinds the universal list knows (rule 4: ONE component for every model slot of every
 * step) and what each kind looks like: tab label, "a LoRA", the weight slider, the On/Off switch,
 * which server list offers its files, which big-modal kind browses it. Pure — no React, no stores
 * — so `tests/modelKinds.test.cjs` loads it from source. A step's api may hand the list a
 * customised copy of a spec (`{ ...KINDS.checkpoint, label: 'Experts', weight: undefined }`).
 */
import type { PendingKind, ServerList } from './pendingLogic';
import { folderForKind, listForKind } from './pendingLogic';

export type ModelKind = PendingKind;

/** The kinds the big models modal can be opened for (CivitAI type filters); others get the server-file grid. */
export type PickKind = 'checkpoint' | 'lora' | 'embedding' | 'controlnet' | 'vae' | 'upscale';

export const ALL_KINDS: readonly ModelKind[] = ['checkpoint', 'lora', 'embedding', 'controlnet', 'vae', 'clip', 'upscale', 'other'];
/** What the Image step shows. */
export const IMAGE_KINDS: readonly ModelKind[] = ['checkpoint', 'lora', 'embedding', 'controlnet'];

export interface WeightSpec { label: string; min: number; max: number; step: number; presets: number[] }

export interface KindSpec {
  key: ModelKind;
  /** The tab label. */
  label: string;
  /** "a LoRA" — for empty hints and the picker title. */
  one: string;
  /** The main slider under the entry; none = no slider. */
  weight?: WeightSpec;
  /** The entry can be switched off without being removed. */
  hasSwitch: boolean;
  /** Which `ServerInfo` list offers the files. */
  list: ServerList;
  /** The ComfyUI folder a download of this kind goes to. */
  folder: string;
  /** The big modal's kind (CivitAI type filter); null = no CivitAI mapping, the server-file grid instead. */
  pick: PickKind | null;
  /** CivitAI base models the modal is narrowed to while open (the Video step: Wan / H3). */
  baseModels?: string[];
}

const STRENGTH: WeightSpec = { label: 'Strength', min: 0, max: 2, step: 0.05, presets: [0.5, 0.8, 1, 1.2] };

export const KINDS: Record<ModelKind, KindSpec> = {
  checkpoint: { key: 'checkpoint', label: 'Checkpoint', one: 'checkpoint', weight: { label: 'Merge ratio', min: 0, max: 1, step: 0.01, presets: [0.25, 0.5, 0.75] }, hasSwitch: false, list: 'models', folder: folderForKind('checkpoint'), pick: 'checkpoint' },
  lora: { key: 'lora', label: 'LoRAs', one: 'LoRA', weight: STRENGTH, hasSwitch: true, list: 'loras', folder: folderForKind('lora'), pick: 'lora' },
  embedding: { key: 'embedding', label: 'Embeds', one: 'embedding', weight: STRENGTH, hasSwitch: true, list: 'embeddings', folder: folderForKind('embedding'), pick: 'embedding' },
  controlnet: { key: 'controlnet', label: 'ControlNet', one: 'ControlNet', weight: STRENGTH, hasSwitch: true, list: 'controlnets', folder: folderForKind('controlnet'), pick: 'controlnet' },
  vae: { key: 'vae', label: 'VAE', one: 'VAE', hasSwitch: false, list: 'vaes', folder: folderForKind('vae'), pick: 'vae' },
  clip: { key: 'clip', label: 'Text encoder', one: 'text encoder', hasSwitch: false, list: 'textEncoders', folder: folderForKind('clip'), pick: null },
  upscale: { key: 'upscale', label: 'Upscaler', one: 'upscale model', hasSwitch: false, list: 'upscaleModels', folder: folderForKind('upscale'), pick: 'upscale' },
  other: { key: 'other', label: 'Other', one: 'model', hasSwitch: false, list: listForKind('other'), folder: folderForKind('other'), pick: null },
};

/** One row of the list, whatever the kind and whichever store it lives in. */
export interface ModelEntry {
  id: string;
  name: string;
  on: boolean;
  /** The main weight: merge ratio, LoRA strength, embedding strength, ControlNet strength. */
  weight: number;
  /** Shown instead of the weight on the circle (the base checkpoint, a slot's role: "High", "Low"). */
  badge?: string;
  /** The base checkpoint: no ratio, carries the VAE and the model type. */
  isBase?: boolean;
  /** A fixed slot: cannot be removed, only changed. */
  fixed?: boolean;
  /** This entry has no weight slider even when its kind does (a speed LoRA whose strength is a recipe). */
  noWeight?: boolean;
  /** Set while the file is not on a server yet: dimmed, "not downloaded", a Download button. */
  pending?: import('./pendingLogic').PendingRecord;
  /** The file is named but no server lists it and nothing is downloading it: dimmed, "not on server". */
  missing?: boolean;
}

/** A short weight for the circle badge: 0.8, 1, 1.25. */
export function fmtWeight(v: number): string {
  return String(Number(v.toFixed(2)));
}

/** A spec with some parts changed. */
export function specWith(kind: ModelKind, over: Partial<Omit<KindSpec, 'key'>>): KindSpec {
  return { ...KINDS[kind], ...over, key: kind };
}
