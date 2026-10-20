/**
 * Item 18: the ×N on the Generate button is one tap-to-cycle button. Each step has its own list of
 * values (default 1 / 2 / 3, edited in the step's Parameters tab); a tap moves to the next value
 * and wraps. Persisted per step id. The pure part (`nextInCycle`, `cleanCycle`) is tested in
 * tests/batchCycle.test.cjs.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_CYCLE: readonly number[] = Object.freeze([1, 2, 3]);
export const BATCH_MAX = 16;

/** Sorted, unique whole numbers in 1..BATCH_MAX; never empty (falls back to the default). */
export function cleanCycle(values: readonly number[]): number[] {
  const out = [...new Set(values.map((v) => Math.round(Number(v))).filter((v) => v >= 1 && v <= BATCH_MAX))].sort((a, b) => a - b);
  return out.length ? out : [...DEFAULT_CYCLE];
}

/** The value after `current` in the list, wrapping; a value not in the list goes to the next larger one (or the first). */
export function nextInCycle(list: readonly number[], current: number): number {
  const l = cleanCycle(list);
  const at = l.indexOf(current);
  if (at >= 0) return l[(at + 1) % l.length];
  return l.find((v) => v > current) ?? l[0];
}

interface BatchCycleState {
  lists: Record<string, number[]>;
  setList: (stepId: string, values: readonly number[]) => void;
}

export const useBatchCycle = create<BatchCycleState>()(
  persist(
    (set) => ({
      lists: {},
      setList: (stepId, values) => set((s) => ({ lists: { ...s.lists, [stepId]: cleanCycle(values) } })),
    }),
    { name: 'imagelab.next.batchCycle.v1' },
  ),
);

/** A step's cycle list (the default when it has none). Stable reference for the selector. */
export const useCycleOf = (stepId: string): readonly number[] => useBatchCycle((s) => s.lists[stepId] ?? DEFAULT_CYCLE);
