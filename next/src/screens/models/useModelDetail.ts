/**
 * Data for the opened model (rule 13): the full /models/:id payload (every version, files, hashes,
 * trigger words) and the selected version's sample images from /images, which — unlike the model
 * payload — carry the generation `meta` behind Use prompt / Use settings. Both are cached in
 * memory per id so reopening is instant; the model payload is also IDB-cached by the main app.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import type { CivitaiModel, CivitaiImage } from '@/lib/civitai';
import { seedPopular } from '@/lib/previewOrder';
import { fetchModel, fetchImages } from './civitaiApi';
import { ALL_LEVELS } from './civitaiQuery';

const models = new Map<number, CivitaiModel>();

export function useModelDetail(modelId: number | null): { model: CivitaiModel | null; loading: boolean; error: string | null; retry: () => void } {
  const [model, setModel] = useState<CivitaiModel | null>(modelId != null ? models.get(modelId) ?? null : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (modelId == null) { setModel(null); setError(null); setLoading(false); return; }
    const hit = models.get(modelId);
    setModel(hit ?? null);
    setError(null);
    if (hit) { setLoading(false); return; }
    const ac = new AbortController();
    setLoading(true);
    fetchModel(modelId, ac.signal)
      .then((m) => { models.set(modelId, m); if (!ac.signal.aborted) { setModel(m); setLoading(false); } })
      .catch((e) => { if (!ac.signal.aborted) { setError(e instanceof Error ? e.message : 'Could not load the model'); setLoading(false); } });
    return () => ac.abort();
  }, [modelId, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { model, loading, error, retry };
}

/** A page of the gallery (item 28: enough per request that a big gallery fills quickly). */
const IMAGES_PAGE = 40;
const imageCache = new Map<string, { items: CivitaiImage[]; nextCursor: string | null }>();

/**
 * The version's gallery with `meta`. Falls back to the model payload's images (no meta) while
 * loading or when the images API fails, so the gallery never looks empty.
 */
export function useVersionImages(versionId: number | null, nsfwMask: number, fallback: CivitaiImage[] | undefined) {
  const key = versionId == null ? '' : `${versionId}:${nsfwMask}`;
  const [state, setState] = useState<{ key: string; items: CivitaiImage[]; nextCursor: string | null; loading: boolean; failed: boolean }>(
    { key, items: imageCache.get(key)?.items ?? [], nextCursor: imageCache.get(key)?.nextCursor ?? null, loading: false, failed: false },
  );
  const busy = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!key) { setState({ key, items: [], nextCursor: null, loading: false, failed: false }); return; }
    const hit = imageCache.get(key);
    if (hit) { setState({ key, items: hit.items, nextCursor: hit.nextCursor, loading: false, failed: false }); return; }
    const ac = new AbortController();
    setState({ key, items: [], nextCursor: null, loading: true, failed: false });
    fetchImages({ modelVersionId: versionId!, nsfwMask, limit: IMAGES_PAGE, sort: 'Most Reactions' }, ac.signal)
      .then((p) => {
        imageCache.set(key, p);
        // At every level this first page IS the preview's "Most popular" list: hand it over, so
        // a model opened big costs the previews no second request.
        if (nsfwMask === ALL_LEVELS) seedPopular(versionId, p.items);
        if (!ac.signal.aborted) setState({ key, items: p.items, nextCursor: p.nextCursor, loading: false, failed: false });
      })
      .catch(() => { if (!ac.signal.aborted) setState({ key, items: [], nextCursor: null, loading: false, failed: true }); });
    return () => ac.abort();
  }, [key, versionId, nsfwMask]);

  const loadMore = useCallback(async () => {
    if (!key || !state.nextCursor || busy.current) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const p = await fetchImages({ modelVersionId: versionId!, nsfwMask, limit: IMAGES_PAGE, sort: 'Most Reactions', cursor: state.nextCursor });
      const merged = { items: [...state.items, ...p.items], nextCursor: p.nextCursor };
      imageCache.set(key, merged);
      setState((s) => (s.key === key ? { ...s, ...merged } : s));
    } catch { /* keep what we have */ } finally { busy.current = false; setLoadingMore(false); }
  }, [key, versionId, nsfwMask, state.nextCursor, state.items]);

  const useFallback = state.items.length === 0 && (state.loading || state.failed);
  const items = useFallback ? (fallback ?? []) : state.items;
  return { items, loading: state.loading && items.length === 0, loadingMore, hasMore: !!state.nextCursor, loadMore, fromApi: !useFallback };
}
