/**
 * The phone shell's own state (rule 11): which page of the step shows (Create / Output), the
 * Generate button's seed mode (bolt = seed as set, dice = random; a hold switches it, kept across
 * reloads), and the More sheet. `queueAsk` bumps when the Generate badge is tapped so the Output
 * page scrolls its Queue card into view.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SeedMode } from './phoneLogic';

export type PhonePage = 'create' | 'output';

interface PhoneState {
  page: PhonePage;
  seedMode: SeedMode;
  moreOpen: boolean;
  queueAsk: number;
  setPage: (p: PhonePage) => void;
  setSeedMode: (m: SeedMode) => void;
  setMoreOpen: (o: boolean) => void;
  showQueue: () => void;
}

export const usePhone = create<PhoneState>()(
  persist(
    (set) => ({
      page: 'create',
      seedMode: 'set',
      moreOpen: false,
      queueAsk: 0,
      setPage: (page) => set({ page }),
      setSeedMode: (seedMode) => set({ seedMode }),
      setMoreOpen: (moreOpen) => set({ moreOpen }),
      showQueue: () => set((s) => ({ page: 'output', queueAsk: s.queueAsk + 1 })),
    }),
    { name: 'imagelab.next.phone.v1', partialize: (s) => ({ page: s.page, seedMode: s.seedMode }) },
  ),
);
