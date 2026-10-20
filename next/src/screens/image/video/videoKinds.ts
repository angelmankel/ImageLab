/**
 * The Video step's model slots as the universal list sees them (rule 4: one model component for
 * ALL models). Pure: maps a `videoStore` state to `ModelEntry`s per kind and turns every edit
 * (rename a slot, switch a LoRA, set a strength, a landed download) into a store patch. No React,
 * no stores: tested in tests/modelKinds.test.cjs.
 *
 * Kinds per engine — Wan 2.2: checkpoint = the task's high / low experts ("High" · "Low"),
 * lora = the user's LoRAs + the two lightx2v Fast LoRAs (fixed, on = Fast), clip = UMT5,
 * vae = Wan 2.1. MiniMax H3: checkpoint = fl2va or ref2va for the task, lora = the user's + the
 * Turbo LoRA (fixed, on = Turbo), clip = Qwen3-VL, vae = video + audio VAE.
 */
import { specWith, type KindSpec, type ModelEntry, type ModelKind } from '../model/kindSpecs';
import { sameFile } from '../model/pendingLogic';

export type Engine = 'wan' | 'h3';
type WanMode = 't2v' | 'i2v';

/** `name` = the high-noise (or only) file; `nameLow` = the low-noise file of a two-file pair (then it is always both experts). */
export interface WanLoraLike { id: string; name: string; strength: number; on: boolean; expert: 'high' | 'low' | 'both'; strengthLow?: number | null; nameLow?: string | null }
export interface H3LoraLike { id: string; name: string; strength: number; on: boolean }

/** The part of `VideoState` the slots read (structural: the store fits). */
export interface VideoSlice {
  engine: Engine;
  mode: WanMode;
  models: Record<WanMode, { high: string; low: string }>;
  textEncoder: string;
  vae: string;
  loras: WanLoraLike[];
  fast: boolean;
  fastLoras: Record<WanMode, { high: string; low: string }>;
  h3: {
    mode: 't2v' | 'i2v' | 'ref';
    models: { fl2va: string; ref2va: string };
    textEncoder: string;
    videoVae: string;
    audioVae: string;
    loras: H3LoraLike[];
    turbo?: { on: boolean; lora: string; loraRef: string; strength: number; steps: number; stepsRef: number };
  };
}

export type VideoPatch = Partial<Pick<VideoSlice, 'models' | 'textEncoder' | 'vae' | 'loras' | 'fast' | 'fastLoras' | 'h3'>>;

export const VIDEO_KINDS: readonly ModelKind[] = ['checkpoint', 'lora', 'clip', 'vae'];

/** CivitAI base models the big modal is narrowed to per engine. */
export const WAN_BASE_MODELS = ['Wan Video 2.2 T2V-A14B', 'Wan Video 2.2 I2V-A14B', 'Wan Video 14B t2v'];
export const H3_BASE_MODELS = ['MiniMax H3'];

export function videoLabels(engine: Engine): Partial<Record<ModelKind, string>> {
  return { checkpoint: engine === 'h3' ? 'Model' : 'Experts', lora: 'LoRAs', clip: 'Text encoder', vae: engine === 'h3' ? 'VAEs' : 'VAE' };
}

/** The kind's look on this engine: no merge ratio on an expert, the diffusion_models list, Wan / H3 base models. */
export function videoSpec(engine: Engine, kind: ModelKind): KindSpec {
  const baseModels = engine === 'h3' ? H3_BASE_MODELS : WAN_BASE_MODELS;
  switch (kind) {
    case 'checkpoint': return specWith('checkpoint', { label: engine === 'h3' ? 'Model' : 'Experts', one: engine === 'h3' ? 'model' : 'expert', weight: undefined, hasSwitch: false, list: 'diffusionModels', folder: 'diffusion_models', pick: 'checkpoint', baseModels });
    case 'lora': return specWith('lora', { baseModels });
    case 'clip': return specWith('clip', { one: 'text encoder' });
    case 'vae': return specWith('vae', { label: engine === 'h3' ? 'VAEs' : 'VAE' });
    default: return specWith(kind, {});
  }
}

const slot = (id: string, name: string, badge: string): ModelEntry => ({ id, name, on: true, weight: 0, badge, fixed: true, noWeight: true });

