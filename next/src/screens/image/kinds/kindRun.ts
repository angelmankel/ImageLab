/**
 * Generate for the Refine / Upscale / Remove BG steps (fix list 15, 22, 43). Each takes the step's
 * input by the one rule (`stepInputNow`: the step above's newest or picked result, or its own
 * picture), runs on the workflow runner (`useWorkflowRun`, so the queue, Stop and the stage see
 * it) on the Workflow server, and credits its results to the step (`trackRun`).
 *
 *  - Refine: the session's model, LoRAs and prompt (step 1's), Loopback's rounds with the step's
 *    own settings (N rounds, × growth, denoise…) — the classic graph in img2img mode with its base
 *    sampler taken out, so round 1 starts from the input.
 *  - Upscale: an upscale model to exactly ×factor (a lanczos resize when the server has none),
 *    then, when "Refine after upscale" is on, one light re-sample at the step's denoise.
 *  - Remove BG: ComfyUI core BiRefNet (`~/app/removeBg`), an RGBA PNG.
 *
 * A picture already on that server is used in place (`serverRef`), never fetched and re-sent.
 */
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { comfyHttpFor, viewUrl } from '@/lib/comfyHost';
import { buildGraph } from '@/lib/graphs';
import { createPass, prepareSeeds, withPipeline } from '@/lib/pipeline';
import { withModelKeywords } from '@/lib/modelKeywords';
import { withEmbeddings } from '@/lib/embeddings';
import { profileTagTexts, withProfileTags } from '@/lib/modelProfiles';
import { modelTrainedWords } from '@/components/models/modelInfo';
import type { WorkflowState } from '@/lib/types';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { modeHostNow } from '@/features/workspace/modeHost';
import { removeBgGraph, removeBgModels, pickRemoveBgModel } from '~/app/removeBg';
import { useSteps, DEFAULT_REFINE, DEFAULT_UPSCALE, clampFactor, modelScale, type Step } from '~/app/stepsStore';
import { stepInputNow } from '../useStepOutput';
import { uploadSource } from '../workflow/stepRun';
import { serverRef, skipBaseSampler, outputIsInput, upscaleGraph, type ApiGraph } from './kindGraphs';
import { trackRun } from './trackRun';

/** The kinds this runner makes. */
export const OWN_KINDS = new Set<Step['kind']>(['refine', 'upscale', 'remove-bg']);

/** A LoadImage name for the step's input on `host`, plus the picture's size when it can be read. */
async function inputRef(step: Step, host: string): Promise<{ ref: string; width?: number; height?: number } | { error: string }> {
  const res = stepInputNow(step.id);
  if (!res || res.kind === 'none') return { error: 'Needs an image: follow the step above, or add one in Composition' };
  if (res.kind === 'waiting') return { error: `Step ${useSteps.getState().steps.indexOf(res.from) + 1} has no output yet — generate it first` };
  const src = res.src;
  let ref = serverRef(src.url, comfyHttpFor(host));
  if (!ref) {
    try { ref = await uploadSource(host, src); } catch (e) { return { error: `Could not send the picture: ${e instanceof Error ? e.message : String(e)}` }; }
  }
  const dims = await sizeOf(refUrl(host, ref)).catch(() => null);
  return { ref, ...(dims ?? {}) };
}

/** The /view URL of a LoadImage name ("sub/x.png [output]"). */
function refUrl(host: string, ref: string): string {
  const m = /^(.*?)(?: \[(\w+)\])?$/.exec(ref)!;
  const path = m[1];
  const i = path.lastIndexOf('/');
  return viewUrl({ filename: path.slice(i + 1), subfolder: i >= 0 ? path.slice(0, i) : '', type: m[2] || 'input' }, host);
}

function sizeOf(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('could not read the picture'));
    img.src = url;
  });
}

/** The session's prompt as the classic queue sends it (quality tags, trigger words, embeddings). */
function sessionLayers(wf: WorkflowState) {
  const layers = useStore.getState().layers;
  return withProfileTags(withEmbeddings(withModelKeywords(layers, wf, modelTrainedWords, profileTagTexts(wf)), wf, modelTrainedWords), wf);
}

/** Checkpoint vs diffusion model, from what `host` lists (what GenerateButton does per target). */
function baseFileOn(host: string, wf: WorkflowState): WorkflowState['baseFile'] {
  const st = useStore.getState();
  const server = st.servers.find((s) => s.host === host);
  const info = server ? st.serverInfo[server.id] : undefined;
  const name = wf.checkpoints[0]?.name ?? '';
  return info && info.models.includes(name) && !info.diffusionModels.includes(name) ? 'checkpoint' : 'diffusion';
}

function upscaleModelsOn(host: string): string[] {
  const st = useStore.getState();
  const server = st.servers.find((s) => s.host === host);
  return (server && st.serverInfo[server.id]?.upscaleModels) || [];
}

