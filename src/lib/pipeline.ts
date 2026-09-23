import type { Pass, WorkflowState } from './types';

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
export function pipelinePasses(workflow: WorkflowState): Pass[] {
  const passes = [...workflow.passes];
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
  let w = width, h = height;
  const clampNotes: string[] = [];
  const node = (id: string, class_type: string, inputs: Record<string, unknown>): Ref => {
    graph[id] = { class_type, inputs };
    return [id, 0];
  };
  pipelinePasses(workflow).forEach((pass, index) => {
    if (pass.on === false) return;
    const kind = pass.kind ?? 'sample';
    const id = `pass${index}`;
    if (kind === 'remove-bg') {
      // This node reads its optional widgets directly, so include their defaults.
      image = node(id, 'BiRefNetRMBG', { image, model: 'BiRefNet_toonout', sensitivity: 1,
        mask_blur: 0, mask_offset: 0, invert_output: false, refine_foreground: false,
        background: 'Alpha', background_color: '#222222' });
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
    const scale = Math.min(requested, Math.max(64, pass.maxEdge || 4096) / Math.max(w, h));
    if (scale < requested) clampNotes.push(`Pass ${index + 2} capped to ${pass.maxEdge}px`);
    const resized = Math.abs(scale - 1) > 0.001;
    w = Math.max(8, Math.round(w * scale / 8) * 8);
    h = Math.max(8, Math.round(h * scale / 8) * 8);
    if (kind === 'upscale' || (resized && pass.upscaleMode === 'model')) {
      const loader = node(`${id}model`, 'UpscaleModelLoader', { model_name: pass.upscaleModel || workflow.upscaleModel });
      image = node(`${id}up`, 'ImageUpscaleWithModel', { image, upscale_model: loader });
      image = node(`${id}size`, 'ImageScale', { image, width: w, height: h, crop: 'disabled', upscale_method: 'lanczos' });
      samples = null;
    }
    if (kind === 'upscale') return;
    if (!samples) samples = node(`${id}encode`, 'VAEEncode', { pixels: image, vae });
    if (resized && pass.upscaleMode !== 'model') {
      samples = node(`${id}latent`, 'LatentUpscaleBy', { samples, upscale_method: 'nearest-exact', scale_by: scale });
    }
    samples = node(`${id}sample`, 'KSampler', {
      model, positive: ['6', 0], negative: ['7', 0], latent_image: samples,
      seed: Math.trunc(Number(pass.seed) || 0), steps: Math.max(1, Math.trunc(pass.steps)), cfg: pass.cfg,
      sampler_name: pass.sampler || workflow.sampler, scheduler: pass.scheduler || workflow.scheduler, denoise: pass.denoise,
    });
    image = node(`${id}decode`, 'VAEDecode', { samples, vae });
  });
  return { image, clampNotes };
}
