/**
 * Which step made each result (key → step id), for the history panel's This step / All scope.
 * `useCreditNewResults` (mounted once in App) tags every result that appears while the app runs
 * with `creditStep`; results already there at load stay untagged (see `inStep`). Persisted, capped.
 */
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useStore } from '@/lib/store';
import { useSteps } from '~/app/stepsStore';
import { creditStep, type HistoryScope, type ResultSource } from './historyLogic';

const MAX_TAGS = 3000;

interface ResultStepsState {
  tags: Record<string, string>;
  /** The history panel's scope; This step by default (Donny, 10-20). */
  scope: HistoryScope;
  tag: (pairs: Array<[string, string]>) => void;
  setScope: (scope: HistoryScope) => void;
}

export const useResultSteps = create<ResultStepsState>()(
  persist(
    (set) => ({
      tags: {},
      scope: 'step',
      tag: (pairs) => set((s) => {
        const tags = { ...s.tags };
        for (const [k, id] of pairs) tags[k] = id;
        const keys = Object.keys(tags);
        if (keys.length > MAX_TAGS) for (const k of keys.slice(0, keys.length - MAX_TAGS)) delete tags[k];
        return { tags };
      }),
      setScope: (scope) => set({ scope }),
    }),
    { name: 'imagelab.next.resultSteps.v1' },
  ),
);

/**
 * Which step was open when each image job was queued (job id = ComfyUI prompt id = the result's
 * `promptId`). A picture that lands after a session / step switch still goes to the step that
 * asked for it, not to whatever is open when it arrives (fix list 36: sessions run side by side).
 */
const queuedFrom = new Map<string, string>();
let knownJobs = new Set<string>();
useStore.subscribe((st, prev) => {
  if (st.jobs === prev.jobs) return;
  const ids = new Set(st.jobs.map((j) => j.id));
  const { steps, activeId } = useSteps.getState();
  for (const id of ids) {
    if (knownJobs.has(id)) continue;
    const step = creditStep('image', activeId, steps);
    if (step) queuedFrom.set(id, step);
  }
  knownJobs = ids;
  if (queuedFrom.size > 500) for (const k of [...queuedFrom.keys()].slice(0, queuedFrom.size - 500)) queuedFrom.delete(k);
});

export function useCreditNewResults(): void {
  const images = useImageResults();
  const videos = useVideoResults();
  const runs = useWorkflowResults();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const lists: Array<[ResultSource, ReadonlyArray<{ key: string }>]> = [['image', images], ['video', videos], ['workflow', runs]];
    // The first pass only learns what is already there: old results are not credited to whatever step is open now.
    if (!seen.current) { seen.current = new Set(lists.flatMap(([, l]) => l.map((r) => r.key))); return; }
    const { steps, activeId } = useSteps.getState();
    const tagged = useResultSteps.getState().tags;
    const pairs: Array<[string, string]> = [];
    for (const [source, list] of lists) {
      for (const r of list) {
        if (seen.current.has(r.key)) continue;
        seen.current.add(r.key);
        if (tagged[r.key]) continue;
        const promptId = (r as { entry?: { promptId?: string } }).entry?.promptId;
        const asked = promptId ? queuedFrom.get(promptId) : undefined;
        const id = asked ?? creditStep(source, activeId, steps);
        if (id) pairs.push([r.key, id]);
      }
    }
    if (pairs.length) useResultSteps.getState().tag(pairs);
  }, [images, videos, runs]);
}
