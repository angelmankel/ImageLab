import type { LoopbackFrame, LoopbackRampKey, LoopbackSettings, Pass, PassCrop, WorkflowState } from './types';

const LOOPBACK_ID = 'loopback';

export const DEFAULT_LOOPBACK: LoopbackSettings = {
  enabled: false, iterations: 1, upscale: 1.25, denoise: 0.5, steps: 10, cfg: 7,
  autoDenoise: false, denoiseStart: 0.6, denoiseEnd: 0.3,
};

/**
 * The denoise for each Loopback round. With auto-scale on it moves in even steps from the start
 * value to the end value (either direction); a single round uses the start value.
 */
export function loopbackDenoises(lb: LoopbackSettings): number[] {
  const count = Math.max(1, Math.min(10, Math.trunc(lb.iterations) || 1));
  if (!lb.autoDenoise) return Array(count).fill(lb.denoise);
  const start = lb.denoiseStart ?? DEFAULT_LOOPBACK.denoiseStart!;
  const end = lb.denoiseEnd ?? DEFAULT_LOOPBACK.denoiseEnd!;
  return Array.from({ length: count }, (_, i) =>
    Math.round((count === 1 ? start : start + (end - start) * i / (count - 1)) * 1000) / 1000);
}

/** Clip skip 2 — what SD1.5 anime and SDXL Pony/Illustrious checkpoints expect. */
export const DEFAULT_CLIP_SKIP = -2;

/**
 * Put a CLIPSetLastLayer after the checkpoint's CLIP when clip skip is on, so the LoRA chain and
 * the text encoders read the trimmed CLIP. -1 (no skip) adds nothing. Returns the CLIP to use.
 */
export function applyClipSkip(
  graph: Record<string, { class_type: string; inputs: Record<string, unknown> }>,
  workflow: Pick<WorkflowState, 'clipSkip'>,
  clip: [string, number],
): [string, number] {
  const layer = Math.min(-1, Math.trunc(workflow.clipSkip ?? DEFAULT_CLIP_SKIP) || -1);
  if (layer === -1) return clip;
  graph.clipskip = { class_type: 'CLIPSetLastLayer', inputs: { stop_at_clip_layer: layer, clip } };
  return ['clipskip', 0];
}

export const DEFAULT_FRAME: LoopbackFrame = { x: 0.5, y: 0.5, w: 1, h: 1 };

/** A frame with its size filled in: centre and size as fractions of the base image. */
export type FrameRect = { x: number; y: number; w: number; h: number };

const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** Smallest frame side, as a fraction of the image. */
const MIN_SIDE = 0.05;

/** Any stored frame (old `zoom`-only ones included) as a rect that fits inside the image. */
export function frameRect(f: LoopbackFrame): FrameRect {
  const z = Math.max(1, Number(f.zoom) || 1);
  const w = Math.min(1, Math.max(MIN_SIDE, f.w ?? 1 / z));
  const h = Math.min(1, Math.max(MIN_SIDE, f.h ?? f.w ?? 1 / z));
  const c = (v: number, side: number) => Math.min(1 - side / 2, Math.max(side / 2, Number.isFinite(v) ? v : 0.5));
  return { x: round3(c(f.x, w)), y: round3(c(f.y, h)), w: round3(w), h: round3(h) };
}

/** How far in a frame is, for labels: 1 = the whole image, 2 = a quarter of its area. */
export function frameZoom(r: FrameRect): number {
  return Math.round((1 / Math.sqrt(r.w * r.h)) * 100) / 100;
}

export type LoopbackRound = {
  denoise: number; steps: number; cfg: number; upscale: number; noise: number;
  /** The part of the base image this round shows, after it was fitted inside the previous round's
   *  (null when the frame path is off). */
  frame: FrameRect | null;
  /** The crop of the previous round's image that gives `frame`; null when nothing is cut. */
  crop: PassCrop | null;
};

/** Where a round sits between the first (0) and the last (1). */
function roundT(i: number, count: number): number {
  return count === 1 ? 0 : i / (count - 1);
}

