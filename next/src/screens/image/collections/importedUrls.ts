/**
 * Object URLs for imported pictures (bytes in IndexedDB, `@/lib/importedDb`), made once per id
 * and kept for the page's life; revoked when the picture leaves `importedImages`. A hook re-renders
 * its caller as URLs arrive. Used by the Collections tiles and grid (FIXLIST 21).
 */
import { useEffect, useReducer } from 'react';
import { getImportedBlob } from '@/lib/importedDb';
import { useStore } from '@/lib/store';

const urls = new Map<string, string>();
const loading = new Set<string>();
const listeners = new Set<() => void>();

function load(id: string) {
  if (urls.has(id) || loading.has(id)) return;
  loading.add(id);
  void getImportedBlob(id).then((blob) => {
    loading.delete(id);
    if (!blob) return;
    urls.set(id, URL.createObjectURL(blob));
    listeners.forEach((l) => l());
  }).catch(() => loading.delete(id));
}

// Drop the URLs of pictures that are gone.
useStore.subscribe((s, prev) => {
  if (s.importedImages === prev.importedImages) return;
  const keep = new Set(s.importedImages.map((i) => i.id));
  for (const [id, u] of urls) if (!keep.has(id)) { URL.revokeObjectURL(u); urls.delete(id); }
});

/** The object URL of an imported picture, or '' while it loads. */
export function importedUrl(id: string): string {
  const u = urls.get(id);
  if (!u) load(id);
  return u ?? '';
}

/** Re-render when any imported URL arrives. */
export function useImportedUrlsTick(): number {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => { listeners.add(bump); return () => { listeners.delete(bump); }; }, []);
  return tick;
}
