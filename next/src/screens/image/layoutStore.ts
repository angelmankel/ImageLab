/**
 * The desktop step screen's layout (rules 3 and 8): the two side panels' widths and open state,
 * and which tab of the step panel is showing. Persisted.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { T } from '~/theme/tokens';

export type StepTab = 'prompt' | 'model' | 'settings' | 'input';

interface LayoutState {
  stepW: number;
  histW: number;
  stepOpen: boolean;
  histOpen: boolean;
  tab: StepTab;
  setStepW: (w: number) => void;
  setHistW: (w: number) => void;
  toggleStep: () => void;
  toggleHist: () => void;
  setTab: (t: StepTab) => void;
}

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      stepW: T.size.stepPanel,
      histW: T.size.historyPanel,
      stepOpen: true,
      histOpen: true,
      tab: 'prompt',
      setStepW: (stepW) => set({ stepW }),
      setHistW: (histW) => set({ histW }),
      toggleStep: () => set((s) => ({ stepOpen: !s.stepOpen })),
      toggleHist: () => set((s) => ({ histOpen: !s.histOpen })),
      setTab: (tab) => set({ tab }),
    }),
    { name: 'imagelab.next.layout.v1' },
  ),
);
