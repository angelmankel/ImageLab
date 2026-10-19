/**
 * Venice's model list, fetched once per base URL while the page is open and shared by every
 * picker that shows it.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { fetchVeniceModels, type VeniceModel } from '@/lib/veniceModels';
import { VENICE_DEFAULT_BASE_URL } from '@/lib/storage';

interface VeniceModelsState {
  checkedUrl: string;
  models: VeniceModel[];
  error: string;
  load: (baseUrl: string) => Promise<void>;
}

let loading = '';

export const useVeniceModels = create<VeniceModelsState>((set, get) => ({
  checkedUrl: '',
  models: [],
  error: '',
  load: async (baseUrl) => {
    if (get().checkedUrl === baseUrl || loading === baseUrl) return;
    loading = baseUrl;
    try {
      set({ checkedUrl: baseUrl, models: await fetchVeniceModels(baseUrl), error: '' });
    } catch (e) {
      set({ checkedUrl: baseUrl, models: [], error: e instanceof Error ? e.message : String(e) });
    } finally {
      loading = '';
    }
  },
}));

/** Loads the list for this base URL ('' = Venice's own) on first use. */
export function useVeniceModelsFor(baseUrl: string) {
  const url = baseUrl.trim() || VENICE_DEFAULT_BASE_URL;
  const load = useVeniceModels((s) => s.load);
  useEffect(() => { void load(url); }, [url, load]);
}
