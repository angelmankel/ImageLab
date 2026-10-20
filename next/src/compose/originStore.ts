/**
 * Where each input slot's picture came from (fix list 41: "clear source label"). Keyed by slot
 * ("image:1", "step:<id>", "wf:<step>:<param>", "video:start"…) with a fingerprint of the value,
 * so the badge only shows while the slot still holds that picture. Tiny; persisted.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { valueRef, type Origin } from './inputLogic';

interface OriginState {
  bySlot: Record<string, { origin: Origin; ref: string }>;
  remember: (slot: string, origin: Origin, value: string) => void;
}

export const useOrigins = create<OriginState>()(
  persist(
    (set) => ({
      bySlot: {},
      remember: (slot, origin, value) => set((s) => ({ bySlot: { ...s.bySlot, [slot]: { origin, ref: valueRef(value) } } })),
    }),
    { name: 'imagelab.next.inputOrigins.v1' },
  ),
);

/** The slot's origin while it still holds `value`. */
export function useOrigin(slot: string | undefined, value: string | null | undefined): Origin | null {
  return useOrigins((s) => {
    if (!slot || !value) return null;
    const o = s.bySlot[slot];
    return o && o.ref === valueRef(value) ? o.origin : null;
  });
}

export const rememberOrigin = (slot: string, origin: Origin, value: string): void => useOrigins.getState().remember(slot, origin, value);
