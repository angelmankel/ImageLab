import { diffusionBuilder, singleClip } from './diffusion';

/**
 * Z-Image Turbo, as in ImageLabDocker's workflows/Z-Image Turbo.json: Qwen 3 4B text encoder
 * (`CLIPLoader`, type `lumina2`), the Flux VAE, `ModelSamplingAuraFlow` shift 3.
 */
export const buildZImageGraph = diffusionBuilder({ clip: singleClip("lumina2"), auraFlowShift: 3 });
