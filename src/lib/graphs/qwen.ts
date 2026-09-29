import { diffusionBuilder, singleClip } from './diffusion';

/**
 * Qwen-Image, as in ImageLabDocker's workflows/Qwen Image.json: Qwen 2.5 VL 7B text encoder
 * (`CLIPLoader`, type `qwen_image`), the Qwen Image VAE, `ModelSamplingAuraFlow` shift 3.1.
 */
export const buildQwenGraph = diffusionBuilder({ clip: singleClip("qwen_image"), auraFlowShift: 3.1 });
