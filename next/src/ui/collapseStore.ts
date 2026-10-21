/**
 * Which collapsible sections are open (FIXLIST-2 item 7), per viewer: this browser,
 * `imagelab.next.collapse.v1`, by the section's `id`. Unknown id = the section's own default.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CollapseState {
  open: Record<string, boolean>;
  set: (id: string, open: boolean) => void;
}

export const useCollapseStore = create<CollapseState>()(
  persist(
    (set) => ({
      open: {},
      set: (id, open) => set((s) => (s.open[id] === open ? s : { open: { ...s.open, [id]: open } })),
    }),
    { name: 'imagelab.next.collapse.v1' },
  ),
);

/** [open, setOpen] for a remembered section, for callers that render their own header / body. */
export function useSectionOpen(id: string, defaultOpen = true): [boolean, (open: boolean) => void] {
  const open = useCollapseStore((s) => s.open[id]);
  const set = useCollapseStore((s) => s.set);
  return [open ?? defaultOpen, (o: boolean) => set(id, o)];
}
