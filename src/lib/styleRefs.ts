/**
 * Style references (the next UI's Style tab): pictures that steer the image through IP-Adapter
 * (style · composition · subject), a face (FaceID Plus v2 / Portrait, InstantID, PuLID) or Flux
 * Redux. Pure (imports types only), tested in next/tests/styleRefs.test.cjs.
 *
 *   WorkflowState.styleRefs   the references, in order (absent / [] = nothing changes, byte for byte)
 *   styleSupportOf(objInfo)   what one server can run, read from its live /object_info
 *   styleFamily(profile fam)  sd15 · sdxl · flux, or null = no style references for that type
 *   typeState(...)            per type: fits the family? runnable on that server? what is missing?
 *   pickModel / pickClipVision / pickLora / pickControlnet   the files a reference uses (auto or override)
 *
 * The graph stage itself is `graphs/style.ts`. The node classes and their inputs were read from
 * the live /object_info of winold (ComfyUI 0.35.0 + ComfyUI_IPAdapter_plus, ComfyUI_InstantID,
 * PuLID_ComfyUI), never from memory: `STYLE_NODES` lists each class the stage sends.
 */
import type { GraphFamily } from './modelProfiles';

export type StyleRefType = 'style' | 'composition' | 'subject' | 'face' | 'redux';
export type FaceMethod = 'faceid' | 'portrait' | 'instantid' | 'pulid';
export type StyleFamily = 'sd15' | 'sdxl' | 'flux';

/** One picture of a reference. The bytes live in the browser (IndexedDB, `key`); `thumb` is a small JPEG data URL for the bubble, the history and the metadata. */
export interface StyleRefImage {
  /** Content hash of the stored picture (the same picture = the same key = the same fingerprint). */
  key: string;
  name: string;
  width: number;
  height: number;
  thumb: string;
}

export interface StyleRef {
  id: string;
  type: StyleRefType;
  on: boolean;
  images: StyleRefImage[];
  /** Strength (IP-Adapter weight, InstantID / PuLID weight, Redux strength). */
  weight: number;
  /** When it applies, 0..1 of the sampling. */
  start: number;
  end: number;
  /** IP-Adapter `weight_type` (style / composition / subject / FaceID). Absent = the type's default. */
  weightType?: string;
  /** Face only. Absent = 'faceid'. */
  method?: FaceMethod;
  /** The adapter / InstantID / PuLID / style-model file. '' or absent = picked from the family. */
  model?: string;
  /** Several pictures: IP-Adapter `combine_embeds`. */
  combine?: string;
  /** FaceID Plus v2: the LoRA's strength and `weight_faceidv2`. */
  loraStrength?: number;
  faceV2Weight?: number;
  /** InstantID: ControlNet strength (keypoints). */
  cnStrength?: number;
  /** InstantID: noise injected into the negative embeds (its README: against the "burn"; 0.35 = the basic node's own). */
  noise?: number;
  /** IP-Adapter / FaceID `embeds_scaling`. Absent = the type's default. */
  embedsScaling?: string;
  /** PuLID `method`. */
  pulidMethod?: 'fidelity' | 'style' | 'neutral';
  /** Set at queue time for the target server (`resolveStyleRefs`): the files this run used. Also what the metadata shows. */
  use?: StyleRefFiles;
}

/** The concrete files a reference runs with on one server. */
export interface StyleRefFiles { model: string; clipVision?: string; lora?: string; controlnet?: string }

// ── the types ──────────────────────────────────────────────────────────────────────────────────

export const STYLE_TYPES: readonly StyleRefType[] = ['style', 'composition', 'subject', 'face', 'redux'];

export const TYPE_INFO: Record<StyleRefType, { title: string; line: string; families: readonly StyleFamily[]; multi: boolean }> = {
  style: { title: 'Style', line: 'Copy the look: colours, brushwork, light.', families: ['sd15', 'sdxl'], multi: true },
  composition: { title: 'Composition', line: 'Copy the layout, not the look.', families: ['sd15', 'sdxl'], multi: true },
  subject: { title: 'Subject', line: 'More like this picture.', families: ['sd15', 'sdxl'], multi: true },
  face: { title: 'Face', line: "Keep this person's face.", families: ['sd15', 'sdxl'], multi: true },
  redux: { title: 'Flux Redux', line: 'Copy the look and content, for Flux.', families: ['flux'], multi: true },
};

