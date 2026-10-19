/**
 * The workspace's own preferences: Simple or Advanced, and which snippets were used lately.
 *
 * The mode itself is `canvasStore.mainView` (see `lib/workspace.ts`), so this holds only what
 * the three modes share. Studio used to keep its own simple/advanced switch; a saved "advanced"
 * there seeds this once, so nobody loses the view they had.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { pushRecent, type Detail } from '@/lib/workspace';

const KEY = 'imagelab.workspace.v1';

interface WorkspaceState {
  detail: Detail;
  recentSnippetIds: string[];
  setDetail: (d: Detail) => void;
  toggleDetail: () => void;
  touchSnippet: (id: string) => void;
}

function studioWasAdvanced(): boolean {
  try { return JSON.parse(localStorage.getItem('imagelab.studio.v1') || 'null')?.mode === 'advanced'; } catch { return false; }
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      detail: studioWasAdvanced() ? 'advanced' : 'simple',
      recentSnippetIds: [],
      setDetail: (detail) => set({ detail }),
      toggleDetail: () => set({ detail: get().detail === 'simple' ? 'advanced' : 'simple' }),
      touchSnippet: (id) => set({ recentSnippetIds: pushRecent(get().recentSnippetIds, id) }),
    }),
    { name: KEY, partialize: (s) => ({ detail: s.detail, recentSnippetIds: s.recentSnippetIds }) },
  ),
);
