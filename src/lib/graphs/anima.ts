import { diffusionBuilder, singleClip } from './diffusion';

/**
 * Anima, as in ImageLabDocker's workflows/Anima *.json: Qwen 3 0.6B text encoder (`CLIPLoader`,
 * type `stable_diffusion`) and the Qwen Image VAE.
 */
export const buildAnimaGraph = diffusionBuilder({ clip: singleClip("stable_diffusion") });
