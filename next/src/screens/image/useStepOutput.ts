/** A step's newest output (url + name), for the next step's chained input and the rail badge. */
import { useStore } from '@/lib/store';
import { viewUrl } from '@/lib/comfyHost';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useSteps, prevStepId, type Step } from '~/app/stepsStore';

export function useStepOutput(step: Step | null): { url: string; name: string } | null {
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

/** The output of the step before this one (what "Use previous step's output" chains to). */
export function usePrevStepOutput(step: Step): { url: string; name: string } | null {
  const steps = useSteps((s) => s.steps);
  const prevId = prevStepId(steps, step.id);
  const prev = steps.find((s) => s.id === prevId) ?? null;
  return useStepOutput(prev);
}