export function videoEntries(v: VideoSlice, kind: ModelKind): ModelEntry[] {
  const h3 = v.engine === 'h3';
  const h = v.h3;
  switch (kind) {
    case 'checkpoint':
      if (h3) return h.mode === 'ref' ? [slot('h3:ref2va', h.models.ref2va, 'Reference')] : [slot('h3:fl2va', h.models.fl2va, 'Text · frames')];
      return [slot('wan:high', v.models[v.mode].high, 'High'), slot('wan:low', v.models[v.mode].low, 'Low')];
    case 'lora': {
      if (h3) {
        const own = h.loras.map((l): ModelEntry => ({ id: l.id, name: l.name, on: l.on, weight: l.strength }));
        const t = h.turbo;
        const turbo: ModelEntry[] = t ? [{ id: 'h3:turbo', name: h.mode === 'ref' ? t.loraRef : t.lora, on: t.on, weight: t.strength, badge: 'Turbo', fixed: true }] : [];
        return [...own, ...turbo];
      }
      // One circle per LoRA: a pair (high + low file) is badged H+L; a single file says which expert it patches.
      const own = v.loras.map((l): ModelEntry => ({ id: l.id, name: l.name, on: l.on, weight: l.strength, badge: l.nameLow ? 'H+L' : l.expert === 'both' ? undefined : l.expert === 'high' ? 'High' : 'Low' }));
      const f = v.fastLoras[v.mode];
      return [...own,
        { id: 'wan:fast:high', name: f.high, on: v.fast, weight: 1, badge: 'Fast · High', fixed: true, noWeight: true },
        { id: 'wan:fast:low', name: f.low, on: v.fast, weight: 1, badge: 'Fast · Low', fixed: true, noWeight: true },
      ];
    }
    case 'clip':
      return h3 ? [slot('h3:clip', h.textEncoder, 'Qwen3-VL')] : [slot('wan:clip', v.textEncoder, 'UMT5')];
    case 'vae':
      return h3 ? [slot('h3:videoVae', h.videoVae, 'Video'), slot('h3:audioVae', h.audioVae, 'Audio')] : [slot('wan:vae', v.vae, 'Wan 2.1')];
    default:
      return [];
  }
}

const withLora = (v: VideoSlice, id: string, p: Partial<WanLoraLike>): VideoPatch | null =>
  v.loras.some((l) => l.id === id) ? { loras: v.loras.map((l) => (l.id === id ? { ...l, ...p } : l)) } : null;
const withH3Lora = (v: VideoSlice, id: string, p: Partial<H3LoraLike>): VideoPatch | null =>
  v.h3.loras.some((l) => l.id === id) ? { h3: { ...v.h3, loras: v.h3.loras.map((l) => (l.id === id ? { ...l, ...p } : l)) } } : null;

/** The patch that points slot / LoRA `id` at `name`; null when there is no such slot. */
export function videoSlotPatch(v: VideoSlice, id: string, name: string): VideoPatch | null {
  switch (id) {
    case 'wan:high': case 'wan:low': {
      const which = id === 'wan:high' ? 'high' : 'low';
      return { models: { ...v.models, [v.mode]: { ...v.models[v.mode], [which]: name } } };
    }
    case 'wan:clip': return { textEncoder: name };
    case 'wan:vae': return { vae: name };
    case 'wan:fast:high': case 'wan:fast:low': {
      const which = id === 'wan:fast:high' ? 'high' : 'low';
      return { fastLoras: { ...v.fastLoras, [v.mode]: { ...v.fastLoras[v.mode], [which]: name } } };
    }
    case 'h3:fl2va': case 'h3:ref2va': return { h3: { ...v.h3, models: { ...v.h3.models, [id.slice(3)]: name } } };
    case 'h3:clip': return { h3: { ...v.h3, textEncoder: name } };
    case 'h3:videoVae': return { h3: { ...v.h3, videoVae: name } };
    case 'h3:audioVae': return { h3: { ...v.h3, audioVae: name } };
    case 'h3:turbo': {
      if (!v.h3.turbo) return null;
      return { h3: { ...v.h3, turbo: { ...v.h3.turbo, [v.h3.mode === 'ref' ? 'loraRef' : 'lora']: name } } };
    }
    default: return withLora(v, id, { name }) ?? withH3Lora(v, id, { name });
  }
}

/** On/Off: a LoRA's own switch; the Fast pair is `fast`; the Turbo LoRA is `turbo.on`. */
export function videoSetOnPatch(v: VideoSlice, id: string, on: boolean): VideoPatch | null {
  if (id === 'wan:fast:high' || id === 'wan:fast:low') return { fast: on };
  if (id === 'h3:turbo') return v.h3.turbo ? { h3: { ...v.h3, turbo: { ...v.h3.turbo, on } } } : null;
  return withLora(v, id, { on }) ?? withH3Lora(v, id, { on });
}

export function videoSetWeightPatch(v: VideoSlice, id: string, strength: number): VideoPatch | null {
  if (id === 'h3:turbo') return v.h3.turbo ? { h3: { ...v.h3, turbo: { ...v.h3.turbo, strength } } } : null;
  return withLora(v, id, { strength }) ?? withH3Lora(v, id, { strength });
}

