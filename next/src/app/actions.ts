/**
 * Cross-screen actions. The Library, Models and ComfyUI screens call these; the Image step
 * implements them against the main app's stores. Plain functions, callable from any event
 * handler without hooks. Every prompt replace offers Undo (the main app's `applyWithUndo`).
 */
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/storage';
import type { HistoryEntry, Layer, WorkflowState } from '@/lib/types';
import { applyWithUndo } from '@/features/layers/PresetLibraryModal';
import { sendToVideo, sendToWorkflow } from '@/features/workspace/sendTo';
import { urlToImageState } from '@/features/inputImage/imageOps';
import { useRoute } from './routeStore';
import { nextStepId, useSteps } from './stepsStore';

/** Put this prompt (positive + negative) into the active step's prompt. */
export function usePromptFrom(entry: Pick<HistoryEntry, 'positive' | 'negative'>, name = 'that image'): void {
  const changes: { positive: string; negative?: string } = { positive: entry.positive ?? '' };
  if (entry.negative) changes.negative = entry.negative;
  applyWithUndo(changes, name);
}

/** Copy every setting of this history entry (model, size, steps, cfg, sampler, seed…) into the active step. */
export function reuseSettingsFrom(entry: HistoryEntry): void {
  const st = useStore.getState();
  const workflow: WorkflowState = entry.workflow
    ? { ...entry.workflow, inputImage: st.workflow.inputImage }
    : { ...st.workflow, seed: entry.seed, randomizeSeed: false, checkpoints: entry.model ? [{ id: uid(), name: entry.model, ratio: 0.5 }] : st.workflow.checkpoints };
  let layers: Layer[] = [];
  if (entry.layers?.length) layers = entry.layers.map((l) => ({ ...l, id: uid() }));
  else {
    if (entry.positive) layers.push({ id: uid(), on: true, kind: 'positive', tag: 'Recalled', text: entry.positive, weight: 1 });
    if (entry.negative) layers.push({ id: uid(), on: true, kind: 'negative', tag: 'Recalled', text: entry.negative, weight: 1 });
  }
  st.setWorkflow(workflow);
  if (layers.length) st.setPromptLayers(layers);
  useSteps.getState().updateStep(useSteps.getState().steps[0].id, { edited: true });
  st.setStatus('Reused the settings of that image', 'ok');
  notifications.show({ title: 'Settings reused', message: entry.model || 'Model, size, sampler and seed', color: 'teal', autoClose: 3000 });
}

/**
 * Make this image the input of a step (default: the next step after the active one, or the first
 * step after the Image step). Video / Workflow steps get it through the main app's upload path
 * (the start frame, the workflow's image input); Image / Upscale steps keep it as the step's input,
 * and the Image step also loads it as its img2img input image.
 */
export function sendToStep(image: { url: string; entry?: HistoryEntry }, stepId?: string): void {
  const steps = useSteps.getState();
  const target = stepId ?? nextStepId(steps.steps, steps.activeId) ?? steps.steps[1]?.id ?? null;
  if (!target) { notifications.show({ title: 'No next step', message: 'Add a step with + in the rail first.', color: 'yellow' }); return; }
  const step = steps.steps.find((s) => s.id === target);
  if (!step) return;
  const filename = image.entry?.filename ?? (image.url.split('/').pop()?.split('?')[0] || 'image.png');
  const src = { url: image.url, filename, kind: 'image' as const };
  steps.setStepInput(target, { url: image.url, name: filename });
  const go = () => { steps.setActive(target); useRoute.getState().go('step'); };
  if (step.kind === 'video') { void sendToVideo(src).then((ok) => { if (ok) go(); }); return; }
  if (step.kind === 'workflow') { void sendToWorkflow(src).then((ok) => { if (ok) go(); }); return; }
  if (step.kind === 'image') {
    void urlToImageState(image.url, filename).then((state) => {
      useStore.getState().setWorkflow({ inputImage: state });
      useStore.getState().setStatus(`Input image set — ${state.width}×${state.height}`, 'ok');
      go();
    }).catch((e) => notifications.show({ title: 'Could not load the image', message: e instanceof Error ? e.message : String(e), color: 'red' }));
    return;
  }
  go();
  notifications.show({ title: `Sent to step ${steps.steps.findIndex((s) => s.id === target) + 1}`, message: filename, color: 'teal', autoClose: 2500 });
}

