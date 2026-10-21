/**
 * Which step made each result (key → step id), for the history panel's This step / All scope.
 * `useCreditOutputs` (`~/app/outputs`, mounted once in App) tags every result that appears while
 * the app runs, with its session owner; results already there at load stay untagged (see `inStep`).
 * Persisted, capped.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryScope } from './historyLogic';

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
        if (!pairs.length) return s;
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
