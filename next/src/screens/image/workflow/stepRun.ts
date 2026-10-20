/**
 * Generate for a Workflow step (rule 2 + 3 + 15): queue the step's saved ComfyUI workflow with
 * its widget values, on the shared workflow run store (`@/features/studio/studioRun`'s
 * `useWorkflowRun`, so the queue pill, Stop and the stage see it as before).
 *
 * On top of the classic `startWorkflowRun`: the previous step's picture is chained into the
 * workflow's first LoadImage (fetched through the browser, uploaded to the step's host, the
 * widget set to the name the server gave back — what `features/workspace/sendTo.tsx` does for its
 * "Workflow" target; a video output sends its last frame), and only the seeds NOT kept are
 * re-rolled on Generate while the dice re-rolls every one.
 */
import { notifications } from '@mantine/notifications';
import { loadImageRef, uploadImage } from '@/lib/comfy';
import { viewUrl } from '@/lib/comfyHost';
import { useStore } from '@/lib/store';
import type { RunSource } from '@/lib/comfyRunner';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { buildApiGraph, randomSeed } from '@/features/studio/params';
import { useStudio } from '@/features/studio/studioStore';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { objectInfoNow } from '@/features/studio/useStudioRun';
import { useVideoRun } from '@/features/video/videoRun';
import { lastFrame } from '@/features/workspace/sendTo';
import { useSteps, prevStepId, type Step } from '~/app/stepsStore';
import { ensureStepWorkflowOpen } from '~/screens/comfy';
import { keptSeedsNow } from './workflowStepStore';
import { isImageParam, resolveChainInput, seedIdsToReroll, uploadName, type ChainSource } from './workflowStepLogic';

const VIDEO = /\.(mp4|webm|mov|mkv)(\?|$)/i;

/** `${host}|${url}` → the LoadImage ref it was uploaded as, so one picture is sent once per host. */
const uploaded = new Map<string, string>();

export const rememberUpload = (host: string, url: string, ref: string): void => { uploaded.set(`${host}|${url}`, ref); };

/** Fetch a picture (or a video's last frame) through the browser and upload it to `host`; cached per url. */
export async function uploadSource(host: string, src: ChainSource): Promise<string> {
  const key = `${host}|${src.url}`;
  const known = uploaded.get(key);
  if (known) return known;
  let blob: Blob;
  let name = src.name || 'image.png';
  if (VIDEO.test(src.url) || VIDEO.test(name)) {
    blob = await lastFrame(src.url);
    name = name.replace(/\.[^.]+$/, '') + '.png';
  } else {
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`Could not fetch the picture (HTTP ${res.status})`);
    blob = await res.blob();
  }
  const up = await uploadImage(host, blob, uploadName(name, Date.now()));
  const ref = loadImageRef(up);
  uploaded.set(key, ref);
  return ref;
}

/**
 * The newest output of the step before `stepId`, outside React (the hook version is
 * `~/screens/image/useStepOutput.ts`'s `usePrevStepOutput`; the rules are the same).
 */
export function prevStepOutputNow(stepId: string): ChainSource | null {
  const steps = useSteps.getState().steps;
  const prevId = prevStepId(steps, stepId);
  const prev = steps.find((s) => s.id === prevId);
  if (!prev) return null;
  if (prev.kind === 'image') {
    const st = useStore.getState();
    const entry = st.history[0];
    const host = entry ? st.servers.find((sv) => sv.id === entry.serverId)?.host : undefined;
    return entry && host ? { url: viewUrl(entry, host), name: entry.filename } : null;
  }
  if (prev.kind === 'video') { const v = useVideoRun.getState().latest; return v ? { url: v.url, name: v.filename } : null; }
  if (prev.kind === 'workflow') { const r = useWorkflowRun.getState().latest; return r ? { url: r.url, name: r.filename } : null; }
  return prev.input ?? null;
}

/** The step's run source: chained picture in, seeds rolled, the graph built from the studio store. */
export function workflowStepSource(step: Step, host: string, info: ObjectInfo | null, newSeed: boolean): RunSource {
  return {
    build: async () => {
      const st = useStudio.getState();
      const catalogue = info ?? objectInfoNow(host);
      if (!catalogue) return { error: 'The server has not sent its node list yet' };
      if (!st.workflow || !st.path) return { error: 'No workflow open' };
      // The step as it is now (the Input tab may have changed it since the handler was made).
      const live = useSteps.getState().steps.find((s) => s.id === step.id) ?? step;
      const image = st.params.find(isImageParam);
      const chain = resolveChainInput(live, prevStepOutputNow(step.id), !!image);
      if (chain.kind === 'waiting') return { error: 'The previous step has no output yet — generate it first, or pick a picture in Input' };
      if (chain.kind === 'chained' || chain.kind === 'explicit') {
        try {
          const ref = await uploadSource(host, chain.src);
          if (st.currentValues()[image!.id] !== ref) st.setValue(image!.id, ref);
        } catch (err) {
          return { error: `Could not send the picture to the workflow: ${err instanceof Error ? err.message : String(err)}` };
        }
      }
      for (const id of seedIdsToReroll(st.params, keptSeedsNow(st.path), newSeed)) st.setValue(id, randomSeed());
      return buildApiGraph(st.workflow, catalogue, useStudio.getState().currentValues());
    },
  };
}

/**
 * Queue the step's workflow on `host`. `newSeed` = the dice (every seed re-rolled); else Generate
 * (kept seeds stay). Opens the step's workflow in the studio store first when it is not the open one.
 */
export async function startWorkflowStepRun(step: Step, host: string, info: ObjectInfo | null, newSeed = false): Promise<void> {
  try { await ensureStepWorkflowOpen(step.id); } catch (err) {
    notifications.show({ color: 'red', title: 'Could not open the workflow', message: err instanceof Error ? err.message : String(err) });
    return;
  }
  const run = useWorkflowRun.getState();
  run.setHost(host);
  await run.run(workflowStepSource(step, host, info, newSeed));
  const err = useWorkflowRun.getState().error;
  if (err) notifications.show({ color: 'red', title: 'Could not generate', message: err, autoClose: 8000 });
}