/** A frame between two others. Sizes move evenly in scale (×2 then ×4 feels even), centres linearly. */
export function lerpFrame(a: FrameRect, b: FrameRect, t: number): FrameRect {
  return {
    x: round3(a.x + (b.x - a.x) * t), y: round3(a.y + (b.y - a.y) * t),
    w: round3(a.w * Math.pow(b.w / a.w, t)), h: round3(a.h * Math.pow(b.h / a.h, t)),
  };
}

/**
 * Every Loopback round's settings. Each value is the fixed one, or — when it is auto-scaled —
 * moves evenly from its start (first round) to its end (last round); a single round uses the start.
 *
 * Frames describe the base image, but each round works on the previous round's output, which
 * already shows only the previous frame. So each crop is taken relative to that: cropping every
 * round by its own absolute zoom compounded (×1.4 then ×2 then ×2.9 came out near ×8). A frame
 * that reaches outside the previous one is pulled back inside it — that content is already gone —
 * and the pulled-in frame is the one reported (and drawn), so the canvas shows what really runs.
 */
export function loopbackRounds(lb: LoopbackSettings): LoopbackRound[] {
  const denoises = loopbackDenoises(lb);
  const count = denoises.length;
  const ramp = (k: LoopbackRampKey, fixed: number, i: number) => {
    const r = lb.ramps?.[k];
    return r ? r.start + (r.end - r.start) * roundT(i, count) : fixed;
  };
  const path = lb.frame?.enabled ? { start: frameRect(lb.frame.start), end: frameRect(lb.frame.end) } : null;
  let prev: FrameRect = { x: 0.5, y: 0.5, w: 1, h: 1 };
  return denoises.map((denoise, i) => {
    let frame: FrameRect | null = null;
    let crop: PassCrop | null = null;
    if (path) {
      const want = lerpFrame(path.start, path.end, roundT(i, count));
      const width = Math.min(1, want.w / prev.w), height = Math.min(1, want.h / prev.h);
      const clamp = (v: number, max: number) => Math.min(Math.max(0, v), max);
      const left = clamp((want.x - want.w / 2 - (prev.x - prev.w / 2)) / prev.w, 1 - width);
      const top = clamp((want.y - want.h / 2 - (prev.y - prev.h / 2)) / prev.h, 1 - height);
      frame = {
        x: round3(prev.x - prev.w / 2 + (left + width / 2) * prev.w), y: round3(prev.y - prev.h / 2 + (top + height / 2) * prev.h),
        w: round3(width * prev.w), h: round3(height * prev.h),
      };
      if (width < 0.999 || height < 0.999) crop = { left: round3(left), top: round3(top), width: round3(width), height: round3(height) };
      prev = frame;
    }
    return {
      denoise,
      steps: Math.max(1, Math.round(ramp('steps', lb.steps, i))),
      cfg: Math.round(ramp('cfg', lb.cfg, i) * 100) / 100,
      upscale: Math.max(1, round3(ramp('upscale', lb.upscale, i))),
      noise: Math.max(0, round3(ramp('noise', lb.noise ?? 0, i))),
      frame, crop,
    };
  });
}

/** A crop on a w×h image in pixels, snapped to the latent grid (8px) and kept inside it. */
export function cropPixels(crop: PassCrop, w: number, h: number): { x: number; y: number; width: number; height: number } {
  const width = Math.min(w, Math.max(64, Math.round((w * crop.width) / 8) * 8));
  const height = Math.min(h, Math.max(64, Math.round((h * crop.height) / 8) * 8));
  const clamp = (v: number, max: number) => Math.min(Math.max(0, v), max);
  return {
    x: clamp(Math.round((w * crop.left) / 8) * 8, w - width),
    y: clamp(Math.round((h * crop.top) / 8) * 8, h - height),
    width, height,
  };
}

/**
 * The size a cropped round renders at: the incoming pixel area times scale², in the crop's shape,
 * capped at `maxEdge` and snapped to 8. Keeping the area (not the width) means a tall crop of a
 * wide image does not balloon.
 */
