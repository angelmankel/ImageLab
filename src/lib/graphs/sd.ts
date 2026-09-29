import { applyClipSkip } from '../pipeline';
import { buildSampledGraph, type BaseLoader, type Ref } from './core';
import type { GraphBuilder } from './types';

/**
 * Stable Diffusion loaders: SD 1.5 and every SDXL-derived type (SDXL, Pony, Illustrious, NoobAI).
 * One checkpoint gives model, CLIP and VAE. Extra checkpoints blend their UNet into the base via
 * ModelMergeSimple; CLIP and VAE always come from the base, unless a VAE file is chosen.
 */
const loadCheckpoint: BaseLoader = (graph, workflow) => {
  graph["4"] = { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: workflow.checkpoints[0]?.name ?? '' }};
  let model: Ref = ["4", 0];
  const clip = applyClipSkip(graph, workflow, ["4", 1]);
  workflow.checkpoints.slice(1).forEach((ckpt, i) => {
    if (!ckpt.name) return;
    graph[`m${i}`] = { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt.name }};
    graph[`mm${i}`] = { class_type: "ModelMergeSimple", inputs: { model1: model, model2: [`m${i}`, 0], ratio: Number(ckpt.ratio) }};
    model = [`mm${i}`, 0];
  });
  // An explicit VAELoader when one is chosen, otherwise the checkpoint's built-in VAE.
  let vae: Ref = ["4", 2];
  if (workflow.vae) {
    graph["4v"] = { class_type: "VAELoader", inputs: { vae_name: workflow.vae }};
    vae = ["4v", 0];
  }
  return { model, clip, vae };
};

export const buildSdGraph: GraphBuilder = (workflow, layers, inputImageRef, inpaint) =>
  buildSampledGraph(workflow, layers, inputImageRef, inpaint, loadCheckpoint);