export const FACE_METHODS: readonly FaceMethod[] = ['faceid', 'portrait', 'instantid', 'pulid'];
export const FACE_INFO: Record<FaceMethod, { title: string; families: readonly StyleFamily[] }> = {
  faceid: { title: 'FaceID v2', families: ['sd15', 'sdxl'] },
  portrait: { title: 'Portrait', families: ['sd15', 'sdxl'] },
  instantid: { title: 'InstantID', families: ['sdxl'] },
  pulid: { title: 'PuLID', families: ['sdxl'] },
};

/** The graph family's style family: SD 1.5, the SDXL types (SDXL, Pony, Illustrious, NoobAI), Flux; others have none. */
export function styleFamily(family: GraphFamily | string | undefined): StyleFamily | null {
  return family === 'sd15' || family === 'sdxl' || family === 'flux' ? family : null;
}

/** Fits the model family (before asking whether a server can run it). */
export function typeFits(type: StyleRefType, fam: StyleFamily | null): boolean {
  return !!fam && TYPE_INFO[type].families.includes(fam);
}

/** The face methods that fit a family. */
export function faceMethodsFor(fam: StyleFamily | null): FaceMethod[] {
  return fam ? FACE_METHODS.filter((m) => FACE_INFO[m].families.includes(fam)) : [];
}

/** IP-Adapter weight types offered per type (values are IPAdapterAdvanced's own). */
export const WEIGHT_TYPES: Record<'style' | 'composition' | 'subject', Array<{ value: string; label: string }>> = {
  style: [{ value: 'style transfer', label: 'Style' }, { value: 'strong style transfer', label: 'Strong' }, { value: 'style transfer precise', label: 'Precise' }],
  composition: [{ value: 'linear', label: 'Even' }, { value: 'composition', label: 'Layout only' }, { value: 'composition precise', label: 'Precise' }],
  subject: [{ value: 'linear', label: 'Even' }, { value: 'ease in', label: 'Early' }, { value: 'ease out', label: 'Late' }],
};

export const COMBINE = ['concat', 'add', 'subtract', 'average', 'norm average'] as const;

/**
 * Start values per type / face method, from the node packs' own example workflows and READMEs
 * (ComfyUI_IPAdapter_plus examples/ipadapter_precise_weight_type, _precise_composition, _simple,
 * _ideal_faceid_config, _portrait; ComfyUI_InstantID InstantID_basic + "Noise Injection";
 * PuLID_ComfyUI PuLID_simple):
 *   style        PLUS adapter, weight 1, "style transfer", V only
 *   composition  SDXL: PLUS adapter, weight 0.8, "composition precise", K+mean(V) w/ C penalty
 *                SD 1.5: ostris' composition adapter, weight 0.6, linear (at 1 it leaks the subject; checked on winold)
 *   subject      PLUS adapter, weight 0.8, linear
 *   FaceID v2    weight 0.8, faceidv2 2, its LoRA at 0.6
 *   Portrait     weight 0.65, no LoRA
 *   InstantID    ip_weight 0.8, ControlNet 0.8, noise 0.35, best at CFG 4–5 and 1016²
 *   PuLID        fidelity, weight 0.8
 *   Redux        strength 1, multiply
 */
export function methodDefaults(method: FaceMethod): Partial<StyleRef> {
  switch (method) {
    case 'faceid': return { weight: 0.8, faceV2Weight: 2, loraStrength: 0.6, weightType: 'linear', embedsScaling: 'V only' };
    case 'portrait': return { weight: 0.65, faceV2Weight: 1, weightType: 'linear', embedsScaling: 'V only' };
    case 'instantid': return { weight: 0.8, cnStrength: 0.8, noise: 0.35 };
    case 'pulid': return { weight: 0.8, pulidMethod: 'fidelity' };
  }
}

