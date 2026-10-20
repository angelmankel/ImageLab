/**
 * Item 9: one model version's CivitAI pictures that carry a prompt, in the picked order and
 * content filter, a few API pages at a time (`more()` adds the next). "All" asks for every level
 * (the API's own "all" sends only the safe ones).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCivitaiImages, isCivitaiVideo, type CivitaiImage, type CivitaiImageSort, type NsfwFilter } from '@/lib/civitai';

const PAGES = 3;

export function useStarterGallery(versionId: number | null, nsfw: NsfwFilter, sort: CivitaiImageSort) {
  const [items, setItems] = useState<CivitaiImage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const gen = useRef(0);

  const load = useCallback(async (id: number, next: string | null, append: boolean) => {
    const my = ++gen.current;
    setLoading(true); setFailed(false);
    const got: CivitaiImage[] = [];
    let c = next;
    for (let i = 0; i < PAGES; i++) {
      const page = await fetchCivitaiImages(id, c, nsfw, { sort, limit: 20, everyLevel: nsfw === 'all' });
      if (my !== gen.current) return;
      if (!page) { if (!append && !got.length) setFailed(true); c = null; break; }
      got.push(...page.items); c = page.nextCursor;
      if (!c) break;
    }
    const usable = got.filter((i) => !isCivitaiVideo(i) && i.meta?.prompt);
    setItems((prev) => {
      if (!append) return usable;
      const seen = new Set(prev.map((p) => p.url));
      return [...prev, ...usable.filter((u) => !seen.has(u.url))];
    });
    setCursor(c); setLoading(false);
  }, [nsfw, sort]);

  useEffect(() => {
    if (versionId == null) { gen.current++; setItems([]); setCursor(null); setLoading(false); return; }
    setItems([]);
    void load(versionId, null, false);
  }, [versionId, load]);

  const more = useCallback(() => { if (versionId != null && cursor && !loading) void load(versionId, cursor, true); }, [versionId, cursor, loading, load]);
  const reload = useCallback(() => { if (versionId != null) void load(versionId, null, false); }, [versionId, load]);
  return { items, loading, failed, hasMore: !!cursor, more, reload };
}