export function croppedSize(crop: { width: number; height: number }, w: number, h: number, scale: number, maxEdge = 4096): [number, number] {
  const area = w * h * scale * scale;
  const aspect = crop.width / crop.height;
  let W = Math.sqrt(area * aspect), H = W / aspect;
  const over = Math.max(W, H) / maxEdge;
  if (over > 1) { W /= over; H /= over; }
  return [Math.max(64, Math.round(W / 8) * 8), Math.max(64, Math.round(H / 8) * 8)];
}

export type PassKind = NonNullable<Pass['kind']>;
export const PASS_LABELS: Record<PassKind, string> = {
  sample: 'Refine', upscale: 'Upscale', resize: 'Resize', 'remove-bg': 'Remove background',
};

export function createPass(workflow: WorkflowState, kind: PassKind, id: string): Pass {
  return {
    id, kind, on: true, sampler: workflow.sampler, scheduler: workflow.scheduler,
    steps: 12, cfg: workflow.cfg, seed: workflow.seed, randomizeSeed: false,
    denoise: 0.3, scale: kind === 'sample' ? 1 : 2, maxEdge: 4096,
    upscaleMode: 'latent', upscaleModel: workflow.upscaleModel,
    resizeMode: 'factor', width: workflow.width, height: workflow.height, resizeMethod: 'lanczos',
  };
}

/** Read old finishing switches as steps until the user edits the list. */
/**
 * Everything the graph runs after the base image: Loopback's rounds, then the listed passes.
 * The Passes panel edits `listedPasses` only — handing it this list made every edit save the
 * Loopback rounds as real passes, so a delete appeared to add one.
 */
export function pipelinePasses(workflow: WorkflowState): Pass[] {
  return [...loopbackPasses(workflow), ...listedPasses(workflow)];
}

/** The passes shown in the Passes panel, including old finishing flags read as steps. */
export function listedPasses(workflow: WorkflowState): Pass[] {
  // Rounds saved by that bug are dropped here, so they clear on the next edit and never run twice.
  const passes = workflow.passes.filter(p => !p.id.startsWith(LOOPBACK_ID));
  if (workflow.upscaleEnabled) passes.push({
    ...createPass(workflow, 'upscale', 'finish-upscale'),
    upscaleModel: workflow.upscaleModel, scale: 4, maxEdge: 32768,
  });
  if (workflow.resizeEnabled) passes.push({
    ...createPass(workflow, 'resize', 'finish-resize'), scale: workflow.resizeScale,
    resizeMode: workflow.resizeMode, width: workflow.resizeWidth, height: workflow.resizeHeight,
    resizeMethod: workflow.resizeMethod,
  });
  if (workflow.removeBg) passes.push(createPass(workflow, 'remove-bg', 'finish-background'));
  return passes;
}

/**
 * The size after each Loopback round, starting from the base size — the same rounding and 4096px
 * cap the graph applies, so the numbers shown are the numbers rendered.
 */
export function loopbackSizes(lb: LoopbackSettings, width: number, height: number, maxEdge = 4096): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let w = width, h = height;
  for (const round of loopbackRounds(lb)) {
    if (round.crop) {
      [w, h] = croppedSize(cropPixels(round.crop, w, h), w, h, round.upscale, maxEdge);
      out.push([w, h]);
      continue;
    }
    const scale = Math.min(round.upscale, maxEdge / Math.max(w, h));
    w = Math.max(8, Math.round(w * scale / 8) * 8);
    h = Math.max(8, Math.round(h * scale / 8) * 8);
    out.push([w, h]);
  }
  return out;
}

/**
 * The stages a job runs, in order: the base image, then each Loopback round and pass that will
 * actually execute (bypassed ones skip; refines skip while inpainting). `stageOf` reads a graph
 * node id — passes are built as `pass<index>…` — and says which stage it belongs to, or null for a
 * node that is not in a pass (the caller keeps the stage it already had: base nodes come first,
 * and the save and alpha nodes that follow the last pass must not send the count back to 1).
 */