/** A new reference of a type: its start values. */
export function newStyleRef(id: string, type: StyleRefType, fam: StyleFamily | null): StyleRef {
  const base: StyleRef = { id, type, on: true, images: [], weight: 1, start: 0, end: 1 };
  switch (type) {
    case 'style': return { ...base, weight: 1, weightType: 'style transfer', embedsScaling: 'V only' };
    case 'composition': return fam === 'sd15'
      ? { ...base, weight: 0.6, weightType: 'linear', embedsScaling: 'V only' }
      : { ...base, weight: 0.8, weightType: 'composition precise', embedsScaling: 'K+mean(V) w/ C penalty' };
    case 'subject': return { ...base, weight: 0.8, weightType: 'linear', embedsScaling: 'V only' };
    case 'face': return { ...base, method: 'faceid', ...methodDefaults('faceid') };
    case 'redux': return { ...base, weight: 1 };
  }
}

/** What the sampler wants with a reference, when the pack says so (shown as a hint with a one-tap fix). */
export function samplerAdvice(r: Pick<StyleRef, 'type' | 'method'>): { cfgMax?: number; cfg?: number; text: string } | null {
  if (methodOf(r) === 'instantid') return { cfgMax: 5, cfg: 4.5, text: 'InstantID burns above CFG 5' };
  return null;
}

// ── what a server has ──────────────────────────────────────────────────────────────────────────

/** Node classes per feature (all must be present). */
export const FEATURE_NODES = {
  ipadapter: ['IPAdapterModelLoader', 'IPAdapterAdvanced', 'CLIPVisionLoader'],
  faceid: ['IPAdapterModelLoader', 'IPAdapterInsightFaceLoader', 'IPAdapterFaceID', 'CLIPVisionLoader', 'LoraLoaderModelOnly'],
  instantid: ['InstantIDModelLoader', 'InstantIDFaceAnalysis', 'ApplyInstantID', 'ControlNetLoader'],
  pulid: ['PulidModelLoader', 'PulidInsightFaceLoader', 'PulidEvaClipLoader', 'ApplyPulid'],
  redux: ['StyleModelLoader', 'StyleModelApply', 'CLIPVisionLoader', 'CLIPVisionEncode'],
} as const;
export type StyleFeature = keyof typeof FEATURE_NODES;

/** The node pack that brings each feature (what to install). */
export const FEATURE_PACK: Record<StyleFeature, string> = {
  ipadapter: 'IP-Adapter nodes (ComfyUI_IPAdapter_plus)',
  faceid: 'IP-Adapter nodes (ComfyUI_IPAdapter_plus)',
  instantid: 'InstantID nodes (ComfyUI_InstantID)',
  pulid: 'PuLID nodes (PuLID_ComfyUI)',
  redux: 'a newer ComfyUI (StyleModelApply)',
};

/** What one server can run, from its /object_info. Stored on `ServerInfo.style`. */
export interface StyleSupport {
  /** The feature node classes it has. */
  nodes: string[];
  ipadapter: string[];
  clipVision: string[];
  styleModels: string[];
  instantid: string[];
  pulid: string[];
  /** IPAdapterAdvanced's weight_type list (to offer only what the server knows). */
  weightTypes: string[];
}

type ObjectInfo = Record<string, { input?: { required?: Record<string, unknown>; optional?: Record<string, unknown> } } | undefined>;

const comboOf = (info: ObjectInfo, cls: string, key: string): string[] => {
  const spec = info[cls]?.input?.required?.[key] ?? info[cls]?.input?.optional?.[key];
  if (!Array.isArray(spec)) return [];
  if (Array.isArray(spec[0])) return (spec[0] as unknown[]).map(String);
  const opts = (spec[1] as { options?: unknown } | undefined)?.options;
  return Array.isArray(opts) ? opts.map(String) : [];
};

const ALL_NODES = [...new Set(Object.values(FEATURE_NODES).flat())];

