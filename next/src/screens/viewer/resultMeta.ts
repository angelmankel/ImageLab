/**
 * Item 30, "capture what is missing": the step chain behind each result. A history entry keeps
 * the prompt and the workflow snapshot, but not which step of which chain made it. When a new
 * result is credited to a step (`useResultSteps` in screens/image/resultSteps), this snapshots the
 * chain at that moment — every step's kind and name, which one made it, the session name — keyed
 * by the result key (history id or run url). Persisted, capped; the viewer's "Made by" reads it.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSteps, STEP_LABEL, type StepKind } from '~/app/stepsStore';
import { useResultSteps } from '~/screens/image/resultSteps';

export interface ChainSnap {
  /** Every step at the time: kind + name. */
  steps: Array<{ id: string; kind: StepKind; name: string }>;
  /** Index of the step that made the result. */
  made: number;
  session: string;
  at: number;
}

const MAX = 2000;

interface ResultMetaState {
  chains: Record<string, ChainSnap>;
  record: (pairs: Array<[string, string]>) => void;
}

export const useResultMeta = create<ResultMetaState>()(
  persist(
    (set) => ({
      chains: {},
      record: (pairs) => set((s) => {
        const { steps, sessionName } = useSteps.getState();
        const snapSteps = steps.map((x) => ({ id: x.id, kind: x.kind, name: x.name || STEP_LABEL[x.kind] }));
        const chains = { ...s.chains };
        let added = false;
        for (const [key, stepId] of pairs) {
          if (chains[key]) continue;
          const made = snapSteps.findIndex((x) => x.id === stepId);
          if (made < 0) continue;
          chains[key] = { steps: snapSteps, made, session: sessionName, at: Date.now() };
          added = true;
        }
        if (!added) return s;
        const keys = Object.keys(chains);
        if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete chains[k];
        return { chains };
      }),
    }),
    { name: 'imagelab.next.resultMeta.v1' },
  ),
);

// Snapshot on every new credit (module level: on as soon as the viewer module loads with the stage).
let prevTags = useResultSteps.getState().tags;
useResultSteps.subscribe((s) => {
  if (s.tags === prevTags) return;
  const old = prevTags;
  prevTags = s.tags;
  const pairs: Array<[string, string]> = [];
  for (const [k, id] of Object.entries(s.tags)) if (old[k] !== id) pairs.push([k, id]);
  if (pairs.length) useResultMeta.getState().record(pairs);
});
