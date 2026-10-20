/**
 * "Use same models as step 1" (fix list item 40), the memory: per step, whether it follows step 1
 * (the DEFAULT: yes, every model kind) and which single entries the user un-linked to set them
 * here. Keyed by step id; an entry by `linkKey(kind, entryId)`. Persisted in this browser.
 * The diff itself is `followLogic.ts`; the live sync of a Workflow step is `workflow/followWorkflow.ts`.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSteps } from '~/app/stepsStore';

export interface StepFollow {
  /** True = this step picks its own models (follow switched off). */
  off?: boolean;
  /** linkKeys of the entries set here while the rest follows. */
  unlinked?: string[];
}

interface FollowState {
  byStep: Record<string, StepFollow>;
  setFollow: (stepId: string, on: boolean) => void;
  unlink: (stepId: string, key: string) => void;
  relink: (stepId: string, key: string) => void;
}

const NONE: StepFollow = Object.freeze({}) as StepFollow;

export const useFollowStore = create<FollowState>()(
  persist(
    (set) => ({
      byStep: {},
      // Switching the link back on re-links every model (a clean "same as step 1").
      setFollow: (stepId, on) => set((s) => ({ byStep: { ...s.byStep, [stepId]: on ? {} : { ...s.byStep[stepId], off: true } } })),
      unlink: (stepId, key) => set((s) => {
        const cur = s.byStep[stepId] ?? NONE;
        if (cur.unlinked?.includes(key)) return s;
        return { byStep: { ...s.byStep, [stepId]: { ...cur, unlinked: [...(cur.unlinked ?? []), key] } } };
      }),
      relink: (stepId, key) => set((s) => {
        const cur = s.byStep[stepId] ?? NONE;
        if (!cur.unlinked?.includes(key)) return s;
        return { byStep: { ...s.byStep, [stepId]: { ...cur, unlinked: cur.unlinked.filter((k) => k !== key) } } };
      }),
    }),
    { name: 'imagelab.next.follow.v1' },
  ),
);

/** A step's follow state (a stable empty object when it never changed: following, nothing un-linked). */
export const useStepFollow = (stepId: string | null | undefined): StepFollow => useFollowStore((s) => (stepId ? s.byStep[stepId] ?? NONE : NONE));

export const stepFollowNow = (stepId: string): StepFollow => useFollowStore.getState().byStep[stepId] ?? NONE;

// A removed step forgets its links.
useSteps.subscribe((s) => {
  const ids = new Set(s.steps.map((x) => x.id));
  const { byStep } = useFollowStore.getState();
  const gone = Object.keys(byStep).filter((id) => !ids.has(id));
  if (!gone.length) return;
  const next = { ...byStep };
  for (const id of gone) delete next[id];
  useFollowStore.setState({ byStep: next });
});
