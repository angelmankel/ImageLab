/**
 * Item 18 + fix list 2 #25: the ×N on the Generate button is one tap-to-cycle button. ONE list for
 * the whole app (default 1 / 2 / 3), edited in Settings → Generate; a tap moves to the next value
 * and wraps. The pure part (`nextInCycle`, `cleanCycle`, `migrateCycle`) is tested in
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

/** v1 kept a list per step id; v2 keeps one. The first stored list that differs from the default wins. */
export function migrateCycle(persisted: unknown): number[] {
  const p = (persisted ?? {}) as { list?: unknown; lists?: Record<string, unknown> };
  if (Array.isArray(p.list)) return cleanCycle(p.list as number[]);
  const lists = Object.values(p.lists ?? {}).filter(Array.isArray).map((l) => cleanCycle(l as number[]));
  return lists.find((l) => l.join() !== DEFAULT_CYCLE.join()) ?? [...DEFAULT_CYCLE];
}

interface BatchCycleState {
  list: number[];
  setList: (values: readonly number[]) => void;
}

export const useBatchCycle = create<BatchCycleState>()(
  persist(
    (set) => ({
      list: [...DEFAULT_CYCLE],
      setList: (values) => set({ list: cleanCycle(values) }),
    }),
    {
      name: 'imagelab.next.batchCycle.v1',
      version: 2,
      partialize: (s) => ({ list: s.list }),
      migrate: (persisted) => ({ list: migrateCycle(persisted) }) as unknown as BatchCycleState,
    },
  ),
);

/** The app's ×N cycle list. */
export const useCycleList = (): readonly number[] => useBatchCycle((s) => s.list);