/** Models screen → the active step: apply a CivitAI sample's generation data. */
export function applyGenerationData(meta: { prompt?: string; negativePrompt?: string; steps?: number; cfgScale?: number; sampler?: string; seed?: number; width?: number; height?: number; clipSkip?: number; [k: string]: unknown }, what: 'prompt' | 'settings'): void {
  if (what === 'prompt') {
    if (!meta.prompt?.trim()) { notifications.show({ title: 'No prompt', message: 'This sample carries no prompt.', color: 'yellow' }); return; }
    usePromptFrom({ positive: meta.prompt, negative: meta.negativePrompt ?? '' }, 'a CivitAI prompt');
    return;
  }
  const st = useStore.getState();
  const patch: Partial<WorkflowState> = {};
  if (typeof meta.steps === 'number' && meta.steps > 0) patch.steps = Math.round(meta.steps);
  if (typeof meta.cfgScale === 'number' && meta.cfgScale > 0) patch.cfg = meta.cfgScale;
  if (typeof meta.seed === 'number' && Number.isFinite(meta.seed)) { patch.seed = Math.max(0, Math.floor(meta.seed)); patch.randomizeSeed = false; }
  if (typeof meta.width === 'number' && typeof meta.height === 'number' && meta.width > 0 && meta.height > 0) { patch.width = Math.round(meta.width / 8) * 8; patch.height = Math.round(meta.height / 8) * 8; }
  if (typeof meta.clipSkip === 'number' && meta.clipSkip > 0) patch.clipSkip = -Math.round(meta.clipSkip);
  if (typeof meta.sampler === 'string' && meta.sampler.trim()) {
    const s = samplerOf(meta.sampler, st.server.samplers, st.server.schedulers);
    if (s.sampler) patch.sampler = s.sampler;
    if (s.scheduler) patch.scheduler = s.scheduler;
  }
  if (!Object.keys(patch).length) { notifications.show({ title: 'Nothing to apply', message: 'This sample carries no settings.', color: 'yellow' }); return; }
  st.setWorkflow(patch);
  useSteps.getState().updateStep(useSteps.getState().steps[0].id, { edited: true });
  notifications.show({ title: 'Settings applied', message: Object.keys(patch).filter((k) => k !== 'randomizeSeed').join(', '), color: 'teal', autoClose: 3000 });
}

/**
 * "DPM++ 2M Karras" (CivitAI's name) → ComfyUI's `dpmpp_2m` + `karras`, matched against what the
 * server lists. Exported for the test.
 */
export function samplerOf(name: string, samplers: readonly string[], schedulers: readonly string[]): { sampler?: string; scheduler?: string } {
  let n = name.toLowerCase().trim();
  let scheduler: string | undefined;
  for (const sch of ['karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform', 'beta', 'normal']) {
    const word = sch.replace('_', ' ');
    if (n.endsWith(` ${word}`) || n.endsWith(` ${sch}`)) { scheduler = schedulers.includes(sch) ? sch : undefined; n = n.replace(new RegExp(`\\s+(${word}|${sch})$`), ''); break; }
  }
  const key = n.replace(/\+\+/g, 'pp').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const sampler = samplers.find((s) => s === key) ?? samplers.find((s) => s.replace(/_/g, '') === key.replace(/_/g, '')) ?? samplers.find((s) => key.startsWith(s));
  return { sampler, scheduler };
}
