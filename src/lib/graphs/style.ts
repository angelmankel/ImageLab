import { activeRefs, featureOf, methodOf, stackFactor, styleFamily, type StyleRef } from '../styleRefs';
import type { GraphFamily } from '../modelProfiles';
import type { WorkflowState } from '../types';
import type { Graph, Ref } from './core';

/**
 * The Style stage (next UI's Style tab, `lib/styleRefs.ts`): after the LoRAs, before the sampler,
 * each active reference chains onto the MODEL — IP-Adapter (style / composition / subject),
 * FaceID Plus v2 / Portrait (+ its LoRA), PuLID — or onto the conditioning — InstantID (model +
 * positive + negative) and Flux Redux (positive). Node ids are `sr<i>…` (i = the ref's index).
 *
 * Input names were read from winold's live /object_info (ComfyUI 0.35.0, ComfyUI_IPAdapter_plus,
 * ComfyUI_InstantID, PuLID_ComfyUI, 10-20). Nothing here runs unless a reference is on, has a
 * picture that was uploaded (`images`: picture key → LoadImage ref) and was resolved for the
 * target server (`ref.use`, set by `resolveStyleRefs` at queue time) — so a workflow without
 * references builds the very same graph, byte for byte (tests/styleGraph.test.cjs).
 *
 * Conditioning changes are applied by `finish` once the whole graph (passes included) is built:
 * every reference to the prompt nodes "6" / "7" outside the stage is pointed at the stage's end,
 * so the base sampler, Loopback / refine passes and the inpaint ControlNet all get it.
 */
export interface StyleStage {
  model: Ref;
  /** Rewires the prompt references; call last. */
  finish: (graph: Graph) => void;
}

const sameRef = (a: unknown, b: Ref) => Array.isArray(a) && a[0] === b[0] && a[1] === b[1];

