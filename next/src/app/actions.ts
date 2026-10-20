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
import { urlToImageState } from '@/features/inputImage/imageOps';
import { useRoute } from './routeStore';
import { nextStepId, useSteps, STEP_LABEL } from './stepsStore';
import { addStepWithPicker } from './stepKindPicker';
import { useStage } from '~/screens/image/stageStore';
import { setStartFrameFrom } from '~/screens/image/video/videoChain';

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
 * Recall EVERYTHING from a history entry (Donny, 10-20): the full saved workflow (models, size,
 * sampler, seed, Loopback, the input image it was made from) and its prompt layers — the old
 * app's toolbar Recall, through the store's own `recallSelected`.
 */
export function recallFrom(entry: HistoryEntry): void {
  const st = useStore.getState();
  st.selectHistoryEntry(entry);
  st.recallSelected();
  useSteps.getState().updateStep(useSteps.getState().steps[0].id, { edited: true });
  notifications.show({ title: 'Recalled', message: `Everything from that image is back in the step${entry.model ? ` · ${entry.model}` : ''}`, color: 'teal', autoClose: 3000 });
}

/**
 * Make this image the input of a step (default: the next step after the active one, or the first
 * step after the Image step). Fix list 31, fast: the step gets the picture as its input and opens
 * AT ONCE; nothing is downloaded or uploaded here. A Workflow / Refine / Upscale / Remove BG step
 * resolves its input when it runs, and a picture already on that server is used in place
 * (`serverRef`), never fetched and sent back. Only a Video step (its start frame lives in its own
 * store) and the Image step (img2img holds the picture itself) load it, in the background.
 */
export function sendToStep(image: { url: string; entry?: HistoryEntry }, stepId?: string): void {
  const steps = useSteps.getState();
  const target = stepId ?? nextStepId(steps.steps, steps.activeId) ?? steps.steps[1]?.id ?? null;
  if (!target) { notifications.show({ title: 'No next step', message: 'Add a step with + in the rail first.', color: 'yellow', autoClose: 3000 }); return; }
  const step = steps.steps.find((s) => s.id === target);
  if (!step) return;
  const filename = image.entry?.filename ?? nameOf(image.url);
  steps.setStepInput(target, { url: image.url, name: filename });
  // The stage shows what was sent (the Library does not select; the action does).
  if (image.entry) { useStore.getState().selectHistoryEntry(image.entry); useStage.getState().showRun(null); } else useStage.getState().showRun(image.url);
  steps.setActive(target);
  useRoute.getState().go('step');
  const n = steps.steps.findIndex((s) => s.id === target) + 1;
  if (step.kind === 'video') void setStartFrameFrom(image.url, filename);
  if (step.kind === 'image') {
    void urlToImageState(image.url, filename).then((state) => {
      useStore.getState().setWorkflow({ inputImage: state });
    }).catch((e) => notifications.show({ title: 'Could not load the image', message: e instanceof Error ? e.message : String(e), color: 'red', autoClose: 3000 }));
  }
  notifications.show({ title: `Sent to step ${n}`, message: filename, color: 'teal', autoClose: 2000 });
}

/** "…/view?filename=x.png&…" or ".../x.png" → "x.png". */
function nameOf(url: string): string {
  try { const u = new URL(url, location.href); return u.searchParams.get('filename') || u.pathname.split('/').pop() || 'image.png'; } catch { return 'image.png'; }
}

/**
 * The canvas toolbar's → (fix list 31): send to the step after the open one; when there is none,
 * the step-kind picker opens at `anchor` and the picked step is added after the open one with this
 * picture as its input.
 */
export function sendToNextStep(image: { url: string; entry?: HistoryEntry }, anchor: Element | { x: number; y: number }): void {
  const steps = useSteps.getState();
  const next = nextStepId(steps.steps, steps.activeId);
  if (next) { sendToStep(image, next); return; }
  const name = image.entry?.filename ?? nameOf(image.url);
  addStepWithPicker(anchor, { after: steps.activeId, input: { url: image.url, name } }, (_id, kind) => {
    notifications.show({ title: `New ${STEP_LABEL[kind]} step`, message: `${name} is its input`, color: 'teal', autoClose: 2000 });
  });
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
  n = n.replace(/\s+a$/, ' ancestral');
  const key = n.replace(/\+\+/g, 'pp').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const sampler = samplers.find((s) => s === key) ?? samplers.find((s) => s.replace(/_/g, '') === key.replace(/_/g, '')) ?? samplers.find((s) => key.startsWith(s));
  return { sampler, scheduler };
}
