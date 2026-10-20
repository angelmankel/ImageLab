/**
 * Item 35: the theme in use + the user's saved palettes, kept in this browser
 * (`imagelab.next.theme.v1`, read / written in try/catch like the other next stores). Every change
 * is applied to <html> at once (applyTheme). `preview` is a palette shown while the pointer rests
 * on a palette card (desktop "hover to preview"); it is never saved.
 */
import { create } from 'zustand';
import { applyTheme } from './applyTheme';
import {
  DEFAULT_THEME, generatePalette, sanitizeGen, sanitizePalette, sanitizeTheme,
  type GenParams, type NamedPalette, type Palette, type PaletteKey, type ThemeSettings,
} from './themeModel';

const KEY = 'imagelab.next.theme.v1';
const MAX_SAVED = 40;

interface Stored { theme: ThemeSettings; saved: NamedPalette[] }

function load(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as { theme?: unknown; saved?: unknown } | null;
    if (raw) {
      const saved = Array.isArray(raw.saved)
        ? raw.saved.flatMap((x): NamedPalette[] => {
          const o = x as Record<string, unknown>;
          if (!o || typeof o.id !== 'string' || typeof o.name !== 'string') return [];
          return [{ id: o.id, name: o.name.slice(0, 40), palette: sanitizePalette(o.palette), gen: o.gen ? sanitizeGen(o.gen) : undefined }];
        }).slice(0, MAX_SAVED)
        : [];
      return { theme: sanitizeTheme(raw.theme), saved };
    }
  } catch { /* ignore */ }
  return { theme: DEFAULT_THEME, saved: [] };
}

function save(s: Stored) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export interface ThemeState extends Stored {
  preview: Palette | null;
  /** Bumped when corners / density change, so the root re-renders and `T.radius` / `T.gap` reads are fresh. */
  layoutRev: number;
  set: (patch: Partial<ThemeSettings>) => void;
  /** Generator inputs → a fresh palette ('custom'). */
  setGen: (patch: Partial<GenParams>) => void;
  /** Use a preset or saved palette. */
  pickPalette: (p: NamedPalette) => void;
  /** Fine-tune one token. */
  setToken: (key: PaletteKey, hex: string) => void;
  savePalette: (name: string) => string;
  renamePalette: (id: string, name: string) => void;
  deletePalette: (id: string) => void;
  /** Replace the whole theme (import, undo, reset). */
  replace: (theme: ThemeSettings) => void;
  setPreview: (p: Palette | null) => void;
}

const initial = typeof localStorage === 'undefined' ? { theme: DEFAULT_THEME, saved: [] } : load();

export const useTheme = create<ThemeState>((set, get) => {
  const commit = (theme: ThemeSettings, saved = get().saved) => {
    const prev = get().theme;
    const layout = prev.corners !== theme.corners || prev.density !== theme.density;
    set({ theme, saved, ...(layout ? { layoutRev: get().layoutRev + 1 } : {}) });
    save({ theme, saved });
  };
  return {
    ...initial,
    preview: null,
    layoutRev: 0,
    set: (patch) => commit({ ...get().theme, ...patch }),
    setGen: (patch) => {
      const gen = { ...get().theme.gen, ...patch };
      commit({ ...get().theme, gen, palette: generatePalette(gen), paletteId: 'custom' });
    },
    pickPalette: (p) => {
      set({ preview: null });
      commit({ ...get().theme, palette: p.palette, paletteId: p.id, ...(p.gen ? { gen: p.gen } : {}) });
    },
    setToken: (key, hex) => commit({ ...get().theme, palette: { ...get().theme.palette, [key]: hex.toUpperCase() }, paletteId: 'custom' }),
    savePalette: (name) => {
      const { theme, saved } = get();
      const id = `u${Date.now().toString(36)}`;
      const entry: NamedPalette = { id, name: name.trim().slice(0, 40) || 'My palette', palette: theme.palette, gen: theme.gen };
      commit({ ...theme, paletteId: id }, [entry, ...saved].slice(0, MAX_SAVED));
      return id;
    },
    renamePalette: (id, name) => commit(get().theme, get().saved.map((p) => (p.id === id ? { ...p, name: name.trim().slice(0, 40) || p.name } : p))),
    deletePalette: (id) => {
      const { theme, saved } = get();
      commit(theme.paletteId === id ? { ...theme, paletteId: 'custom' } : theme, saved.filter((p) => p.id !== id));
    },
    replace: (theme) => commit(sanitizeTheme(theme)),
    setPreview: (preview) => set({ preview }),
  };
});

// Apply now (before the first render, so there is no flash) and on every change.
if (typeof document !== 'undefined') {
  applyTheme(initial.theme, null);
  useTheme.subscribe((s, prev) => {
    if (s.theme !== prev.theme || s.preview !== prev.preview) applyTheme(s.theme, s.preview);
  });
}
