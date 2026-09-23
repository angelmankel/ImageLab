/**
 * Open/closed state for the left panel's sections, kept in one place so the panel toolbar can act
 * on all of them: expand all, collapse all, and v1's single-open mode, where opening one section
 * folds the rest. Sections register while mounted, in render order, so "all" means the sections
 * on screen right now and "the first open one" means the topmost.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SectionGroupState {
  /** Folded state by section id. Missing means the section's own default. */
  collapsed: Record<string, boolean>;
  singleOpen: boolean;
  /** Mounted sections, top to bottom, with their defaults. Not persisted. */
  mounted: { id: string; defaultCollapsed: boolean }[];

  register: (id: string, defaultCollapsed: boolean) => void;
  unregister: (id: string) => void;
  setOpen: (id: string, open: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  toggleSingleOpen: () => void;
}

export function isOpen(s: Pick<SectionGroupState, 'collapsed'>, id: string, defaultCollapsed: boolean) {
  return !(s.collapsed[id] ?? defaultCollapsed);
}

export const useSectionGroup = create<SectionGroupState>()(
  persist(
    (set, get) => ({
      collapsed: {},
      singleOpen: false,
      mounted: [],

      register: (id, defaultCollapsed) => set(s => ({
        mounted: [...s.mounted.filter(m => m.id !== id), { id, defaultCollapsed }],
      })),
      unregister: (id) => set(s => ({ mounted: s.mounted.filter(m => m.id !== id) })),

      setOpen: (id, open) => set(s => {
        const collapsed = { ...s.collapsed, [id]: !open };
        if (open && s.singleOpen) for (const m of s.mounted) if (m.id !== id) collapsed[m.id] = true;
        return { collapsed };
      }),

      expandAll: () => set(s => {
        const collapsed = { ...s.collapsed };
        for (const m of s.mounted) collapsed[m.id] = false;
        return { collapsed };
      }),

      collapseAll: () => set(s => {
        const collapsed = { ...s.collapsed };
        for (const m of s.mounted) collapsed[m.id] = true;
        return { collapsed };
      }),

      toggleSingleOpen: () => {
        const s = get();
        const singleOpen = !s.singleOpen;
        if (!singleOpen) return set({ singleOpen });
        // Turning it on keeps the topmost open section and folds the others.
        const first = s.mounted.find(m => isOpen(s, m.id, m.defaultCollapsed));
        const collapsed = { ...s.collapsed };
        for (const m of s.mounted) if (m.id !== first?.id) collapsed[m.id] = true;
        set({ singleOpen, collapsed });
      },
    }),
    {
      name: 'imagelab.panelSections.v1',
      partialize: (s) => ({ collapsed: s.collapsed, singleOpen: s.singleOpen }),
    },
  ),
);
