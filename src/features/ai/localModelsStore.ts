/**
 * The local LLM server's state as the page last saw it: installed models, what is loaded on the
 * GPU, and downloads in flight. Downloads live here, not in a component, so closing Settings does
 * not cancel one.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import {
  deleteLocalModel, listLocalModels, listRunningModels, ollamaVersion, pullLocalModel, unloadLocalModel,
  type LocalModel, type RunningModel,
} from '@/lib/localLlm';

export type PullState = {
  status: string;
  completed: number;
  total: number;
  error?: string;
  done?: boolean;
};

interface LocalModelsState {
  /** The server root these results came from; a different one means "not checked yet". */
  checkedUrl: string;
  loading: boolean;
  version: string;
  error: string;
  models: LocalModel[];
  running: RunningModel[];
  pulls: Record<string, PullState>;

  refresh: (baseUrl: string) => Promise<void>;
  pull: (baseUrl: string, name: string) => Promise<void>;
  cancelPull: (name: string) => void;
  clearPull: (name: string) => void;
  remove: (baseUrl: string, name: string) => Promise<void>;
  unload: (baseUrl: string, name: string) => Promise<void>;
}

const controllers = new Map<string, AbortController>();
let refreshing = '';

export const useLocalModels = create<LocalModelsState>((set, get) => ({
  checkedUrl: '',
  loading: false,
  version: '',
  error: '',
  models: [],
  running: [],
  pulls: {},

  refresh: async (baseUrl) => {
    if (!baseUrl.trim()) {
      set({ checkedUrl: '', version: '', error: 'No server address set', models: [], running: [] });
      return;
    }
    if (refreshing === baseUrl) return;
    refreshing = baseUrl;
    set({ loading: true });
    try {
      const [version, models, running] = await Promise.all([
        ollamaVersion(baseUrl), listLocalModels(baseUrl), listRunningModels(baseUrl),
      ]);
      set({ checkedUrl: baseUrl, loading: false, version, error: '', models, running });
    } catch (e) {
      set({
        checkedUrl: baseUrl, loading: false, version: '', models: [], running: [],
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      refreshing = '';
    }
  },

  pull: async (baseUrl, name) => {
    const n = name.trim();
    if (!n || controllers.has(n)) return;
    const ctrl = new AbortController();
    controllers.set(n, ctrl);
    const put = (p: PullState) => set((s) => ({ pulls: { ...s.pulls, [n]: p } }));
    put({ status: 'starting', completed: 0, total: 0 });
    try {
      await pullLocalModel(baseUrl, n, (p) => {
        const prev = get().pulls[n];
        // Each file reports its own total; keep the last byte counts through the
        // short "verifying" / "writing manifest" steps that carry none.
        put({ status: p.status, completed: p.completed ?? (p.total ? 0 : prev?.completed ?? 0), total: p.total ?? prev?.total ?? 0 });
      }, ctrl.signal);
      put({ status: 'success', completed: 1, total: 1, done: true });
      void get().refresh(baseUrl);
    } catch (e) {
      put({
        status: ctrl.signal.aborted ? 'cancelled' : 'failed',
        completed: 0, total: 0, done: true,
        error: ctrl.signal.aborted ? undefined : (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      controllers.delete(n);
    }
  },

  cancelPull: (name) => controllers.get(name)?.abort(),

  clearPull: (name) => set((s) => {
    const pulls = { ...s.pulls };
    delete pulls[name];
    return { pulls };
  }),

  remove: async (baseUrl, name) => {
    await deleteLocalModel(baseUrl, name);
    await get().refresh(baseUrl);
  },

  unload: async (baseUrl, name) => {
    await unloadLocalModel(baseUrl, name);
    await get().refresh(baseUrl);
  },
}));

/** Load the server's model list once per address while a component that needs it is mounted. */
export function useLocalModelsFor(baseUrl: string, enabled = true) {
  const checkedUrl = useLocalModels((s) => s.checkedUrl);
  const refresh = useLocalModels((s) => s.refresh);
  useEffect(() => {
    if (enabled && baseUrl.trim() && checkedUrl !== baseUrl) void refresh(baseUrl);
  }, [enabled, baseUrl, checkedUrl, refresh]);
}
