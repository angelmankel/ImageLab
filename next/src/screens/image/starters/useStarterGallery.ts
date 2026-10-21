/**
 * Item 9: one model version's CivitAI pictures that carry a prompt, in the picked order and
 * content filter. "All" asks for every level (the API's own "all" sends only the safe ones).
 *
 * Fast (fix list 2 item 5): each page shows the moment it lands (no more waiting for three pages
 * in a row); a page is 40 pictures, and only while a page yields fewer than `MIN_NEW` usable ones
 * (no prompt / clips) does the next one follow by itself. What was loaded is kept per version +
 * filter + order for the session, so going back to a model (or reopening Starters) is instant.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCivitaiImages, isCivitaiVideo, type CivitaiImage, type CivitaiImageSort, type NsfwFilter } from '@/lib/civitai';

const LIMIT = 40;
const MIN_NEW = 12;
const MAX_CHAIN = 3;

const cache = new Map<string, { items: CivitaiImage[]; cursor: string | null }>();

export function useStarterGallery(versionId: number | null, nsfw: NsfwFilter, sort: CivitaiImageSort) {
  const key = versionId == null ? '' : `${versionId}:${nsfw}:${sort}`;
  const [items, setItems] = useState<CivitaiImage[]>(() => cache.get(key)?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(() => cache.get(key)?.cursor ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const gen = useRef(0);

  const load = useCallback(async (id: number, k: string, next: string | null, append: boolean) => {
    const my = ++gen.current;
    setLoading(true); setFailed(false);
    let c = next;
    let added = 0;
    let have: CivitaiImage[] = append ? cache.get(k)?.items ?? [] : [];
    for (let i = 0; i < MAX_CHAIN; i++) {
      const page = await fetchCivitaiImages(id, c, nsfw, { sort, limit: LIMIT, everyLevel: nsfw === 'all' });
      if (my !== gen.current) return;
      if (!page) { if (!have.length) setFailed(true); c = null; break; }
      const seen = new Set(have.map((p) => p.url));
      const usable = page.items.filter((it) => !isCivitaiVideo(it) && it.meta?.prompt && !seen.has(it.url));
      have = [...have, ...usable];
      added += usable.length;
      c = page.nextCursor;
      cache.set(k, { items: have, cursor: c });
      setItems(have); setCursor(c);
      if (!c || added >= MIN_NEW) break;
    }
    setLoading(false);
  }, [nsfw, sort]);

  useEffect(() => {
    if (versionId == null) { gen.current++; setItems([]); setCursor(null); setLoading(false); return; }
    const hit = cache.get(key);
    if (hit) { gen.current++; setItems(hit.items); setCursor(hit.cursor); setLoading(false); setFailed(false); return; }
    setItems([]); setCursor(null);
    void load(versionId, key, null, false);
  }, [versionId, key, load]);

  const more = useCallback(() => { if (versionId != null && cursor && !loading) void load(versionId, key, cursor, true); }, [versionId, key, cursor, loading, load]);
  const reload = useCallback(() => { if (versionId != null) { cache.delete(key); void load(versionId, key, null, false); } }, [versionId, key, load]);
  return { items, loading, failed, hasMore: !!cursor, more, reload };
}