/** Only the user's own LoRAs can go; slots and the speed LoRAs are fixed. */
export function videoRemovePatch(v: VideoSlice, id: string): VideoPatch | null {
  if (v.loras.some((l) => l.id === id)) return { loras: v.loras.filter((l) => l.id !== id) };
  if (v.h3.loras.some((l) => l.id === id)) return { h3: { ...v.h3, loras: v.h3.loras.filter((l) => l.id !== id) } };
  return null;
}

/** Every slot of `kind` (both engines, both tasks) that holds `file`, by base name. */
export function videoSlotsHolding(v: VideoSlice, kind: ModelKind, file: string): string[] {
  const out: string[] = [];
  const hit = (id: string, name: string) => { if (sameFile(name, file)) out.push(id); };
  switch (kind) {
    case 'checkpoint':
      for (const m of ['t2v', 'i2v'] as const) { hit(`wan:${m}:high`, v.models[m].high); hit(`wan:${m}:low`, v.models[m].low); }
      hit('h3:fl2va', v.h3.models.fl2va); hit('h3:ref2va', v.h3.models.ref2va);
      break;
    case 'lora':
      // A pair's low file waits under `<id>:low`, so a landed download can tell the two apart.
      for (const l of v.loras) { hit(l.id, l.name); if (l.nameLow) hit(`${l.id}:low`, l.nameLow); }
      for (const l of v.h3.loras) hit(l.id, l.name);
      for (const m of ['t2v', 'i2v'] as const) { hit(`wan:fast:${m}:high`, v.fastLoras[m].high); hit(`wan:fast:${m}:low`, v.fastLoras[m].low); }
      if (v.h3.turbo) { hit('h3:turbo:lora', v.h3.turbo.lora); hit('h3:turbo:loraRef', v.h3.turbo.loraRef); }
      break;
    case 'clip': hit('wan:clip', v.textEncoder); hit('h3:clip', v.h3.textEncoder); break;
    case 'vae': hit('wan:vae', v.vae); hit('h3:videoVae', v.h3.videoVae); hit('h3:audioVae', v.h3.audioVae); break;
    default: break;
  }
  return out;
}

export const videoHasFile = (v: VideoSlice, kind: ModelKind, file: string): boolean => videoSlotsHolding(v, kind, file).length > 0;

/**
 * A downloaded file landed as `listed`: every slot that waited for `file` takes the server's name;
 * waiting LoRAs come back On as the user chose. Null when nothing waited.
 */
export function videoLandPatch(v: VideoSlice, kind: ModelKind, file: string, listed: string, userOn: boolean): VideoPatch | null {
  const ids = videoSlotsHolding(v, kind, file);
  if (!ids.length) return null;
  let next: VideoSlice = { ...v };
  for (const id of ids) {
    const m = /^wan:(t2v|i2v):(high|low)$/.exec(id);
    const f = /^wan:fast:(t2v|i2v):(high|low)$/.exec(id);
    const t = /^h3:turbo:(lora|loraRef)$/.exec(id);
    const lo = /^(.+):low$/.exec(id);
    if (m) next = { ...next, models: { ...next.models, [m[1]]: { ...next.models[m[1] as WanMode], [m[2]]: listed } } };
    else if (f) next = { ...next, fastLoras: { ...next.fastLoras, [f[1]]: { ...next.fastLoras[f[1] as WanMode], [f[2]]: listed } } };
    else if (t && next.h3.turbo) next = { ...next, h3: { ...next.h3, turbo: { ...next.h3.turbo, [t[1]]: listed } } };
    else if (lo) { const p = withLora(next, lo[1], { nameLow: listed, on: userOn }); if (p) next = { ...next, ...p }; }
    else {
      const p = videoSlotPatch(next, id, listed);
      if (p) next = { ...next, ...p };
      const on = withLora(next, id, { on: userOn }) ?? withH3Lora(next, id, { on: userOn });
      if (on) next = { ...next, ...on };
    }
  }
  const { models, textEncoder, vae, loras, fastLoras, h3 } = next;
  return { models, textEncoder, vae, loras, fastLoras, h3 };
}

/**
 * A landed half of a Wan LoRA pair must not switch the entry on while its other half still waits:
 * true when the entry holding `file` (as its high or low file) has the other file pending too.
 */
export function pairHalfWaiting(v: Pick<VideoSlice, 'loras'>, file: string, waiting: (file: string) => boolean): boolean {
  const other = pairOtherHalf(v, file);
  return other != null && waiting(other);
}

/** The other file of the pair that holds `file` (as its high or low file); null when no pair holds it. */
export function pairOtherHalf(v: Pick<VideoSlice, 'loras'>, file: string): string | null {
  for (const l of v.loras) {
    if (!l.nameLow) continue;
    if (sameFile(l.name, file)) return l.nameLow;
    if (sameFile(l.nameLow, file)) return l.name;
  }
  return null;
}