export function styleSupportOf(objectInfo: unknown): StyleSupport {
  const info = (objectInfo && typeof objectInfo === 'object' ? objectInfo : {}) as ObjectInfo;
  return {
    nodes: ALL_NODES.filter((n) => !!info[n]),
    ipadapter: comboOf(info, 'IPAdapterModelLoader', 'ipadapter_file'),
    clipVision: comboOf(info, 'CLIPVisionLoader', 'clip_name'),
    styleModels: comboOf(info, 'StyleModelLoader', 'style_model_name'),
    instantid: comboOf(info, 'InstantIDModelLoader', 'instantid_file'),
    pulid: comboOf(info, 'PulidModelLoader', 'pulid_file'),
    weightTypes: comboOf(info, 'IPAdapterAdvanced', 'weight_type'),
  };
}

// ── picking files ──────────────────────────────────────────────────────────────────────────────

const base = (f: string) => f.toLowerCase().replace(/^.*[\\/]/, '');
const first = (files: readonly string[], ...tests: Array<(b: string, full: string) => boolean>) => {
  for (const t of tests) {
    const hit = files.find((f) => t(base(f), f.toLowerCase()));
    if (hit) return hit;
  }
  return '';
};

/** Which family an adapter file is for, from its name ('' = cannot tell). */
export function fileFamily(file: string): StyleFamily | '' {
  const b = base(file);
  if (/sd15|sd1\.5|sd-1\.5/.test(b)) return 'sd15';
  if (/sdxl|_xl\b/.test(b)) return 'sdxl';
  if (/flux|redux/.test(b)) return 'flux';
  return '';
}

/** The ref's face method (absent = FaceID v2). */
export const methodOf = (r: Pick<StyleRef, 'type' | 'method'>): FaceMethod | null => (r.type === 'face' ? r.method ?? 'faceid' : null);

/** The feature a reference needs. */
export function featureOf(r: Pick<StyleRef, 'type' | 'method'>): StyleFeature {
  if (r.type === 'redux') return 'redux';
  const m = methodOf(r);
  if (m === 'faceid' || m === 'portrait') return 'faceid';
  if (m === 'instantid') return 'instantid';
  if (m === 'pulid') return 'pulid';
  return 'ipadapter';
}

/** The candidate model files of a reference (for the override select): the server's list for its loader, this family's first. */
export function modelChoices(r: Pick<StyleRef, 'type' | 'method'>, fam: StyleFamily | null, s: StyleSupport | undefined): string[] {
  if (!s) return [];
  const f = featureOf(r);
  const list = f === 'redux' ? s.styleModels : f === 'instantid' ? s.instantid : f === 'pulid' ? s.pulid : s.ipadapter;
  const fits = (x: string) => { const ff = fileFamily(x); return !ff || ff === fam; };
  return list.filter(fits);
}

/** The model file a reference uses: its override when the server has it, else the family's pick. '' = none found. */
export function pickModel(r: Pick<StyleRef, 'type' | 'method' | 'model'>, fam: StyleFamily | null, s: StyleSupport | undefined): string {
  if (!s || !fam) return '';
  const f = featureOf(r);
  const list = f === 'redux' ? s.styleModels : f === 'instantid' ? s.instantid : f === 'pulid' ? s.pulid : s.ipadapter;
  if (r.model && list.includes(r.model)) return r.model;
  const xl = fam === 'sdxl';
  const tag = xl ? 'sdxl' : 'sd15';
  const has = (...parts: string[]) => (b: string) => parts.every((p) => b.includes(p));
  switch (f) {
    case 'redux': return first(list, has('redux'));
    case 'instantid': return first(list, () => true);
    case 'pulid': return first(list, has('pulid', 'sdxl'), has('pulid'));
    case 'faceid': {
      if (methodOf(r) === 'portrait') {
        return xl
          ? first(list, (b) => b.includes('faceid-portrait') && b.includes('sdxl') && !b.includes('unnorm'), has('faceid-portrait', 'sdxl'))
          : first(list, has('faceid-portrait', 'sd15'));
      }
      return first(list, has('faceid-plusv2', tag), has('faceid-plus', tag), has('faceid', tag));
    }
    default: {
      if (r.type === 'composition' && !xl) return first(list, has('composition', tag));
      if (xl) return first(list, has('ip-adapter-plus_sdxl_vit-h'), has('ip-adapter_sdxl_vit-h'), (b) => b.includes('plus') && b.includes('sdxl') && !b.includes('face') && !b.includes('composition'));
      return first(list, has('ip-adapter-plus_sd15'), (b) => b.startsWith('ip-adapter_sd15') && !b.includes('light') && !b.includes('vit-g'), (b) => b.includes('sd15') && !b.includes('face') && !b.includes('composition'));
    }
  }
}

