/**
 * "Model preview starts on" (Settings → Models & CivitAI; `useStore().modelPreviewSource`) applied
 * to one model's pictures. Every place that shows a model's preview — the Models screen's tiles
 * and rows, the picker grid, the bubbles, the selected model's card, the viewer's first picture —
 * orders its pictures through this hook:
 *   first   → CivitAI's curated order
 *   popular → the version's most-reacted pictures (`@/lib/previewOrder`), curated until they load.
 *             Loaded once per version when its picture scrolls into view (`observe`, the ref the
 *             caller puts on the picture; three lookups at a time), on `start()` or while `active`
 *             (a model shown big); a failure keeps the curated order. No hover needed (Donny 10-20).
 *   random  → shuffled on mount and again on every `start()` (each hover)
 *   history → this model's local generations first (the main store's history), then CivitAI's
 * Popular pictures beyond the Models screen's NSFW level are left out of the popular list (the
 * curated ones keep each caller's own hidden-sample rule).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useStore } from '@/lib/store';
import { viewUrl } from '@/lib/comfy';
import {
  cancelPopular, fileKey, historyIndex, orderPreviewImages, popularFor, requestPopular, subscribePopular, type PreviewImage,
} from '@/lib/previewOrder';
import type { HistoryEntry } from '@/lib/types';
import type { Server } from '@/lib/storage';
import { useModels } from '~/screens/models/modelsStore';
import { isBeyondMask } from '~/screens/models/civitaiQuery';

export type { PreviewImage };

const NO_HISTORY: HistoryEntry[] = [];
const NO_URLS: string[] = [];

// One index for every hook on the page, rebuilt when the history or the server list changes.
let last: { history: readonly HistoryEntry[]; servers: readonly Server[]; index: Map<string, string[]> } | null = null;
function indexFor(history: readonly HistoryEntry[], servers: readonly Server[]): Map<string, string[]> {
  if (last && last.history === history && last.servers === servers) return last.index;
  const hosts = new Map(servers.map((s) => [s.id, s.host]));
  const index = historyIndex(history, (e) => { const host = hosts.get(e.serverId); return host ? String(viewUrl(e, host)) : null; });
  last = { history, servers, index };
  return index;
}

// One IntersectionObserver for every preview on the page; each watched element calls its own handler.
const watched = new Map<Element, (visible: boolean) => void>();
let io: IntersectionObserver | null = null;
function watch(el: Element, fn: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') { fn(true); return () => {}; }
  io ??= new IntersectionObserver((entries) => { for (const e of entries) watched.get(e.target)?.(e.isIntersecting); }, { rootMargin: '200px' });
  watched.set(el, fn);
  io.observe(el);
  return () => { watched.delete(el); io?.unobserve(el); };
}

export interface PreviewOrder {
  /** The pictures in the order the setting asks for (curated ones keep their own objects). */
  images: PreviewImage[];
  /** Call on hover-in: loads the popular list ('popular') or reshuffles ('random'). */
  start: () => void;
  /** A callback ref for the picture: 'popular' loads once it scrolls into view. */
  observe: (el: Element | null) => void;
}

export function usePreviewOrder(
  versionId: number | null | undefined,
  curated: readonly PreviewImage[],
  opts: { files?: readonly string[]; active?: boolean } = {},
): PreviewOrder {
  const source = useStore((s) => s.modelPreviewSource);
  const mask = useModels((s) => s.filters.nsfwMask);
  const popular = useSyncExternalStore(subscribePopular, () => (source === 'popular' ? popularFor(versionId) : undefined));
  const history = useStore((s) => (source === 'history' ? s.history : NO_HISTORY));
  const servers = useStore((s) => s.servers);
  const [shuffle, setShuffle] = useState(0);

  const filesKey = (opts.files ?? []).filter(Boolean).map(fileKey).join('\n');
  const historyUrls = useMemo(() => {
    if (source !== 'history' || !filesKey) return NO_URLS;
    const index = indexFor(history, servers);
    const out: string[] = [];
    for (const f of filesKey.split('\n')) for (const u of index.get(f) ?? []) out.push(u);
    return out.length ? out : NO_URLS;
  }, [source, filesKey, history, servers]);

  // Callers build `curated` fresh each render; the pictures' urls are what counts.
  const curatedKey = curated.map((i) => i.url).join('\n');
  const images = useMemo(
    () => orderPreviewImages(curated, { source, popular, history: historyUrls, allow: (img) => !isBeyondMask(img.nsfwLevel, mask) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curatedKey, source, popular, historyUrls, mask, shuffle],
  );

  const active = !!opts.active;
  useEffect(() => { if (active && source === 'popular') requestPopular(versionId); }, [active, source, versionId]);

  const start = useCallback(() => {
    if (source === 'popular') requestPopular(versionId);
    else if (source === 'random') setShuffle((n) => n + 1);
  }, [source, versionId]);

  // The newest version id / source for the observer callback, which outlives renders.
  const latest = useRef({ source, versionId });
  latest.current = { source, versionId };
  const unwatch = useRef<(() => void) | null>(null);
  const visible = useRef(false);
  const observe = useCallback((el: Element | null) => {
    unwatch.current?.();
    unwatch.current = null;
    if (!el) { visible.current = false; return; }
    unwatch.current = watch(el, (on) => {
      visible.current = on;
      const { source: src, versionId: id } = latest.current;
      if (src !== 'popular') return;
      if (on) requestPopular(id); else cancelPopular(id);
    });
  }, []);
  // The observer only reports changes: a picture already on screen when Most popular is picked
  // (or when its version id arrives) is asked for here.
  useEffect(() => { if (source === 'popular' && visible.current) requestPopular(versionId); }, [source, versionId]);

  return { images, start, observe };
}

/** The picture a viewer opened from this preview should start on: a CivitAI one, never a local generation. */
export function viewerStart(images: readonly PreviewImage[], versionId?: number | null): (PreviewImage & { versionId?: number }) | undefined {
  const first = images[0];
  if (!first || first.local) return undefined;
  return versionId != null ? { ...first, versionId } : first;
}
