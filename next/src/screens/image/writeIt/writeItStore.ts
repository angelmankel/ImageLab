/**
 * Item 11: what "Write it" remembers in this browser — the user's own system prompt per source
 * (empty = the stock one), the LLM parameters per provider (unset = the provider's default),
 * and whether the cog's advanced part was left open.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiProviderId } from '@/lib/aiProviders';
import type { AiParamId, AiParamValues } from '@/lib/aiParams';
import type { GenerateLayerSource } from '@/lib/ai';

interface WriteItState {
  system: Partial<Record<GenerateLayerSource, string>>;
  params: Partial<Record<AiProviderId, AiParamValues>>;
  advanced: boolean;
  setSystem: (source: GenerateLayerSource, text: string) => void;
  setParam: (provider: AiProviderId, id: AiParamId, v: number | undefined) => void;
  resetParams: (provider: AiProviderId) => void;
  setAdvanced: (v: boolean) => void;
}

export const useWriteIt = create<WriteItState>()(
  persist(
    (set) => ({
      system: {},
      params: {},
      advanced: false,
      setSystem: (source, text) => set((s) => ({ system: { ...s.system, [source]: text } })),
      setParam: (provider, id, v) => set((s) => {
        const cur = { ...(s.params[provider] ?? {}) };
        if (v === undefined) delete cur[id]; else cur[id] = v;
        return { params: { ...s.params, [provider]: cur } };
      }),
      resetParams: (provider) => set((s) => ({ params: { ...s.params, [provider]: {} } })),
      setAdvanced: (advanced) => set({ advanced }),
    }),
    { name: 'imagelab.next.writeIt.v1' },
  ),
);
