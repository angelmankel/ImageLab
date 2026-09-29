import { profileById } from '../modelProfiles';
import type { WorkflowState } from '../types';
import { buildSampledGraph, type BaseLoader, type CoreOptions, type Graph, type Ref } from './core';
import type { GraphBuilder } from './types';

/**
 * Loaders for families whose file is usually a diffusion model only (diffusion_models/,
 * `UNETLoader`): the text encoder and VAE load on their own, from the workflow or the type's
 * defaults. An all-in-one checkpoint of the type (`workflow.baseFile === 'checkpoint'`, e.g. a
 * Qwen AIO) loads through `CheckpointLoaderSimple` with its own text encoder and VAE instead.
 * Extra base models merge in like checkpoints do. No clip skip; the inpaint ControlNets are SD ones.
 */
export type DiffusionSpec = {
  /** Adds the text encoder node(s) and returns the CLIP. `file` is the chosen or default encoder. */
  clip: (graph: Graph, file: string) => Ref;
  /** `ModelSamplingAuraFlow` shift, for the flow models that want one. */
  auraFlowShift?: number;
  /** Extra core behaviour (e.g. Flux's guidance on the positive prompt). */
  core?: Partial<CoreOptions>;
};

function loader(spec: DiffusionSpec): BaseLoader {
  return (graph, workflow: WorkflowState) => {
    const defaults = profileById(workflow.modelProfile)?.defaults ?? {};
    const aio = workflow.baseFile === 'checkpoint';
    const load = (name: string) => (aio
      ? { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: name } }
      : { class_type: "UNETLoader", inputs: { unet_name: name, weight_dtype: "default" } });
    graph["4"] = load(workflow.checkpoints[0]?.name ?? '');
    let model: Ref = ["4", 0];
    workflow.checkpoints.slice(1).forEach((ckpt, i) => {
      if (!ckpt.name) return;
      graph[`m${i}`] = load(ckpt.name);
      graph[`mm${i}`] = { class_type: "ModelMergeSimple", inputs: { model1: model, model2: [`m${i}`, 0], ratio: Number(ckpt.ratio) }};
      model = [`mm${i}`, 0];
    });
    if (spec.auraFlowShift !== undefined) {
      graph["4s"] = { class_type: "ModelSamplingAuraFlow", inputs: { model, shift: spec.auraFlowShift }};
      model = ["4s", 0];
    }
    if (aio) {
      // The checkpoint's own text encoder; its own VAE unless one was picked apart from the type's.
      const ownVae = !workflow.vae || workflow.vae === defaults.vae;
      if (!ownVae) graph["4v"] = { class_type: "VAELoader", inputs: { vae_name: workflow.vae }};
      return { model, clip: ["4", 1], vae: ownVae ? ["4", 2] : ["4v", 0] };
    }
    const clip = spec.clip(graph, workflow.textEncoder || defaults.textEncoder || '');
    graph["4v"] = { class_type: "VAELoader", inputs: { vae_name: workflow.vae || defaults.vae || '' }};
    return { model, clip, vae: ["4v", 0] };
  };
}

/** A family's builder from its spec. */
export function diffusionBuilder(spec: DiffusionSpec): GraphBuilder {
  const load = loader(spec);
  return (workflow, layers, inputImageRef, inpaint) =>
    buildSampledGraph(workflow, layers, inputImageRef, inpaint, load, { inpaintControlnet: false, inpaintSize: 1024, ...spec.core });
}

/** One text encoder through `CLIPLoader` of the given type. */
export function singleClip(type: string): DiffusionSpec['clip'] {
  return (graph, file) => {
    graph["4c"] = { class_type: "CLIPLoader", inputs: { clip_name: file, type, device: "default" }};
    return ["4c", 0];
  };
}
