/**
 * The Workflow step's own small memory (rule 3's Generate | dice): which seed widgets are KEPT as
 * set between runs, per workflow path. Everything else a step remembers (values, pins, keywords,
 * prompt, prompt target) is the main app's studio store (`@/features/studio/studioStore`), persisted
 * there under `imagelab.studio.v1`. Default: every seed re-rolls on each run, as the classic app does.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const NO_IDS: string[] = [];

interface WorkflowStepState {
  /** workflow path → seed widget ids kept as set (not re-rolled by Generate; the dice always rolls). */
  kept: Record<string, string[]>;
  toggleKept: (path: string, id: string) => void;
}

export const useWorkflowStepStore = create<WorkflowStepState>()(
  persist(
    (set) => ({
      kept: {},
      toggleKept: (path, id) => set((s) => {
        const cur = s.kept[path] ?? [];
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
        return { kept: { ...s.kept, [path]: next } };
      }),
    }),
    { name: 'imagelab.next.workflowStep.v1' },
  ),
);

/** The kept seed ids of a workflow (a stable empty list when none). */
export const useKeptSeeds = (path: string | null): string[] => useWorkflowStepStore((s) => (path ? s.kept[path] ?? NO_IDS : NO_IDS));

/** Outside React (the run). */
export const keptSeedsNow = (path: string | null): string[] => (path ? useWorkflowStepStore.getState().kept[path] ?? NO_IDS : NO_IDS);
