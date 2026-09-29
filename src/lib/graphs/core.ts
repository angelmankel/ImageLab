import { appendPasses, applyBreaks } from '../pipeline';
import { compileLayers } from '../prompt';
import type { Layer, WorkflowState } from '../types';
import { scaleForLongestEdge } from '@/features/inputImage/imageOps';
import type { BuildGraphResult, InpaintConfig } from './types';

export type Ref = [string, number];
export type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

/**
 * A family's own part: add the base model's loader nodes (node "4" and whatever it needs — merges,
 * clip skip, a separate text encoder or VAE) and say where model, CLIP and VAE come from. LoRAs
 * go on after it, in the shared part.
 */
export type BaseLoader = (graph: Graph, workflow: WorkflowState) => { model: Ref; clip: Ref; vae: Ref };

export type CoreOptions = {
  /** The inpaint ControlNet models are SD ones; a family without them skips that step. */
  inpaintControlnet: boolean;
  /** Square side the inpaint crop samples at when its size is 'auto': the model's native size. */
  inpaintSize: number;
};

/**
 * The graph every family shares once its loaders are in: prompts (with BREAK), LoRA chain,
 * txt2img / img2img / inpaint, VAE decode, then Loopback and the Passes list.
 */
export function buildSampledGraph(
  workflow: WorkflowState,
  layers: Layer[],
  inputImageRef: string | null,
  inpaint: InpaintConfig | null,
  load: BaseLoader,
  options: CoreOptions = { inpaintControlnet: true, inpaintSize: 1024 },
): BuildGraphResult {
  // Seeds can be up to 0xFFFFFFFF (4.29e9), which overflows the signed 32-bit
  // range that `| 0` truncates to — ComfyUI then rejects the resulting negative
  // value. Use Math.trunc to keep the full unsigned range intact.
  const seed   = Math.trunc(Number(workflow.seed) || 0);
  const cfg    = Number(workflow.cfg);
  const baseW  = Number(workflow.width)  | 0;
  const baseH  = Number(workflow.height) | 0;

  const positive = compileLayers(layers, 'positive');
  const negative = compileLayers(layers, 'negative');

  const graph: Record<string, { class_type: string; inputs: Record<string, unknown> }> = {
    "3": { class_type: "KSampler", inputs: {
      seed,
      steps: Number(workflow.steps) | 0,
      cfg,
      sampler_name: workflow.sampler,
      scheduler: workflow.scheduler,
      denoise: Number(workflow.denoise),
      model: ["4", 0],
      positive: ["6", 0],
      negative: ["7", 0],
      latent_image: ["5", 0],
    }},
    "5": { class_type: "EmptyLatentImage", inputs: {
      width: baseW,
      height: baseH,
      batch_size: Number(workflow.batch) | 0,
    }},
    "6": { class_type: "CLIPTextEncode", inputs: { text: positive, clip: ["4", 1] }},
    "7": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["4", 1] }},
  };

  const base = load(graph, workflow);
  let modelRef: Ref = base.model;
  let clipRef: Ref = base.clip;

  // LoRA chain — each enabled LoRA threads model + clip through a LoraLoader,
  // so the sampler and CLIP encoders read from the end of the chain instead of
  // straight off the checkpoint. Bypassed / unnamed LoRAs are skipped.
  (workflow.loras ?? []).forEach((lora, i) => {
    if (!lora.on || !lora.name) return;
    const id = `l${i}`;
    graph[id] = { class_type: "LoraLoader", inputs: {
      lora_name: lora.name,
      strength_model: Number(lora.strength),
      strength_clip: Number(lora.clipStrength),
      model: modelRef,
      clip: clipRef,
    }};
    modelRef = [id, 0];
    clipRef = [id, 1];
  });
  graph["3"].inputs.model = modelRef;
  graph["6"].inputs.clip = clipRef;
  graph["7"].inputs.clip = clipRef;
  applyBreaks(graph, "6");
  applyBreaks(graph, "7");

  const vaeRef: Ref = base.vae;

  // img2img / inpaint: when an uploaded input image is supplied, encode it
  // into a latent and feed that into the base sampler instead of the empty
  // latent.
  //
  //  - No mask (plain img2img): VAEEncode → KSampler at `inputDenoise`.
  //
  //  - With mask (from-canvas inpaint): InpaintCropImproved auto-crops the
  //    context around the mask, resizes to the target sampling resolution,
  //    and returns a `stitcher` opaque object that the matching
  //    InpaintStitchImproved uses to seam-blend the inpainted crop back
  //    into the *untouched* original. Crucially this means the unmasked
  //    region NEVER goes through VAE encode/decode — it stays pixel-perfect
  //    — which fixes the round-trip wash-out that plagued the previous
  //    implementation. Inside the crop, the variant decides how the masked
  //    pixels are primed for KSampler (mid-grey fill via VAEEncodeForInpaint
  //    for the "create from nothing" case, vs. actual pixels via
  //    SetLatentNoiseMask for the "vary the underlying pixels" case).
  if (inputImageRef) {
    graph["i0"] = { class_type: "LoadImage", inputs: { image: inputImageRef }};

    if (inpaint) {
      graph["iM"] = { class_type: "LoadImageMask", inputs: {
        image: inpaint.maskRef,
        channel: "red",
      }};

      // Server-side mask feather. The mask comes in as a hard binary; we
      // soften its alpha here so the SAME soft mask drives both the
      // KSampler latent noise scope and the InpaintStitch alpha blend.
      // Pipeline: mask → MaskToImage → ImageBlur → ImageToMask. Skipped
      // when feather is 0 — the hard mask wires straight into iCrop.
      // ComfyUI's built-in ImageBlur clamps blur_radius to 1..31 (it's the
      // gaussian kernel half-size) and sigma to 0.1..10.0. We clamp to the
      // node's range so the prompt validates — exceeding either fails
      // validation outright. The slider UI cap matches this.
      const featherPx = Math.max(0, Math.min(31, Math.round(inpaint.blendPx)));
      let maskRef: [string, number] = ["iM", 0];
      if (featherPx > 0) {
        graph["iMI"] = { class_type: "MaskToImage", inputs: { mask: ["iM", 0] }};
        graph["iMB"] = { class_type: "ImageBlur", inputs: {
          image: ["iMI", 0],
          blur_radius: featherPx,
          // Half the radius is a tasteful gaussian curve (≈ photoshop's
          // "feather selection"). Clamped to the node's 0.1..10.0 range.
          sigma: Math.max(0.1, Math.min(10.0, featherPx / 2)),
        }};
        graph["iM2"] = { class_type: "ImageToMask", inputs: {
          image: ["iMB", 0],
          channel: "red",
        }};
        maskRef = ["iM2", 0];
      }
      // 'auto' used to mean "let InpaintCropImproved pick its own size
      // (= the natural cropped resolution)". That's fine for huge masks
      // but disastrous for small ones — the sampler would run at, say,
      // 200×200 and produce noise. Always resize to a model-friendly
      // resolution: the family's native size (1024² for SDXL-class and
      // Anima, 512² for SD 1.5); users wanting finer control pick an
      // explicit number from the dropdown.
      const targetSize = inpaint.targetSize === 'auto'
        ? options.inpaintSize
        : Math.max(64, Math.round(inpaint.targetSize as number));

      graph["iCrop"] = { class_type: "InpaintCropImproved", inputs: {
        image: ["i0", 0],
        mask: maskRef,
        downscale_algorithm: "bilinear",
        upscale_algorithm: "bicubic",
        preresize: false,
        preresize_mode: "ensure minimum resolution",
        preresize_min_width: 1024,
        preresize_min_height: 1024,
        preresize_max_width: 16384,
        preresize_max_height: 16384,
        // Hole-fill closes black islands inside white mask regions. That's
        // useful for free-hand masks where the user accidentally leaves
        // gaps, but it'd undo the neighbour cutouts our invert-mask path
        // adds — the preserved neighbour rect is exactly the kind of
        // "enclosed black region" hole-fill targets. Off when inverted.
        mask_fill_holes: !inpaint.invertMask,
        mask_expand_pixels: Math.max(0, Math.min(256, Math.round(inpaint.maskExpand))),
        mask_invert: false,
        // Stitch-side blend stays at 0 — the feather is already baked into
        // the mask alpha by the MaskToImage→ImageBlur→ImageToMask chain
        // above. Any non-zero value here would compound the blur and
        // over-smudge the edge.
        mask_blend_pixels: 0,
        // Hipass filter trims low-alpha noise from the mask. With our
        // client-side feathered masks (gaussian blur baked into the alpha)
        // this would threshold the soft edge back to hard, defeating the
        // feather. Both our painted-mask and bounds-mask paths produce
        // clean masks already, so we can safely disable it.
        mask_hipass_filter: 0,
        extend_for_outpainting: false,
        extend_up_factor: 1.0,
        extend_down_factor: 1.0,
        extend_left_factor: 1.0,
        extend_right_factor: 1.0,
        // When the user asked for invert-mask (extend-into-empty-area), the
        // mask is the new region and the only signal of the image's style /
        // colour the model sees is the surrounding crop — so we floor the
        // context expansion at 3.0 to make sure enough of the existing
        // neighbour pixels land inside the crop window. Without that floor,
        // a 1.5× crop around a half-bounds mask barely includes any of the
        // image being extended and the model just generates fresh content
        // from the prompt instead of matching style.
        context_from_mask_extend_factor: inpaint.invertMask
          ? Math.max(3.0, Number(inpaint.contextExtend) || 3.0)
          : Math.max(1.0, Number(inpaint.contextExtend) || 1.5),
        output_resize_to_target_size: true,
        output_target_width: targetSize,
        output_target_height: targetSize,
        // When letting the crop pick its own size, round to 32px (latent-friendly).
        output_padding: "32",
        device_mode: "gpu (much faster)",
      }};
      const croppedImage: [string, number] = ["iCrop", 1];
      const croppedMask:  [string, number] = ["iCrop", 2];

      // ControlNet inpaint bias — when configured, route positive/negative
      // through ControlNetApplyAdvanced fed by InpaintPreprocessor(image,
      // mask). The sampler then samples under the CN's structural
      // guidance, which typically tightens edge coherence and improves
      // outpainting. Requires the `controlnet_aux` custom node on the
      // server for InpaintPreprocessor. Falls back gracefully — if the
      // user toggles this on without picking a model, we skip the chain.
      if (options.inpaintControlnet && inpaint.controlnet && inpaint.controlnet.model) {
        graph["cnL"] = { class_type: "ControlNetLoader", inputs: {
          control_net_name: inpaint.controlnet.model,
        }};
        // xinsir's ControlNet Union (and other multi-purpose CNs) ship a
        // single set of weights covering many control modes. Without an
        // explicit type, the model picks one heuristically — usually NOT
        // the one you want. Detect "union" / "promax" in the filename and
        // insert SetUnionControlNetType(inpaint) so the model knows what
        // it's being asked to do.
        let cnRef: [string, number] = ["cnL", 0];
        const fname = inpaint.controlnet.model.toLowerCase();
        if (fname.includes('union') || fname.includes('promax')) {
          graph["cnT"] = { class_type: "SetUnionControlNetType", inputs: {
            control_net: ["cnL", 0],
            // ControlNet Union calls its inpaint mode "repaint" in the
            // enum — not "inpaint". Anything else trips a validation
            // error like: "Value not in list: type".
            type: "repaint",
          }};
          cnRef = ["cnT", 0];
        }
        graph["cnP"] = { class_type: "InpaintPreprocessor", inputs: {
          image: croppedImage,
          mask: croppedMask,
        }};
        graph["cnA"] = { class_type: "ControlNetApplyAdvanced", inputs: {
          positive: ["6", 0],
          negative: ["7", 0],
          control_net: cnRef,
          image: ["cnP", 0],
          strength: Math.max(0, Math.min(2, inpaint.controlnet.strength)),
          start_percent: 0.0,
          end_percent: 1.0,
        }};
        graph["3"].inputs.positive = ["cnA", 0];
        graph["3"].inputs.negative = ["cnA", 1];
      }

      // ControlNet inpaint can't share a graph with VAEEncodeForInpaint —
      // the mid-grey fill + denoise=1.0 + CN conditioning destabilise the
      // sampler and it outputs pure noise on decode (the cyan-speckle
      // symptom). When CN is active we always route through the noise-
      // mask path with the user's `inputDenoise`, regardless of variant.
      const cnActive = !!(options.inpaintControlnet && inpaint.controlnet && inpaint.controlnet.model);
      if (inpaint.variant === 'destructive' && !cnActive) {
        // Mid-grey fill in mask area before encoding → model creates from
        // nothing using cropped surroundings as context. Denoise forced to
        // 1.0 because this node only makes sense with full noise.
        graph["i1"] = { class_type: "VAEEncodeForInpaint", inputs: {
          pixels: croppedImage,
          vae: vaeRef,
          mask: croppedMask,
          grow_mask_by: 0,
        }};
        graph["3"].inputs.latent_image = ["i1", 0];
        graph["3"].inputs.denoise = 1.0;
      } else {
        // Encode the cropped image normally, attach the cropped mask as a
        // noise mask on the latent. KSampler only adds noise / denoises
        // inside the mask, varying the underlying pixels at `inputDenoise`.
        graph["i1"] = { class_type: "VAEEncode", inputs: { pixels: croppedImage, vae: vaeRef }};
        graph["iN"] = { class_type: "SetLatentNoiseMask", inputs: {
          samples: ["i1", 0],
          mask: croppedMask,
        }};
        graph["3"].inputs.latent_image = ["iN", 0];
        graph["3"].inputs.denoise = Number(workflow.inputDenoise);
      }
    } else {
      // Plain img2img — no mask, denoise the whole frame.
      graph["i1"] = { class_type: "VAEEncode", inputs: { pixels: ["i0", 0], vae: vaeRef }};
      graph["3"].inputs.latent_image = ["i1", 0];
      graph["3"].inputs.denoise = Number(workflow.inputDenoise);
    }

    // The empty latent is no longer wired up; drop it to keep the graph tidy.
    delete graph["5"];
  }

  let curW = baseW, curH = baseH;
  if (inputImageRef && workflow.inputImage && !inpaint) {
    const scale = scaleForLongestEdge(workflow.inputImage.width, workflow.inputImage.height, workflow.inputMaxSize, workflow.inputMinSize);
    curW = Math.round(workflow.inputImage.width * scale);
    curH = Math.round(workflow.inputImage.height * scale);
  }
  graph["8"] = { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: vaeRef } };
  let img: [string, number] = ["8", 0];
  if (inpaint) {
    graph["iStitch"] = { class_type: "InpaintStitchImproved", inputs: {
      stitcher: ["iCrop", 0], inpainted_image: img,
    }};
    img = ["iStitch", 0];
  }
  const pipeline = appendPasses(graph, workflow, img, inpaint ? null : ["3", 0], modelRef, vaeRef, curW, curH, !!inpaint);
  img = pipeline.image;
  const clampNotes = pipeline.clampNotes;

  // PreviewImage drops the result into ComfyUI's `temp/` folder instead of
  // `output/`. ComfyUI wipes `temp/` on next startup, so unfavorited generations
  // self-clean. Explicit favorites are copied into the imagelab_favorites tree
  // by /imagelab/api/favorites and survive restarts. See `lib/favorites.ts`.
  graph["9"] = { class_type: "PreviewImage", inputs: { images: img }};
  return { graph, clampNotes };
}
