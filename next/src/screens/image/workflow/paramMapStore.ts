/**
 * Item 39: the user's workflow mappings (widget → label / group / control / hint / hidden / role),
 * per saved workflow path, kept in this browser; and which workflow the mapping editor is open on.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ParamMapping, WorkflowMap } from './paramMap';

const NO_MAP: WorkflowMap = Object.freeze({}) as WorkflowMap;

interface ParamMapState {
  maps: Record<string, WorkflowMap>;
  setMapping: (path: string, id: string, patch: ParamMapping) => void;
  clearMap: (path: string) => void;
}

export const useParamMap = create<ParamMapState>()(
  persist(
    (set) => ({
      maps: {},
      setMapping: (path, id, patch) => set((s) => {
        const cur = { ...(s.maps[path] ?? {}) };
        const next: ParamMapping = { ...(cur[id] ?? {}), ...patch };
        for (const k of Object.keys(next) as Array<keyof ParamMapping>) if (next[k] === undefined || next[k] === '' || next[k] === false) delete next[k];
        if (Object.keys(next).length) cur[id] = next; else delete cur[id];
        return { maps: { ...s.maps, [path]: cur } };
      }),
      clearMap: (path) => set((s) => { const maps = { ...s.maps }; delete maps[path]; return { maps }; }),
    }),
    { name: 'imagelab.next.workflowMap.v1' },
  ),
);

/** The mapping of one workflow (a frozen empty when there is none: safe in a selector). */
export function useWorkflowMap(path: string | null): WorkflowMap {
  return useParamMap((s) => (path ? s.maps[path] ?? NO_MAP : NO_MAP));
}

interface EditorState {
  target: { host: string; path: string; name: string } | null;
  open: (t: { host: string; path: string; name: string }) => void;
  close: () => void;
}

export const useMapEditor = create<EditorState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