export function applyStyleRefs(
  graph: Graph,
  workflow: WorkflowState,
  family: GraphFamily,
  model: Ref,
  images: Record<string, string> | undefined,
): StyleStage {
  const noop: StyleStage = { model, finish: () => {} };
  if (!workflow.styleRefs?.length || !images) return noop;
  const fam = styleFamily(family);
  const refs = activeRefs(workflow.styleRefs, fam).filter((r) => r.use?.model && r.images.every((im) => images[im.key]));
  if (!refs.length) return noop;

  const own = new Set<string>();
  const add = (id: string, class_type: string, inputs: Record<string, unknown>): Ref => {
    graph[id] = { class_type, inputs };
    own.add(id);
    return [id, 0];
  };
  // One loader per file, shared by every reference that uses it.
  const loaders = new Map<string, Ref>();
  const loader = (id: string, class_type: string, inputs: Record<string, unknown>): Ref => {
    const key = `${class_type}|${JSON.stringify(inputs)}`;
    let ref = loaders.get(key);
    if (!ref) { ref = add(id, class_type, inputs); loaders.set(key, ref); }
    return ref;
  };
  const pictures = (p: string, r: StyleRef): Ref => {
    let img: Ref | null = null;
    r.images.forEach((im, j) => {
      const one = add(`${p}i${j}`, 'LoadImage', { image: images[im.key] });
      img = img ? add(`${p}b${j}`, 'ImageBatch', { image1: img, image2: one }) : one;
    });
    return img!;
  };

  let pos: Ref = ['6', 0];
  let neg: Ref = ['7', 0];
  const all = workflow.styleRefs;
  for (const r0 of refs) {
    // Stacked references are scaled so they do not fight (stackFactor; 1 when alone).
    const k = stackFactor(r0, refs);
    const r = k === 1 ? r0 : { ...r0, weight: Math.round(r0.weight * k * 1000) / 1000 };
    const i = all.indexOf(r0);
    const p = `sr${i}`;
    const use = r.use!;
    const span = { start_at: r.start, end_at: r.end };
    switch (featureOf(r)) {
      case 'ipadapter': {
        const ipa = loader(`${p}m`, 'IPAdapterModelLoader', { ipadapter_file: use.model });
        const cv = loader(`${p}c`, 'CLIPVisionLoader', { clip_name: use.clipVision ?? '' });
        model = add(`${p}a`, 'IPAdapterAdvanced', {
          model, ipadapter: ipa, image: pictures(p, r), weight: r.weight, weight_type: r.weightType ?? 'linear',
          combine_embeds: r.combine ?? 'concat', ...span, embeds_scaling: r.embedsScaling ?? 'V only', clip_vision: cv,
        });
        break;
      }
      case 'faceid': {
        const ipa = loader(`${p}m`, 'IPAdapterModelLoader', { ipadapter_file: use.model });
        const cv = loader(`${p}c`, 'CLIPVisionLoader', { clip_name: use.clipVision ?? '' });
        const face = loader(`${p}f`, 'IPAdapterInsightFaceLoader', { provider: 'CUDA', model_name: 'buffalo_l' });
        if (use.lora && methodOf(r) !== 'portrait') {
          model = add(`${p}l`, 'LoraLoaderModelOnly', { model, lora_name: use.lora, strength_model: r.loraStrength ?? 0.6 });
        }
        model = add(`${p}a`, 'IPAdapterFaceID', {
          model, ipadapter: ipa, image: pictures(p, r), weight: r.weight, weight_faceidv2: r.faceV2Weight ?? 1,
          weight_type: r.weightType ?? 'linear', combine_embeds: r.combine ?? 'concat', ...span, embeds_scaling: r.embedsScaling ?? 'V only',
          clip_vision: cv, insightface: face,
        });
        break;
      }
      case 'instantid': {
        const iid = loader(`${p}m`, 'InstantIDModelLoader', { instantid_file: use.model });
        const face = loader(`${p}f`, 'InstantIDFaceAnalysis', { provider: 'CUDA' });
        const cn = loader(`${p}n`, 'ControlNetLoader', { control_net_name: use.controlnet ?? '' });
        const combine = r.combine === 'norm average' || r.combine === 'concat' ? r.combine : 'average';
        add(`${p}a`, 'ApplyInstantIDAdvanced', {
          instantid: iid, insightface: face, control_net: cn, image: pictures(p, r), model, positive: pos, negative: neg,
          ip_weight: r.weight, cn_strength: r.cnStrength ?? 0.8, ...span, noise: r.noise ?? 0.35, combine_embeds: combine,
        });
        model = [`${p}a`, 0];
        pos = [`${p}a`, 1];
        neg = [`${p}a`, 2];
        break;
      }
      case 'pulid': {
        const pul = loader(`${p}m`, 'PulidModelLoader', { pulid_file: use.model });
        const eva = loader(`${p}e`, 'PulidEvaClipLoader', {});
        const face = loader(`${p}f`, 'PulidInsightFaceLoader', { provider: 'CUDA' });
        model = add(`${p}a`, 'ApplyPulid', {
          model, pulid: pul, eva_clip: eva, face_analysis: face, image: pictures(p, r), method: r.pulidMethod ?? 'fidelity', weight: r.weight, ...span,
        });
        break;
      }
      case 'redux': {
        const sm = loader(`${p}m`, 'StyleModelLoader', { style_model_name: use.model });
        const cv = loader(`${p}c`, 'CLIPVisionLoader', { clip_name: use.clipVision ?? '' });
        // One encode + apply per picture (each picture adds its own image tokens).
        r.images.forEach((im, j) => {
          const img = add(`${p}i${j}`, 'LoadImage', { image: images[im.key] });
          const enc = add(`${p}v${j}`, 'CLIPVisionEncode', { clip_vision: cv, image: img, crop: 'center' });
          pos = add(`${p}a${j}`, 'StyleModelApply', { conditioning: pos, style_model: sm, clip_vision_output: enc, strength: r.weight, strength_type: 'multiply' });
        });
        break;
      }
    }
  }

  const finalPos = pos;
  const finalNeg = neg;
  return {
    model,
    finish: (g) => {
      if (sameRef(finalPos, ['6', 0]) && sameRef(finalNeg, ['7', 0])) return;
      for (const [id, node] of Object.entries(g)) {
        if (own.has(id)) continue;
        for (const [k, v] of Object.entries(node.inputs)) {
          if (sameRef(v, ['6', 0])) node.inputs[k] = finalPos;
          else if (sameRef(v, ['7', 0])) node.inputs[k] = finalNeg;
        }
      }
    },
  };
}
