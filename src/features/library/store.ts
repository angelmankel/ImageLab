import { create } from 'zustand';
import {
  applyDetails, bareEntry, entryFromCivitai, entryFromHashLookup, exportLibrary, mergeEntries, needsDetails,
  parseLibraryText, recordEntry, removeEntries, seedEntries, setNote, setRating, type ModelLibraryEntry,
} from '@/lib/modelLibrary';
import type { CivitaiVersionByHash } from '@/lib/civitai';
import { useStore } from '@/lib/store';
import { useModelMetadataStore } from '@/features/model-metadata/store';
import { lookupVersion } from './lookup';

/**
 * "My models" store — the device-local list of every model downloaded through the app.
 *
 * Lives in localStorage (a few hundred small rows) rather than the shared `imagelab` IndexedDB,
 * which other modules open with their own schema versions. Written straight through on every
 * change: the list changes a handful of times a session, never per frame.
 *
 * `recordDownload` is called by the downloads store whenever a download starts, so every entry
 * point (model window, browser tiles, this manager) is covered in one place. The list is also
 * seeded with every model the connected servers already have that CivitAI knows.
 *
 * Only the private form is written (`privateEntry`: links and the user's own marks). Names,
 * pictures and hashes are filled in memory from the app's CivitAI cache or a lookup.
 */

const KEY = 'imagelab.modelLibrary.v1';
const MODE_KEY = 'imagelab.browserMode.v1';
/** Version ids the user removed; seeding from the servers must not put them back. */
const DISMISSED_KEY = 'imagelab.modelLibrary.dismissed.v1';

function loadDismissed(): Set<number> {
  try {
    const arr = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    return new Set(Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n)) : []);
  } catch { return new Set(); }
}
const dismissed = loadDismissed();
function saveDismissed() {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed])); } catch { /* ignore */ }
}

/** CivitAI by-hash data for every model file on the connected servers that CivitAI knows. */
function installedVersions(): CivitaiVersionByHash[] {
  const { modelHashes, civitaiByHash } = useStore.getState();
  const out: CivitaiVersionByHash[] = [];
  for (const h of modelHashes) {
    const c = civitaiByHash[h.hash];
    if (c?.status === 'found' && c.data) out.push(c.data as CivitaiVersionByHash);
  }
  return out;
}

export type BrowserMode = 'browse' | 'library';

function load(): ModelLibraryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const r = parseLibraryText(raw);
    return r.ok ? r.entries : [];
  } catch {
    return [];
  }
}

function save(entries: ModelLibraryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(exportLibrary(entries, Date.now())));
  } catch (e) {
    console.warn('[library] could not save the model list', e);
  }
}

function loadMode(): BrowserMode {
  try { return localStorage.getItem(MODE_KEY) === 'library' ? 'library' : 'browse'; } catch { return 'browse'; }
}

/** Ask the browser not to evict this origin's storage — the list is the one thing a pod wipe can't restore. */
let persistAsked = false;
function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  void navigator.storage?.persist?.().catch(() => { /* not granted — nothing to do */ });
}

type LibraryState = {
  entries: ModelLibraryEntry[];
  browserMode: BrowserMode;
  setBrowserMode: (mode: BrowserMode) => void;
  /** Record a started download. Uses the open model window's data when it has this version,
   *  otherwise looks the version up on CivitAI; records a bare entry if that fails. */
  recordDownload: (versionId: number) => Promise<void>;
  /** Fill in names, pictures and hashes (not saved): from the CivitAI cache when a server has the
   *  model, else by looking the version up. */
  fillMissingDetails: () => Promise<void>;
  /** Add every model the servers have that the list lacks (except ones the user removed). */
  seedFromServers: () => number;
  setRating: (versionId: number, rating: number) => void;
  setNote: (versionId: number, note: string) => void;
  remove: (versionIds: number[]) => void;
  /** Merge a JSON export into the list. Returns a message for the user. */
  importText: (text: string) => { ok: boolean; message: string };
};

function commit(set: (p: Partial<LibraryState>) => void, entries: ModelLibraryEntry[]) {
  save(entries);
  set({ entries });
}

let filling = false;