/** The CLIP vision file an adapter wants: SigLIP for Redux, ViT-bigG for the vit-G / plain SDXL adapters, ViT-H for the rest. */
export function pickClipVision(model: string, s: StyleSupport | undefined, type?: StyleRefType): string {
  if (!s) return '';
  const list = s.clipVision;
  if (type === 'redux') return first(list, (b) => b.includes('sigclip') || b.includes('siglip'));
  const b = base(model);
  const wantsG = b.includes('vit-g') || (/^ip-adapter_sdxl(\.|$)/.test(b));
  const isH = (x: string) => /vit-h|vit_h|h-14/.test(x);
  const isG = (x: string) => /bigg|vit-g|g-14/.test(x);
  return wantsG ? first(list, isG) : first(list, isH);
}

/** FaceID's LoRA file (Plus v2 / plain FaceID; Portrait has none). */
export function pickLora(model: string, loras: readonly string[]): string {
  const b = base(model).replace(/\.(bin|safetensors|pt|pth)$/, '');
  if (!b.includes('faceid') || b.includes('portrait')) return '';
  return first(loras, (x) => x.startsWith(`${b}_lora`), (x) => x.startsWith(b) && x.includes('lora'));
}

/** InstantID's ControlNet (the keypoints one) from the server's ControlNet list. */
export function pickControlnet(controlnets: readonly string[]): string {
  return first(controlnets, (_b, full) => full.includes('instantid'));
}

// ── can it run ─────────────────────────────────────────────────────────────────────────────────

/** What a reference needs that the server lacks, as short labels. [] = it runs there. */
export function refMissing(
  r: Pick<StyleRef, 'type' | 'method' | 'model'>,
  fam: StyleFamily | null,
  s: StyleSupport | undefined,
  extra: { loras?: readonly string[]; controlnets?: readonly string[] } = {},
): string[] {
  if (!fam) return ['a model type with style references'];
  if (!s) return ['style check (server not read yet)'];
  const f = featureOf(r);
  const lacking = FEATURE_NODES[f].filter((n) => !s.nodes.includes(n));
  if (lacking.length) return [FEATURE_PACK[f]];
  const out: string[] = [];
  const model = pickModel(r, fam, s);
  const famWord = fam === 'sd15' ? 'SD 1.5' : fam === 'sdxl' ? 'SDXL' : 'Flux';
  if (!model) {
    out.push(f === 'redux' ? 'Redux model (style_models)' : f === 'instantid' ? 'InstantID model (models/instantid)' : f === 'pulid' ? 'PuLID model (models/pulid)'
      : `${famWord} ${r.type === 'composition' ? 'composition ' : f === 'faceid' ? (methodOf(r) === 'portrait' ? 'FaceID Portrait ' : 'FaceID ') : ''}adapter (models/ipadapter)`);
  }
  if (f === 'ipadapter' || f === 'faceid' || f === 'redux') {
    if (model && !pickClipVision(model, s, r.type)) out.push(f === 'redux' ? 'SigLIP vision model (clip_vision)' : 'CLIP vision model (clip_vision)');
  }
  if (f === 'faceid' && model && methodOf(r) !== 'portrait' && extra.loras && !pickLora(model, extra.loras)) out.push('FaceID LoRA (models/loras)');
  if (f === 'instantid' && extra.controlnets && !pickControlnet(extra.controlnets)) out.push('InstantID ControlNet (models/controlnet)');
  return out;
}

