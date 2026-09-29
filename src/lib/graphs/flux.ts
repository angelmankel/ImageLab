import { diffusionBuilder } from './diffusion';

/**
 * Flux.1 (dev / schnell), as in ImageLabDocker's workflows/Flux Dev.json: CLIP-L plus T5-XXL
 * (`DualCLIPLoader`, type `flux`; the T5 file is the chosen text encoder), the Flux VAE, CFG 1
 * and the distilled guidance (3.5) on the positive prompt.
 */
export const buildFluxGraph = diffusionBuilder({
  clip: (graph, t5) => {
    graph["4c"] = { class_type: "DualCLIPLoader", inputs: { clip_name1: "clip_l.safetensors", clip_name2: t5, type: "flux", device: "default" }};
    return ["4c", 0];
  },
  core: { positiveGuidance: 3.5 },
});