/** The classic graph for `wf` in img2img mode on `ref`, base sampler out, saved under `prefix`. */
function sessionGraph(wf: WorkflowState, ref: string, prefix: string): { graph: ApiGraph } | { error: string } {
  if (!wf.checkpoints[0]?.name) return { error: 'Pick a model in step 1 first' };
  const built = buildGraph(wf, sessionLayers(wf), ref) as { graph: ApiGraph };
  const graph = skipBaseSampler(built.graph);
  if (!graph) return { error: 'Could not build the graph' };
  if (outputIsInput(graph)) return { error: 'Nothing to re-sample: set at least one round' };
  graph['9'] = { class_type: 'SaveImage', inputs: { images: graph['9'].inputs.images, filename_prefix: prefix } };
  return { graph };
}

/** The workflow as an img2img source of the picture's size (no client-side rescale). */
function asImg2img(step: Step, newSeed: boolean, input: { width?: number; height?: number }): WorkflowState {
  const st = useStore.getState();
  const wf = prepareSeeds(st.workflow, newSeed);
  const width = input.width ?? wf.width;
  const height = input.height ?? wf.height;
  return {
    ...wf, ...withPipeline([]), batch: 1, inputImage: { dataUrl: '', name: step.name, width, height } as WorkflowState['inputImage'],
    inputMaxSize: 0, inputMinSize: 0, width, height,
  };
}

async function buildFor(step: Step, host: string, newSeed: boolean): Promise<{ graph: ApiGraph } | { error: string }> {
  const input = await inputRef(step, host);
  if ('error' in input) return input;
  if (step.kind === 'remove-bg') {
    const models = await removeBgModels(host);
    if (models === null) return { error: 'This server has no background removal node — update ComfyUI (core "Remove Background")' };
    const model = step.params?.removeBg?.model || pickRemoveBgModel(models);
    if (!model) return { error: 'No background removal model on this server — put birefnet.safetensors in models/background_removal' };
    return { graph: removeBgGraph(input.ref, model, 'imagelab/removebg') as ApiGraph };
  }
  if (step.kind === 'refine') {
    const base = asImg2img(step, newSeed, input);
    const lb = { ...DEFAULT_REFINE, ...step.params?.refine, enabled: true };
    const wf: WorkflowState = { ...base, loopback: lb, baseFile: baseFileOn(host, base) };
    return sessionGraph(wf, input.ref, 'imagelab/refine');
  }
  // Upscale.
  const p = { ...DEFAULT_UPSCALE, ...step.params?.upscale };
  const factor = clampFactor(p.factor);
  const models = upscaleModelsOn(host);
  const model = p.model && models.includes(p.model) ? p.model : models[0] ?? null;
  if (!p.refine) return { graph: upscaleGraph({ ref: input.ref, model, factor, width: input.width, height: input.height, nativeScale: model ? modelScale(model) : undefined }) };
  const base = asImg2img(step, newSeed, input);
  const up = model
    ? { ...createPass(base, 'upscale', 'up'), scale: factor, maxEdge: 16384, upscaleModel: model }
    : { ...createPass(base, 'resize', 'up'), resizeMode: 'factor' as const, scale: factor };
  const refine = { ...createPass(base, 'sample', 'refine'), scale: 1, maxEdge: 16384, denoise: p.denoise, steps: p.steps, seed: (base.seed + 1) % 0x100000000 };
  const wf: WorkflowState = { ...base, ...withPipeline([up, refine]), loopback: undefined, baseFile: baseFileOn(host, base) };
  return sessionGraph(wf, input.ref, 'imagelab/upscale');
}

/**
 * Run a Refine / Upscale / Remove BG step. Resolves when the run has ENDED: null, or why it
 * failed (also shown as a 3 s note unless `quiet`).
 */
export async function runKindStep(step: Step, newSeed = false, quiet = false): Promise<string | null> {
  const fail = (msg: string) => { if (!quiet) notifications.show({ title: 'Could not generate', message: msg, color: 'red', autoClose: 3000 }); return msg; };
  const host = modeHostNow('workflow');
  if (!host) return fail('No ComfyUI server');
  const store = useWorkflowRun;
  if (store.getState().busy) return fail('The runner is busy with another step — wait for it or Stop it');
  store.getState().setHost(host);
  const tracked = trackRun(store, step.id);
  await store.getState().run({ build: () => buildFor(step, host, newSeed) });
  if (!tracked.started() && !store.getState().busy) tracked.cancel(store.getState().error ?? 'Did not start');
  const err = await tracked.done;
  return err ? fail(err) : null;
}

/** The step's run state for the Generate bar (the workflow runner's). */
export const kindRunStore = useWorkflowRun;
