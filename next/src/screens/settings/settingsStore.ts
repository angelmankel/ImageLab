/**
 * The Settings page's own state: the open category (remembered in this browser under
 * `imagelab.next.settings.v1`, read and written inside try/catch like the other next stores) and
 * the live search text (never saved: a reopened page starts clean).
 */
import { create } from 'zustand';
import { CATEGORY_IDS, type CategoryId } from './settingsLogic';

const KEY = 'imagelab.next.settings.v1';

function loadCategory(): CategoryId {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as { category?: string } | null;
    if (raw && (CATEGORY_IDS as readonly string[]).includes(raw.category ?? '')) return raw.category as CategoryId;
  } catch { /* ignore */ }
  return 'servers';
}

function saveCategory(category: CategoryId) {
  try { localStorage.setItem(KEY, JSON.stringify({ category })); } catch { /* ignore */ }
}

interface SettingsUiState {
  category: CategoryId;
  query: string;
  setCategory: (c: CategoryId) => void;
  setQuery: (q: string) => void;
}

export const useSettingsUi = create<SettingsUiState>((set) => ({
  category: typeof localStorage === 'undefined' ? 'servers' : loadCategory(),
  query: '',
  setCategory: (category) => { saveCategory(category); set({ category }); },
  setQuery: (query) => set({ query }),
}));
