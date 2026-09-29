import { profileById } from '../modelProfiles';
import { buildSampledGraph, type BaseLoader, type Ref } from './core';
import type { GraphBuilder } from './types';

/**
 * Anima loaders, as in ImageLabDocker's workflows/Anima *.json: the file is a diffusion model only
 * (`UNETLoader`, diffusion_models/), so the text encoder (Qwen 3 0.6B via `CLIPLoader`, type
 * `stable_diffusion`) and the VAE (Qwen Image) load on their own. No built-in VAE and no clip
 * skip. Extra base models merge in like checkpoints do.
 */
const loadAnima: BaseLoader = (graph, workflow) => {
  const defaults = profileById(workflow.modelProfile)?.defaults ?? {};
  graph["4"] = { class_type: "UNETLoader", inputs: { unet_name: workflow.checkpoints[0]?.name ?? '', weight_dtype: "default" }};
  let model: Ref = ["4", 0];
  workflow.checkpoints.slice(1).forEach((ckpt, i) => {
    if (!ckpt.name) return;
    graph[`m${i}`] = { class_type: "UNETLoader", inputs: { unet_name: ckpt.name, weight_dtype: "default" }};
    graph[`mm${i}`] = { class_type: "ModelMergeSimple", inputs: { model1: model, model2: [`m${i}`, 0], ratio: Number(ckpt.ratio) }};
    model = [`mm${i}`, 0];
  });
  graph["4c"] = { class_type: "CLIPLoader", inputs: {
    clip_name: workflow.textEncoder || defaults.textEncoder || '', type: "stable_diffusion", device: "default",
  }};
  graph["4v"] = { class_type: "VAELoader", inputs: { vae_name: workflow.vae || defaults.vae || '' }};
  return { model, clip: ["4c", 0], vae: ["4v", 0] };
};

export const buildAnimaGraph: GraphBuilder = (workflow, layers, inputImageRef, inpaint) =>
  buildSampledGraph(workflow, layers, inputImageRef, inpaint, loadAnima, { inpaintControlnet: false });
