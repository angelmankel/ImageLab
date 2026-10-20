/**
 * The step-input rule (`stepInputLogic.ts`) wired to the stores: every result (image history +
 * video / workflow runs) with the result → step tags from `resultSteps.ts`. Hooks for the tabs and
 * the rail, `…Now` twins for the run paths (read at Generate time, so the latest picture is the
 * one used). `useStepOutput` / `stepOutputNow` = a step's newest own output (the rail badge);
 * `usePrevStepOutput` = what a step would chain to; `useStepInput` / `stepInputNow` = the full
 * resolution (Off · Auto · Pick, waiting, a lost pick).
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { viewUrl } from '@/lib/comfyHost';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { toResultItem, useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useSteps, type Step } from '~/app/stepsStore';
import { useResultSteps } from './resultSteps';
import { chainCandidate, mergeResults, newestResultOf, resolveStepInput, resultsOfStep, type StepInputResolution, type StepResult } from './stepInputLogic';

export interface StepOutput { url: string; name: string }

/** Every result as the resolver wants it, newest first (memoised on the three source lists). */
export function useAllResults(): StepResult[] {
  const images = useImageResults();
  const videos = useVideoResults();
  const runs = useWorkflowResults();
  return useMemo(() => mergeResults(images, videos, runs), [images, videos, runs]);
}

/** `useAllResults` outside React. */
export function allResultsNow(): StepResult[] {
  const st = useStore.getState();
  const images = st.history.flatMap((e) => {
    const host = st.servers.find((sv) => sv.id === e.serverId)?.host;
    return host ? [{ key: e.id, url: viewUrl(e, host), kind: 'image' as const, filename: e.filename, createdAt: e.createdAt }] : [];
  });
  const videos = useVideoRun.getState().results.map(toResultItem);
  const runs = useWorkflowRun.getState().results.map(toResultItem);
  return mergeResults(images, videos, runs);
}

/** A step's newest own output (url + name): the rail badge, the Video step's "has the previous step made anything" check. */
export function useStepOutput(step: Step | null): StepOutput | null {
  const steps = useSteps((s) => s.steps);
  const tags = useResultSteps((s) => s.tags);
  const results = useAllResults();
  return useMemo(() => newestResultOf(step, steps, tags, results), [step, steps, tags, results]);
}

/** `useStepOutput` outside React, read at call time. */
export function stepOutputNow(step: Step | null): StepOutput | null {
  return newestResultOf(step, useSteps.getState().steps, useResultSteps.getState().tags, allResultsNow());
}

/** The results a step made, newest first (the Pick strip shows the previous step's). */
export function useStepResults(step: Step | null): StepResult[] {
  const steps = useSteps((s) => s.steps);
  const tags = useResultSteps((s) => s.tags);
  const results = useAllResults();
  return useMemo(() => (step ? resultsOfStep(step, steps, tags, results) : []), [step, steps, tags, results]);
}

/** What `step` chains to (its pick while it exists, else the previous step's newest result), whatever mode is on. */
export function usePrevStepOutput(step: Step): StepOutput | null {
  const steps = useSteps((s) => s.steps);
  const tags = useResultSteps((s) => s.tags);
  const results = useAllResults();
  return useMemo(() => chainCandidate(step, steps, tags, results).src, [step, steps, tags, results]);
}

/** The step's input, fully resolved (Off · Auto · Pick). */
export function useStepInput(step: Step): StepInputResolution {
  const steps = useSteps((s) => s.steps);
  const tags = useResultSteps((s) => s.tags);
  const results = useAllResults();
  return useMemo(() => resolveStepInput(step, steps, tags, results), [step, steps, tags, results]);
}

/** `useStepInput` outside React: the step as it is NOW in the store (the Input tab may have changed it since a handler was made). */
export function stepInputNow(stepId: string): StepInputResolution | null {
  const steps = useSteps.getState().steps;
  const step = steps.find((s) => s.id === stepId);
  if (!step) return null;
  return resolveStepInput(step, steps, useResultSteps.getState().tags, allResultsNow());
}
