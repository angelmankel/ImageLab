/**
 * Each provider's model list as the page last fetched it, keyed by provider and shared by every
 * picker (the settings pages, the in-context model pickers, the Collections vision pick). A list
 * is fetched once per key + URL while the page is open; `test` fetches again on demand — that is
 * what the settings page's Test button does, and the caller marks the entry tested on success.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { resolveBaseUrl, type AiModel, type AiProviderEntry } from '@/lib/aiProviders';
import { testProvider } from '@/lib/ai';

export type ProviderModels = {
  /** Which key + URL the list came from; a different one means "not fetched yet". */
  key: string;
  loading: boolean;
  error: string;
  models: AiModel[];
  /** The last Test's one-liner ("Works · 42 chat models"). */
  summary: string;
};

const NO_MODELS: AiModel[] = Object.freeze([]) as unknown as AiModel[];
export const NOT_LOADED: ProviderModels = Object.freeze({ key: '', loading: false, error: '', models: NO_MODELS, summary: '' });

interface AiModelsState {
  byId: Record<string, ProviderModels>;
  load: (entry: AiProviderEntry, force?: boolean) => Promise<void>;
  /** A forced load that reports the outcome inline. */
  test: (entry: AiProviderEntry) => Promise<{ ok: boolean; message: string }>;
}

export const fetchKey = (e: AiProviderEntry) => `${e.id}|${resolveBaseUrl(e)}|${e.apiKey}`;

const inFlight = new Map<string, Promise<{ ok: boolean; message: string }>>();

export const useAiModels = create<AiModelsState>((set, get) => ({
  byId: {},

  test: (entry) => {
    const key = fetchKey(entry);
    const running = inFlight.get(entry.id);
    if (running && (get().byId[entry.id]?.key === key)) return running;
    const prev = get().byId[entry.id] ?? NOT_LOADED;
    set((s) => ({ byId: { ...s.byId, [entry.id]: { ...prev, key, loading: true, error: '' } } }));
    // A slower answer for an older key never overwrites the newer one's.
    const current = () => get().byId[entry.id]?.key === key;
    const p = testProvider(entry)
      .then(({ models, summary }) => {
        if (current()) set((s) => ({ byId: { ...s.byId, [entry.id]: { key, loading: false, error: '', models, summary } } }));
        return { ok: true, message: summary };
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (current()) set((s) => ({ byId: { ...s.byId, [entry.id]: { key, loading: false, error: message, models: NO_MODELS, summary: '' } } }));
        return { ok: false, message };
      })
      .finally(() => { if (inFlight.get(entry.id) === p) inFlight.delete(entry.id); });
    inFlight.set(entry.id, p);
    return p;
  },

  load: async (entry, force = false) => {
    const slot = get().byId[entry.id];
    if (!force && slot && slot.key === fetchKey(entry)) return;
    await get().test(entry);
  },
}));

/** This provider's list, loading it on first use when the entry is usable (Local: always;
 *  a key provider: once its key passed a Test — an untested key is never sent on its own). */
export function useProviderModels(entry: AiProviderEntry | undefined, enabled = true): ProviderModels {
  const slot = useAiModels((s) => (entry ? s.byId[entry.id] : undefined)) ?? NOT_LOADED;
  const load = useAiModels((s) => s.load);
  const key = entry ? fetchKey(entry) : '';
  const want = !!entry && enabled && (entry.id === 'local' ? !!entry.baseUrl.trim() : entry.tested && !!entry.apiKey.trim());
  useEffect(() => {
    if (want && entry && slot.key !== key) void load(entry);
  }, [want, key, slot.key, entry, load]);
  return slot;
}