export function jobStages(workflow: WorkflowState, inpaint = false): {
  total: number;
  names: string[];
  stageOf: (node: string) => number | null;
} {
  const passes = pipelinePasses(workflow);
  const names = ['Base image'];
  const stageByIndex = new Map<number, number>();
  let loop = 0;
  passes.forEach((p, i) => {
    const kind = p.kind ?? 'sample';
    if (p.on === false || (kind === 'sample' && inpaint)) return;
    stageByIndex.set(i, names.length + 1);
    names.push(p.id.startsWith(LOOPBACK_ID) ? `Loopback ${++loop}` : PASS_LABELS[kind]);
  });
  return {
    total: names.length,
    names,
    stageOf: (node) => {
      const m = /^pass(\d+)/.exec(node);
      return m ? stageByIndex.get(Number(m[1])) ?? null : null;
    },
  };
}

/** Loopback expands into plain refine passes, one per iteration, each with its own seed. */
export function loopbackPasses(workflow: WorkflowState): Pass[] {
  const lb = workflow.loopback;
  if (!lb?.enabled) return [];
  return loopbackRounds(lb).map((r, i) => ({
    ...createPass(workflow, 'sample', `${LOOPBACK_ID}${i}`),
    scale: r.upscale, denoise: r.denoise, steps: r.steps, cfg: r.cfg, noise: r.noise,
    ...(r.crop ? { crop: r.crop } : {}),
    seed: (workflow.seed + i + 1) % 0x100000000,
  }));
}

export function withPipeline(passes: Pass[]): Partial<WorkflowState> {
  return { passes, upscaleEnabled: false, resizeEnabled: false, removeBg: false };
}

export function prepareSeeds(workflow: WorkflowState, newSeed: boolean, random = Math.random): WorkflowState {
  const roll = (previous: number) => {
    const value = Math.floor(random() * 0xFFFFFFFF);
    return value === previous ? (value + 1) % 0x100000000 : value;
  };
  return {
    ...workflow,
    seed: newSeed || workflow.randomizeSeed ? roll(workflow.seed) : workflow.seed,
    passes: workflow.passes.map(pass => !pass.kind || pass.kind === 'sample'
      ? { ...pass, seed: newSeed || pass.randomizeSeed ? roll(pass.seed) : pass.seed }
      : pass),
  };
}

type Ref = [string, number];
type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