// Lists saved before the private form still hold names and pictures: rewrite them at once.
const initialEntries = load();
if (initialEntries.length) save(initialEntries);

export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: initialEntries,
  browserMode: loadMode(),

  setBrowserMode: (mode) => {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
    set({ browserMode: mode });
  },

  recordDownload: async (versionId) => {
    askPersist();
    if (dismissed.delete(versionId)) saveDismissed();
    const now = Date.now();
    const { model } = useModelMetadataStore.getState();
    const fromModal = model?.modelVersions.find((v) => v.id === versionId);
    let entry: ModelLibraryEntry | null = fromModal ? entryFromCivitai(model, fromModal, now, 'civitai') : null;
    const existing = get().entries.find((e) => e.versionId === versionId);
    // A re-download of a complete entry needs no lookup — only the timestamp moves.
    if (!entry && existing && !needsDetails(existing)) entry = { ...existing };
    if (!entry) {
      const found = await lookupVersion(versionId).catch(() => null);
      entry = found ? entryFromCivitai(found.model, found.version, now, found.catalog) : bareEntry(versionId, now);
    }
    commit(set, recordEntry(get().entries, entry, now));
  },

  fillMissingDetails: async () => {
    if (filling) return;
    filling = true;
    try {
      // Models a server has: the app's by-hash cache already holds their data, no request needed.
      const byVersion = new Map(installedVersions().map((d) => [d.id, d]));
      let list = get().entries;
      for (const e of list.filter(needsDetails)) {
        const d = byVersion.get(e.versionId);
        if (d) list = applyDetails(list, entryFromHashLookup(d, Date.now()));
      }
      if (list !== get().entries) commit(set, list);
      // The rest from CivitAI, three at a time.
      const todo = get().entries.filter(needsDetails);
      for (let i = 0; i < todo.length; i += 3) {
        await Promise.all(todo.slice(i, i + 3).map(async (e) => {
          const found = await lookupVersion(e.versionId).catch(() => null);
          if (!found) return;
          commit(set, applyDetails(get().entries, entryFromCivitai(found.model, found.version, Date.now(), found.catalog)));
        }));
      }
    } finally {
      filling = false;
    }
  },

  seedFromServers: () => {
    const found = installedVersions().filter((d) => !dismissed.has(d.id));
    const { entries, added } = seedEntries(get().entries, found, Date.now());
    if (added) commit(set, entries);
    return added;
  },

  setRating: (versionId, rating) => commit(set, setRating(get().entries, versionId, rating)),
  setNote: (versionId, note) => commit(set, setNote(get().entries, versionId, note)),
  remove: (versionIds) => {
    for (const id of versionIds) dismissed.add(id);
    saveDismissed();
    commit(set, removeEntries(get().entries, versionIds));
  },

  importText: (text) => {
    const r = parseLibraryText(text);
    if (!r.ok) return { ok: false, message: r.error };
    for (const e of r.entries) dismissed.delete(e.versionId);
    saveDismissed();
    const { entries, added, updated } = mergeEntries(get().entries, r.entries);
    commit(set, entries);
    const parts = [`${added} new`, `${updated} updated`];
    if (r.skipped) parts.push(`${r.skipped} unreadable skipped`);
    return { ok: true, message: `Imported ${r.entries.length} model${r.entries.length === 1 ? '' : 's'}: ${parts.join(', ')}.` };
  },
}));

// Seed from the servers whenever their model lists or the CivitAI lookups for them change; the
// short wait lets a burst of lookups land as one write.
let seedTimer: ReturnType<typeof setTimeout> | null = null;
useStore.subscribe((s, prev) => {
  if (s.modelHashes === prev.modelHashes && s.civitaiByHash === prev.civitaiByHash) return;
  if (seedTimer) clearTimeout(seedTimer);
  seedTimer = setTimeout(() => {
    seedTimer = null;
    const store = useLibraryStore.getState();
    if (store.seedFromServers() > 0) void store.fillMissingDetails();
  }, 1500);
});

// Another tab changed the list — pick it up so the two never overwrite each other's additions.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (ev.key === KEY) useLibraryStore.setState({ entries: load() });
  });
}
