/**
 * Item 13: the Edit mode's free ComfyUI tools as tiny graphs, pure (tests/editLogic.test.cjs).
 * Every graph is LoadImage("ref") → … → SaveImage as node OUT, so one runner
 * (`~/app/imageGraphRun`) serves them all and the result is an output file a history entry can
 * point at. Which tools show depends on the server (`editTools.ts` asks /object_info): core nodes
 * (ImageScale, ImageScaleBy, ImageSharpen, ImageQuantize, ImagePadForOutpaint, Canny, upscale
 * models), and only when installed: comfyui_controlnet_aux preprocessors (lineart, depth) and
 * facerestore_cf (face restore). Node inputs we do not set come from the node's own defaults.
 */

export const OUT = 'out';

export type Node = { class_type: string; inputs: Record<string, unknown> };
export type Graph = Record<string, Node>;

/** A node's `/object_info` entry, the part we read. */
export interface NodeSpec { input?: { required?: Record<string, unknown[]>; optional?: Record<string, unknown[]> } }

const load = (ref: string): Node => ({ class_type: 'LoadImage', inputs: { image: ref } });
const save = (from: string, prefix: string): Node => ({ class_type: 'SaveImage', inputs: { images: [from, 0], filename_prefix: prefix } });

export const EDIT_PREFIX = 'imagelab/edit';

/** Every input of a node at its default (combo = first option), except the ones in `skip`. */
export function defaultInputs(spec: NodeSpec | null, skip: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const all = { ...(spec?.input?.required ?? {}), ...(spec?.input?.optional ?? {}) };
  for (const [name, s] of Object.entries(all)) {
    if (skip.includes(name) || !Array.isArray(s)) continue;
    const [type, cfg] = s as [unknown, { default?: unknown; options?: unknown[] } | undefined];
    if (cfg && 'default' in cfg && cfg.default !== undefined) out[name] = cfg.default;
    else if (Array.isArray(type) && type.length) out[name] = type[0];
    else if (Array.isArray(cfg?.options) && cfg.options.length) out[name] = cfg.options[0];
  }
  return out;
}

/** Inputs of a spec that take an IMAGE (the picture goes there), else 'image'. */
export function imageInput(spec: NodeSpec | null): string {
  const all = { ...(spec?.input?.required ?? {}), ...(spec?.input?.optional ?? {}) };
  return Object.entries(all).find(([, s]) => Array.isArray(s) && s[0] === 'IMAGE')?.[0] ?? 'image';
}

/** A size to ×`by`, both sides even (some models and encoders want even sizes). */
export const scaled = (w: number, h: number, by: number) => ({ w: Math.max(2, Math.round((w * by) / 2) * 2), h: Math.max(2, Math.round((h * by) / 2) * 2) });

/** The model's own scale from its file name (4x_foo, RealESRGAN_x2plus, 2xNomos…), else 4. */
export function modelScale(name: string): number {
  const m = /(?:^|[^a-z0-9])(?:x(\d)|(\d)x)/i.exec(name) ?? /(\d)x|x(\d)/i.exec(name);
  const n = m ? Number(m[1] ?? m[2]) : NaN;
  return n >= 1 && n <= 8 ? n : 4;
}

/** The upscale model to use for a ×`by` upscale: the smallest one that reaches it, else the biggest. */
export function pickUpscaleModel(models: readonly string[], by: number): string | null {
  if (!models.length) return null;
  const ranked = [...models].sort((a, b) => modelScale(a) - modelScale(b) || a.localeCompare(b));
  return ranked.find((m) => modelScale(m) >= by) ?? ranked[ranked.length - 1];
}

/** Upscale to exactly ×`by`: through a model when there is one (then an exact Lanczos resize), else Lanczos only. */
export function upscaleGraph(ref: string, w: number, h: number, by: number, model: string | null): Graph {
  const t = scaled(w, h, by);
  const g: Graph = { '1': load(ref) };
  let img: [string, number] = ['1', 0];
  if (model) {
    g['2'] = { class_type: 'UpscaleModelLoader', inputs: { model_name: model } };
    g['3'] = { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['2', 0], image: img } };
    img = ['3', 0];
  }
  g['4'] = { class_type: 'ImageScale', inputs: { image: img, upscale_method: 'lanczos', width: t.w, height: t.h, crop: 'disabled' } };
  g[OUT] = save('4', EDIT_PREFIX);
  return g;
}

