/**
 * Starters' CivitAI pictures that carry a prompt, in the picked order and content filter: the
 * general CivitAI Images feed by default (fix list 2, added item: "show civit images in general,
 * not filtered by our models until the user explicitly does so"), or one installed model version's
 * pictures when "Your models" is on. "All" asks for every level (the API's own default sends only
 * the safe ones).
 *
 * Fast (item 5): each page shows the moment it lands; a page is 40 pictures, and only while a
 * page yields fewer than `MIN_NEW` usable ones (no prompt / clips) does the next one follow by
 * itself. What was loaded is kept per query for the session, so going back is instant.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isCivitaiVideo, type CivitaiImage, type CivitaiImageSort, type NsfwFilter } from '@/lib/civitai';
import { fetchImages } from '~/screens/models/civitaiApi';
import type { ImageSort, Period } from '~/screens/models/civitaiQuery';

const LIMIT = 40;
const MIN_NEW = 12;
const MAX_CHAIN = 3;

export interface StarterQuery {
  /** Off: nothing loads (another source is shown). */
  enabled: boolean;
  /** One model version's pictures; null = the general feed. */
  versionId: number | null;
  nsfw: NsfwFilter;
  sort: CivitaiImageSort;
  /** The general feed's time window (ignored for one model). */
  period: Period;
}

const cache = new Map<string, { items: CivitaiImage[]; cursor: string | null }>();

const keyOf = (q: StarterQuery) => (q.enabled ? `${q.versionId ?? 'all'}:${q.nsfw}:${q.sort}:${q.versionId == null ? q.period : ''}` : '');

export function useStarterGallery(q: StarterQuery) {
  const key = keyOf(q);
  const [items, setItems] = useState<CivitaiImage[]>(() => cache.get(key)?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(() => cache.get(key)?.cursor ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const gen = useRef(0);
  const { versionId, nsfw, sort, period } = q;

  const load = useCallback(async (k: string, next: string | null, append: boolean) => {
    const my = ++gen.current;
    setLoading(true); setFailed(false);
    let c = next;
    let added = 0;
    let have: CivitaiImage[] = append ? cache.get(k)?.items ?? [] : [];
    for (let i = 0; i < MAX_CHAIN; i++) {
      let page: { items: CivitaiImage[]; nextCursor: string | null } | null = null;
      try {
        page = await fetchImages({
          modelVersionId: versionId ?? undefined, limit: LIMIT, cursor: c, withMeta: true,
          sort: sort as ImageSort, period: versionId == null ? period : undefined,
          nsfw: nsfw === 'sfw' ? false : nsfw === 'nsfw' ? true : 'all',
        });
      } catch { page = null; }
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
  }, [versionId, nsfw, sort, period]);

  useEffect(() => {
    if (!key) { gen.current++; setItems([]); setCursor(null); setLoading(false); return; }
    const hit = cache.get(key);
    if (hit) { gen.current++; setItems(hit.items); setCursor(hit.cursor); setLoading(false); setFailed(false); return; }
    setItems([]); setCursor(null);
    void load(key, null, false);
  }, [key, load]);

  const more = useCallback(() => { if (key && cursor && !loading) void load(key, cursor, true); }, [key, cursor, loading, load]);
  const reload = useCallback(() => { if (key) { cache.delete(key); void load(key, null, false); } }, [key, load]);
  return { items, loading, failed, hasMore: !!cursor, more, reload };
}