/** Thread each enabled step's output into the next, in the order shown in the panel. */
export function appendPasses(
  graph: Graph, workflow: WorkflowState, initialImage: Ref, initialSamples: Ref | null,
  model: Ref, vae: Ref, width: number, height: number, inpaint = false,
): { image: Ref; clampNotes: string[] } {
  let image = initialImage;
  let samples = initialSamples;
  // The cut-out from the last background removal, while later passes still work on the image.
  let cutout: Ref | null = null;
  let w = width, h = height;
  const clampNotes: string[] = [];
  const node = (id: string, class_type: string, inputs: Record<string, unknown>): Ref => {
    graph[id] = { class_type, inputs };
    return [id, 0];
  };
  const passes = pipelinePasses(workflow);
  passes.forEach((pass, index) => {
    if (pass.on === false) return;
    const kind = pass.kind ?? 'sample';
    const id = `pass${index}`;
    if (kind === 'remove-bg') {
      // Last step: a transparent image, as it always was. With steps after it, those steps only see
      // RGB — VAEEncode drops alpha, and the removed background is still there under it, so a refine
      // brought the background straight back. So the subject goes onto flat grey for them, and the
      // mask is kept to make the final image transparent again.
      const more = passes.slice(index + 1).some(p => p.on !== false);
      image = node(id, 'BiRefNetRMBG', { image, model: 'BiRefNet_toonout', sensitivity: 1,
        mask_blur: 0, mask_offset: 0, invert_output: false, refine_foreground: false,
        background: more ? 'Color' : 'Alpha', background_color: more ? '#808080' : '#222222' });
      cutout = more ? [id, 1] : null;
      samples = null;
      return;
    }
    if (kind === 'resize') {
      if (pass.resizeMode === 'size') {
        w = Math.max(8, Math.round(pass.width || 1024));
        h = Math.max(8, Math.round(pass.height || 1024));
        image = node(id, 'ImageScale', { image, width: w, height: h, crop: 'disabled', upscale_method: pass.resizeMethod || 'lanczos' });
      } else {
        const factor = Math.max(0.05, Number(pass.scale) || 1);
        w = Math.round(w * factor); h = Math.round(h * factor);
        image = node(id, 'ImageScaleBy', { image, scale_by: factor, upscale_method: pass.resizeMethod || 'lanczos' });
      }
      samples = null;
      return;
    }
    // Canvas inpainting keeps its masked stitch intact; refinement is for whole-image runs.
    if (kind === 'sample' && inpaint) return;
    const requested = Math.max(0.1, Number(pass.scale) || 1);
    const maxEdge = Math.max(64, pass.maxEdge || 4096);
    // A frame crop is taken from the image as it arrives; the pass then renders the crop's shape.
    const crop = kind === 'sample' && pass.crop ? cropPixels(pass.crop, w, h) : null;
    const scale = Math.min(requested, maxEdge / Math.max(w, h));
    if (scale < requested && !crop) clampNotes.push(`Pass ${index + 2} capped to ${pass.maxEdge}px`);
    const resized = Math.abs(scale - 1) > 0.001;
    if (crop) {
      [w, h] = croppedSize(crop, w, h, requested, maxEdge);
    } else {
      w = Math.max(8, Math.round(w * scale / 8) * 8);
      h = Math.max(8, Math.round(h * scale / 8) * 8);
    }
    if (crop && pass.upscaleMode === 'model') {
      image = node(`${id}crop`, 'ImageCrop', { image, ...crop });
      samples = null;
    }
    if (kind === 'upscale' || ((resized || crop) && pass.upscaleMode === 'model')) {
      const loader = node(`${id}model`, 'UpscaleModelLoader', { model_name: pass.upscaleModel || workflow.upscaleModel });
      image = node(`${id}up`, 'ImageUpscaleWithModel', { image, upscale_model: loader });
      image = node(`${id}size`, 'ImageScale', { image, width: w, height: h, crop: 'disabled', upscale_method: 'lanczos' });
      samples = null;
    }
    if (kind === 'upscale') return;
    if (!samples) samples = node(`${id}encode`, 'VAEEncode', { pixels: image, vae });
    if (crop && pass.upscaleMode !== 'model') {
      // Cut the frame out and scale it to the pass's output size.
      samples = node(`${id}crop`, 'LatentCrop', { samples, ...crop });
      samples = node(`${id}latent`, 'LatentUpscale', { samples, upscale_method: 'bislerp', width: w, height: h, crop: 'disabled' });
    } else if (resized && pass.upscaleMode !== 'model') {
      samples = node(`${id}latent`, 'LatentUpscaleBy', { samples, upscale_method: 'nearest-exact', scale_by: scale });
    }
    const seed = Math.trunc(Number(pass.seed) || 0);
    const noise = Number(pass.noise) || 0;
    if (noise > 0) {
      // ComfyUI_essentials' InjectLatentNoise+ (pinned in the image). Its own seed, one off the
      // sampler's, so the injected noise is not the same pattern the sampler adds on top.
      samples = node(`${id}noise`, 'InjectLatentNoise+', {
        latent: samples, noise_seed: (seed + 1) % 0x100000000, noise_strength: noise, normalize: 'false',
      });
    }
    samples = node(`${id}sample`, 'KSampler', {
      model, positive: ['6', 0], negative: ['7', 0], latent_image: samples,
      seed, steps: Math.max(1, Math.trunc(pass.steps)), cfg: pass.cfg,
      sampler_name: pass.sampler || workflow.sampler, scheduler: pass.scheduler || workflow.scheduler, denoise: pass.denoise,
    });
    image = node(`${id}decode`, 'VAEDecode', { samples, vae });
  });
  if (cutout) {
    // JoinImageWithAlpha treats its mask as "how transparent" and resizes it to the image, so the
    // cut-out survives any upscale or resize after it; BiRefNet's mask is "how opaque", hence the invert.
    const alpha = node('cutoutInvert', 'InvertMask', { mask: cutout });
    image = node('cutoutJoin', 'JoinImageWithAlpha', { image, alpha });
  }
  return { image, clampNotes };
}
