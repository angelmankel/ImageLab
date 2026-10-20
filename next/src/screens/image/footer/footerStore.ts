/** Which optional parts the footer shows (fix list 19: "each part switched on / off"). Remembered in this browser. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FooterPart = 'hints' | 'job' | 'downloads';

export const FOOTER_PARTS: ReadonlyArray<{ id: FooterPart; label: string }> = [
  { id: 'hints', label: 'Hints switch' },
  { id: 'job', label: 'Job progress' },
  { id: 'downloads', label: 'Model downloads' },
];

interface FooterState {
  shown: Record<FooterPart, boolean>;
  toggle: (id: FooterPart) => void;
}

export const useFooter = create<FooterState>()(
  persist(
    (set) => ({
      shown: { hints: true, job: true, downloads: true },
      toggle: (id) => set((s) => ({ shown: { ...s.shown, [id]: !s.shown[id] } })),
    }),
    { name: 'imagelab.next.footer.v1', merge: (p, c) => ({ ...c, shown: { ...c.shown, ...((p as Partial<FooterState>)?.shown ?? {}) } }) },
  ),
);
