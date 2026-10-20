/**
 * Which step made each result (key → step id), for the history panel's This step / All scope.
 * `useCreditNewResults` (mounted once in App) tags every result that appears while the app runs
 * with `creditStep`; results already there at load stay untagged (see `inStep`). Persisted, capped.
 */
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
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
        const id = creditStep(source, activeId, steps);
        if (id) pairs.push([r.key, id]);
      }
    }
    if (pairs.length) useResultSteps.getState().tag(pairs);
  }, [images, videos, runs]);
}
