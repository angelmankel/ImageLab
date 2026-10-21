/**
 * Follow one run on a run store (`@/lib/comfyRunner`: the workflow or the video runner) for a
 * step: every result that lands while it runs is credited to THAT step (the result → step tags,
 * `resultSteps.ts`), whichever step is open — so "Generate all" files each picture under the step
 * that made it, and the next step chains to it. Resolves when the run ends: null, or its error.
 *
 * Call it right BEFORE starting the run. The store's listener fires synchronously on each change,
 * so the tag is there before `useCreditNewResults` (an effect) would credit the open step.
 */
import type { RunStore } from '@/lib/comfyRunner';
import { noteRunStart } from '~/app/stepFingerprint';
import { useResultSteps } from '../resultSteps';
import { ownerOfStep, recordJob } from '~/app/outputs';

/** Longest a step may take before Generate all gives up waiting on it. */
const MAX_MS = 60 * 60_000;

export interface TrackedRun {
  done: Promise<string | null>;
  /** End the wait now with this error (the run never started). */
  cancel: (err?: string) => void;
  /** The run went busy at least once. */
  started: () => boolean;
}

export function trackRun(store: RunStore, stepId: string): TrackedRun {
  noteRunStart(store, stepId);
  const known = new Set(store.getState().results.map((r) => r.url));
  // Its jobs belong to the step's session (fix list 2, item 15: preview + results go there only).
  const owner = ownerOfStep(stepId);
  const knownJobs = new Set(store.getState().jobs.map((j) => j.promptId));
  let started = store.getState().busy;
  let unsub: () => void = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finish: (err: string | null) => void = () => {};
  const done = new Promise<string | null>((resolve) => {
    finish = (err) => { unsub(); clearTimeout(timer); resolve(err); };
    unsub = store.subscribe((s) => {
      const fresh = s.results.filter((r) => !known.has(r.url));
      if (fresh.length) {
        for (const r of fresh) known.add(r.url);
        useResultSteps.getState().tag(fresh.map((r) => [r.url, stepId] as [string, string]));
      }
      if (owner) for (const j of s.jobs) if (!knownJobs.has(j.promptId)) { knownJobs.add(j.promptId); recordJob(j.promptId, owner); }
      if (s.busy) started = true;
      else if (started) finish(s.error);
    });
    timer = setTimeout(() => finish('Timed out waiting for the run'), MAX_MS);
  });
  return { done, cancel: (err = 'Stopped') => finish(err), started: () => started };
}
