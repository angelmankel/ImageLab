import type { Layer, WorkflowState } from '../types';
import type { GraphFamily } from '../modelProfiles';

/** Inpaint-mode hookup for `buildGraph`. The input image is the captured
 *  canvas context (typically wider than the target region) and the mask
 *  scopes the change to the white area. We use `InpaintCropImproved` to
 *  auto-crop the context around the mask + resize to a target sampling
 *  resolution, then `InpaintStitchImproved` to seam-blend the inpainted
 *  crop back into the untouched original — this bypasses VAE encode/decode
 *  on the unmasked region entirely (fixes wash-out).
 *
 *  The variant decides how the masked area inside the crop is fed into the
 *  latent:
 *   - `destructive`  → `VAEEncodeForInpaint` (mid-grey fill in mask before
 *     encoding; denoise forced to 1.0). Use for "create from nothing".
 *   - `denoising`    → `VAEEncode` + `SetLatentNoiseMask` (encodes the actual
 *     pixels in the mask; KSampler denoises only inside). Use for "vary the
 *     underlying pixels at `inputDenoise`". */
export type InpaintConfig = {
  maskRef: string;
  variant: 'destructive' | 'denoising';
  /** Soft blend at the mask edge, in pixels (0..64). Maps to InpaintCrop's
   *  `mask_blend_pixels`; the stitch step uses this to seamlessly fade the
   *  inpainted crop into the original. */
  blendPx: number;
  /** Dilate the mask by N pixels before inpainting. Maps to
   *  InpaintCropImproved `mask_expand_pixels`. 0 = mask as-painted. */
  maskExpand: number;
  /** Optional ControlNet conditioning. When `model` is set + non-empty,
   *  the graph inserts ControlNetLoader → InpaintPreprocessor →
   *  ControlNetApplyAdvanced before KSampler so the sampler is biased by
   *  an inpaint CN (better seam coherence + outpainting). Requires the
   *  controlnet_aux custom node on the server. */
  controlnet: { model: string; strength: number } | null;
  /** How far to expand the crop region beyond the mask bbox. 1.0 = exactly
   *  the mask; 1.5 = 50% padding each side; etc. Larger gives the model
   *  more surrounding context to blend into, but eats into the effective
   *  inpaint resolution if `targetSize` is fixed. */
  contextExtend: number;
  /** Sampling resolution for the cropped+resized region.
   *   - `'auto'` → use the crop's natural pixel size, rounded up to a 32px
   *     multiple (latent-friendly). Lets the crop choose its own resolution.
   *   - explicit number → force a square `N×N` sampling. Cranking this above
   *     the natural crop size = inpaint at higher resolution than the
   *     captured context (the "add detail to a small region" use case). */
  targetSize: 'auto' | number;
  /** True when the captured mask was inverted (cuts out neighbour overlaps
   *  so only the non-overlap area gets inpainted). Used to crank the
   *  context_from_mask_extend_factor floor so the model sees enough of the
   *  preserved neighbour pixels to extend their style instead of generating
   *  unrelated fresh content. */
  invertMask: boolean;
};

export type BuildGraphResult = {
  graph: Record<string, unknown>;
  /** Human-readable lines for each pass whose scale was clamped down to
   *  honor `maxEdge`. Empty array when nothing was clamped. */
  clampNotes: string[];
};

/** What every family's builder gets: the same inputs `buildGraph` takes. */
export type GraphBuilder = (
  workflow: WorkflowState,
  layers: Layer[],
  inputImageRef: string | null,
  inpaint: InpaintConfig | null,
  family: GraphFamily,
) => BuildGraphResult;
