/**
 * A step's newest output (url + name), for the next step's chained input and the rail badge.
 * Per kind: image = the main store's newest history entry; video = the video run store's latest
 * clip; workflow = the workflow run store's latest result; upscale = its explicit input for now.
 * `stepOutputNow` is the same rule outside React (the Video step's chain runner reads it at
 * Generate time, so the latest picture is always the one used).
 */
import { useStore } from '@/lib/store';
import { viewUrl } from '@/lib/comfyHost';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useSteps, prevStepId, type Step } from '~/app/stepsStore';

export interface StepOutput { url: string; name: string }

export function useStepOutput(step: Step | null): StepOutput | null {
  const entry = useStore((s) => s.history[0] ?? null);
  const host = useStore((s) => (entry ? s.servers.find((sv) => sv.id === entry.serverId)?.host : undefined));
  const video = useVideoRun((s) => s.latest);
  const run = useWorkflowRun((s) => s.latest);
  if (!step) return null;
  if (step.kind === 'image') return entry && host ? { url: viewUrl(entry, host), name: entry.filename } : null;
  if (step.kind === 'video') return video ? { url: video.url, name: video.filename } : null;
  if (step.kind === 'workflow') return run ? { url: run.url, name: run.filename } : null;
  return step.input ?? null;
}

/** `useStepOutput` outside React, read at call time. */
export function stepOutputNow(step: Step | null): StepOutput | null {
  if (!step) return null;
  if (step.kind === 'image') {
    const st = useStore.getState();
    const entry = st.history[0];
    const host = entry ? st.servers.find((sv) => sv.id === entry.serverId)?.host : undefined;
    return entry && host ? { url: viewUrl(entry, host), name: entry.filename } : null;
  }
  if (step.kind === 'video') { const v = useVideoRun.getState().latest; return v ? { url: v.url, name: v.filename } : null; }
  if (step.kind === 'workflow') { const r = useWorkflowRun.getState().latest; return r ? { url: r.url, name: r.filename } : null; }
  return step.input ?? null;
}

/** The output of the step before this one (what "Use previous step's output" chains to). */
export function usePrevStepOutput(step: Step): StepOutput | null {
  const steps = useSteps((s) => s.steps);
  const prevId = prevStepId(steps, step.id);
  const prev = steps.find((s) => s.id === prevId) ?? null;
  return useStepOutput(prev);
}