export function resizeGraph(ref: string, w: number, h: number, fill: boolean): Graph {
  return {
    '1': load(ref),
    '2': { class_type: 'ImageScale', inputs: { image: ['1', 0], upscale_method: 'lanczos', width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)), crop: fill ? 'center' : 'disabled' } },
    [OUT]: save('2', EDIT_PREFIX),
  };
}

export function padGraph(ref: string, pad: { left: number; top: number; right: number; bottom: number }, feather = 0): Graph {
  const n = (v: number) => Math.max(0, Math.round(v / 8) * 8);
  return {
    '1': load(ref),
    '2': { class_type: 'ImagePadForOutpaint', inputs: { image: ['1', 0], left: n(pad.left), top: n(pad.top), right: n(pad.right), bottom: n(pad.bottom), feathering: Math.max(0, Math.round(feather)) } },
    [OUT]: save('2', EDIT_PREFIX),
  };
}

export function sharpenGraph(ref: string, amount: number, radius = 1): Graph {
  return {
    '1': load(ref),
    '2': { class_type: 'ImageSharpen', inputs: { image: ['1', 0], sharpen_radius: Math.max(1, Math.min(31, Math.round(radius))), sigma: 1, alpha: Math.max(0, Math.min(5, amount)) } },
    [OUT]: save('2', EDIT_PREFIX),
  };
}

export function posterizeGraph(ref: string, colors: number, dither: string): Graph {
  return {
    '1': load(ref),
    '2': { class_type: 'ImageQuantize', inputs: { image: ['1', 0], colors: Math.max(1, Math.min(256, Math.round(colors))), dither } },
    [OUT]: save('2', EDIT_PREFIX),
  };
}

export function cannyGraph(ref: string, low: number, high: number): Graph {
  return {
    '1': load(ref),
    '2': { class_type: 'Canny', inputs: { image: ['1', 0], low_threshold: low, high_threshold: Math.max(low, high) } },
    [OUT]: save('2', EDIT_PREFIX),
  };
}

/**
 * One installed node (a ControlNet preprocessor) on the picture, every other input at its default;
 * a `resolution` input is the picture's long side (64-multiple, ≤ 2048) so the map keeps its detail.
 */
export function preprocessorGraph(ref: string, cls: string, spec: NodeSpec | null, longSide: number): Graph {
  const imgIn = imageInput(spec);
  const inputs: Record<string, unknown> = { ...defaultInputs(spec, [imgIn]), [imgIn]: ['1', 0] };
  if ('resolution' in inputs) inputs.resolution = Math.min(2048, Math.max(64, Math.round(longSide / 64) * 64));
  return { '1': load(ref), '2': { class_type: cls, inputs }, [OUT]: save('2', EDIT_PREFIX) };
}

/** facerestore_cf: FaceRestoreModelLoader → FaceRestoreCFWithModel (detection + fidelity at their defaults). */
export function faceRestoreGraph(ref: string, model: string, spec: NodeSpec | null, fidelity: number): Graph {
  const inputs: Record<string, unknown> = { ...defaultInputs(spec, ['facerestore_model', 'image']), facerestore_model: ['2', 0], image: ['1', 0] };
  if ('codeformer_fidelity' in inputs) inputs.codeformer_fidelity = fidelity;
  return {
    '1': load(ref),
    '2': { class_type: 'FaceRestoreModelLoader', inputs: { model_name: model } },
    '3': { class_type: 'FaceRestoreCFWithModel', inputs },
    [OUT]: save('3', EDIT_PREFIX),
  };
}

/** Save a picture as an output, unchanged (an edited picture becomes a history entry). */
export function saveAsOutputGraph(ref: string, prefix = EDIT_PREFIX): Graph {
  return { '1': load(ref), [OUT]: save('1', prefix) };
}

/** First of `candidates` the server has (by the class names it lists). */
export const firstPresent = (candidates: readonly string[], present: (cls: string) => boolean): string | null => candidates.find(present) ?? null;

export const LINEART_NODES = ['LineArtPreprocessor', 'AnimeLineArtPreprocessor', 'LineartStandardPreprocessor', 'Manga2Anime_LineArt_Preprocessor'] as const;
export const DEPTH_NODES = ['DepthAnythingV2Preprocessor', 'DepthAnythingPreprocessor', 'MiDaS-DepthMapPreprocessor', 'Zoe-DepthMapPreprocessor'] as const;