/** The references that change the graph: on, with at least one picture, fitting the family. */
export function activeRefs(refs: readonly StyleRef[] | undefined, fam: StyleFamily | null): StyleRef[] {
  if (!refs?.length || !fam) return [];
  return refs.filter((r) => r.on && r.images.length > 0 && typeFits(r.type, fam) && (r.type !== 'face' || FACE_INFO[methodOf(r)!].families.includes(fam)));
}

/**
 * Queue time: the references with the files the target server will use (`use`), so the graph
 * builder (pure, no server lists) knows them. A reference the server cannot run keeps no `use` and
 * the graph leaves it out (routing already kept the job off such a server).
 */
export function resolveStyleRefs(
  refs: readonly StyleRef[] | undefined,
  fam: StyleFamily | null,
  s: StyleSupport | undefined,
  extra: { loras?: readonly string[]; controlnets?: readonly string[] } = {},
): StyleRef[] | undefined {
  if (!refs) return refs as undefined;
  const active = new Set(activeRefs(refs, fam).map((r) => r.id));
  return refs.map((r) => {
    const { use: _old, ...rest } = r;
    if (!active.has(r.id) || refMissing(r, fam, s, extra).length) return rest;
    const model = pickModel(r, fam, s);
    const f = featureOf(r);
    const use: StyleRefFiles = { model };
    if (f === 'ipadapter' || f === 'faceid' || f === 'redux') use.clipVision = pickClipVision(model, s, r.type);
    if (f === 'faceid') { const l = pickLora(model, extra.loras ?? []); if (l) use.lora = l; }
    if (f === 'instantid') use.controlnet = pickControlnet(extra.controlnets ?? []);
    return { ...rest, use };
  });
}

/** A type's state on one server for the tiles: hidden (does not fit), ready, or what is missing. */
export function typeState(type: StyleRefType, fam: StyleFamily | null, s: StyleSupport | undefined, extra?: { loras?: readonly string[]; controlnets?: readonly string[] }): { fits: boolean; missing: string[] } {
  if (!typeFits(type, fam)) return { fits: false, missing: [] };
  if (type === 'face') {
    // Ready when any fitting method runs; otherwise what FaceID v2 (the default) needs.
    const methods = faceMethodsFor(fam);
    const runs = methods.some((m) => refMissing({ type, method: m }, fam, s, extra).length === 0);
    return { fits: true, missing: runs ? [] : refMissing({ type, method: 'faceid' }, fam, s, extra) };
  }
  return { fits: true, missing: refMissing({ type }, fam, s, extra) };
}

/**
 * Several references at once: how much a reference's strength is scaled so they do not fight
 * (the examples stack a second adapter at about half: InstantID + IP-Adapter 0.5, FaceID 0.8 +
 * full-face 0.4; a style transfer stays at 1 next to PuLID). 1 = as set.
 *   subject next to a face: ×0.6 · composition next to a face: ×0.75
 *   subject next to style / composition: ×0.75
 *   a second face method on top of the first: ×0.6
 * Style transfer and Redux are never scaled (they touch other layers / the prompt).
 */
export function stackFactor(r: StyleRef, active: readonly StyleRef[]): number {
  if (!active.includes(r) || active.length < 2) return 1;
  const others = active.filter((o) => o !== r);
  const face = others.some((o) => o.type === 'face');
  switch (r.type) {
    case 'subject': return face ? 0.6 : others.some((o) => o.type === 'style' || o.type === 'composition') ? 0.75 : 1;
    case 'composition': return face ? 0.75 : 1;
    case 'face': {
      const faces = active.filter((o) => o.type === 'face');
      return faces.indexOf(r) > 0 ? 0.6 : 1;
    }
    default: return 1;
  }
}

/** Short summary of a reference for metadata ("Style 0.8 · Face (InstantID) 1"). */
export function describeRefs(refs: readonly StyleRef[] | undefined): string {
  return (refs ?? []).filter((r) => r.on && r.images.length).map((r) => {
    const m = methodOf(r);
    return `${TYPE_INFO[r.type].title}${m && m !== 'faceid' ? ` (${FACE_INFO[m].title})` : ''} ${Math.round(r.weight * 100) / 100}`;
  }).join(' · ');
}
