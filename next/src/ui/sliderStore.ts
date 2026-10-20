/**
 * The slider cog's own ranges (item 1): per slider key (its hint id, else its label), the min /
 * max / step the person set. Stored in this browser (`imagelab.next.sliders.v1`). The rules for
 * using them are `effectiveRange` in numberLogic.ts.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RangeOverride } from './numberLogic';

interface SliderRanges {
  ranges: Record<string, RangeOverride>;
  setRange: (key: string, o: RangeOverride) => void;
  resetRange: (key: string) => void;
}

export const useSliderRanges = create<SliderRanges>()(
  persist(
    (set) => ({
      ranges: {},
      setRange: (key, o) => set((s) => ({ ranges: { ...s.ranges, [key]: { ...s.ranges[key], ...o } } })),
      resetRange: (key) => set((s) => { const ranges = { ...s.ranges }; delete ranges[key]; return { ranges }; }),
    }),
    { name: 'imagelab.next.sliders.v1' },
  ),
);
