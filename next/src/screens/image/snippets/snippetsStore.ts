/**
 * Rule 6: where the snippet chips were left — the picked category tab per prompt kind (positive /
 * negative), persisted like the other next stores so the row opens where it was.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LayerKind } from '@/lib/types';

interface SnippetsUiState {
  tab: Partial<Record<LayerKind, string>>;
  setTab: (kind: LayerKind, categoryId: string) => void;
}

export const useSnippetsUi = create<SnippetsUiState>()(
  persist(
    (set) => ({
      tab: {},
      setTab: (kind, categoryId) => set((s) => ({ tab: { ...s.tab, [kind]: categoryId } })),
    }),
    { name: 'imagelab.next.snippets.v1' },
  ),
);
