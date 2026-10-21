/**
 * Items 11 + 37: what the prompt studio ("✦ Write it") remembers in this browser — the system
 * prompt presets (Stock + the user's own, which one is picked), the LLM parameters per provider
 * (unset = the provider's default; Temperature is the "Creativity" control), the quick picks
 * (style, length, how many options), the recent writes, and the right column's tab.
 * v1 kept one custom system prompt per source: it becomes a preset "My system prompt" once.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiProviderId } from '@/lib/aiProviders';
import type { AiParamId, AiParamValues } from '@/lib/aiParams';
import { pushRecent, type RecentWrite } from './studioLogic';

export interface SystemPreset { id: string; name: string; text: string }
export type StudioTab = 'results' | 'recent' | 'settings';

interface WriteItState {
  presets: SystemPreset[];
  /** 'stock' or a preset id. */
  presetId: string;
  params: Partial<Record<AiProviderId, AiParamValues>>;
  style: string;
  length: string;
  count: number;
  recent: RecentWrite[];
  tab: StudioTab;
  moreParams: boolean;
  savePreset: (p: SystemPreset) => void;
  deletePreset: (id: string) => void;
  setPresetId: (id: string) => void;
  setParam: (provider: AiProviderId, id: AiParamId, v: number | undefined) => void;
  resetParams: (provider: AiProviderId) => void;
  setStyle: (id: string) => void;
  setLength: (id: string) => void;
  setCount: (n: number) => void;
  addRecent: (w: RecentWrite) => void;
  removeRecent: (id: string) => void;
  setTab: (t: StudioTab) => void;
  setMoreParams: (v: boolean) => void;
}

export const useWriteIt = create<WriteItState>()(
  persist(
    (set) => ({
      presets: [],
      presetId: 'stock',
      params: {},
      style: 'any',
      length: 'medium',
      count: 3,
      recent: [],
      tab: 'results',
      moreParams: false,
      savePreset: (p) => set((s) => ({ presets: s.presets.some((x) => x.id === p.id) ? s.presets.map((x) => (x.id === p.id ? p : x)) : [...s.presets, p], presetId: p.id })),
      deletePreset: (id) => set((s) => ({ presets: s.presets.filter((x) => x.id !== id), presetId: s.presetId === id ? 'stock' : s.presetId })),
      setPresetId: (presetId) => set({ presetId }),
      setParam: (provider, id, v) => set((s) => {
        const cur = { ...(s.params[provider] ?? {}) };
        if (v === undefined) delete cur[id]; else cur[id] = v;
        return { params: { ...s.params, [provider]: cur } };
      }),
      resetParams: (provider) => set((s) => ({ params: { ...s.params, [provider]: {} } })),
      setStyle: (style) => set({ style }),
      setLength: (length) => set({ length }),
      setCount: (count) => set({ count: Math.max(1, Math.min(3, Math.round(count))) }),
      addRecent: (w) => set((s) => ({ recent: pushRecent(s.recent, w) })),
      removeRecent: (id) => set((s) => ({ recent: s.recent.filter((r) => r.id !== id) })),
      setTab: (tab) => set({ tab }),
      setMoreParams: (moreParams) => set({ moreParams }),
    }),
    {
      name: 'imagelab.next.writeIt.v1',
      version: 2,
      migrate: (old, from) => {
        const o = (old ?? {}) as Record<string, unknown>;
        if (from < 2) {
          const sys = (o.system ?? {}) as Record<string, string | undefined>;
          const mine = (sys.idea ?? sys.prompt ?? '').trim();
          const presets: SystemPreset[] = mine ? [{ id: 'mine', name: 'My system prompt', text: mine }] : [];
          return { params: o.params ?? {}, presets, presetId: mine ? 'mine' : 'stock' } as unknown as WriteItState;
        }
        return o as unknown as WriteItState;
      },
    },
  ),
);
