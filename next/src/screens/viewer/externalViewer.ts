/**
 * List-2 item 31 — the public API to show pictures that are NOT in the history (a model's CivitAI
 * samples) in the same full-screen viewer as the outputs. One layer, mounted once in `app/App.tsx`
 * (`ExternalViewerHost`), above the model viewer modal (T.z.viewer + 10).
 *
 *   import { openExternalViewer } from '~/screens/viewer/externalViewer';
 *   openExternalViewer({
 *     images: samples.map((s) => ({ url: fullUrl(s), meta: s.meta, width: s.width, height: s.height, nsfw: hidden(s) })),
 *     index,
 *     onIndexChange: (i) => setImage(i),   // keep the modal on the same picture
 *     onClose: (i) => setImage(i),         // Esc / ✕: back to the modal at picture i
 *     loadMore: gallery.hasMore ? () => gallery.loadMore() : undefined,
 *   });
 *   // a longer list later (after loadMore): updateExternalViewer({ images, hasMore })
 *
 * While it is open, `isExternalViewerOpen()` / `useExternalViewer((s) => s.open)` is true: a layer
 * under it with its own window key listener (the model viewer's `useViewerKeys`) must stand down.
 */
import { create } from 'zustand';
import type { CivitaiImageMeta } from '@/lib/civitai';
import type { ViewerItem } from './types';
import { useModelViewer } from '~/screens/modelViewer/viewerStore';

export interface ExternalImage {
  url: string;
  /** Stable id (defaults to the url). */
  key?: string;
  kind?: 'image' | 'video';
  /** Shown as the file name (defaults to the url's last path part). */
  name?: string;
  width?: number;
  height?: number;
  meta?: CivitaiImageMeta | null;
  /** Cover it until a tap (the caller applies the NSFW opt-in rules). */
  nsfw?: boolean;
  createdAt?: number;
  link?: string;
}

export interface ExternalViewerOptions {
  images: readonly ExternalImage[];
  index?: number;
  /** A label for where they come from (e.g. the model name). */
  source?: string;
  onIndexChange?: (index: number) => void;
  /** Called with the picture shown when the viewer closes. */
  onClose?: (index: number) => void;
  /** Asked for when the user nears the end of the list; push the longer list with `updateExternalViewer`. */
  loadMore?: () => void | Promise<unknown>;
  hasMore?: boolean;
  /**
   * After Use prompt / Reuse settings / a send-to the viewer closes and calls this so the opener
   * gets out of the way too (the step shows the result). Default: the model viewer closes.
   */
  onLeave?: () => void;
}

interface ExternalViewerState {
  open: boolean;
  items: readonly ViewerItem[];
  index: number;
  opts: ExternalViewerOptions | null;
}

const NONE: readonly ViewerItem[] = Object.freeze([]);

export const useExternalViewer = create<ExternalViewerState>()(() => ({ open: false, items: NONE, index: 0, opts: null }));

const nameOf = (url: string) => {
  try { return decodeURIComponent(new URL(url, 'http://x').pathname.split('/').filter(Boolean).pop() ?? 'image'); } catch { return 'image'; }
};

/** Pure: an external image → the viewer's item. */
export function toViewerItem(img: ExternalImage, source?: string): ViewerItem {
  return {
    key: img.key ?? img.url,
    url: img.url,
    kind: img.kind ?? (/\.(mp4|webm|mov)(\?|$)/i.test(img.url) ? 'video' : 'image'),
    filename: img.name ?? nameOf(img.url),
    createdAt: img.createdAt,
    entry: null,
    external: { meta: img.meta ?? null, width: img.width, height: img.height, nsfw: !!img.nsfw, source, link: img.link },
  };
}

export function openExternalViewer(opts: ExternalViewerOptions): void {
  const items = opts.images.map((i) => toViewerItem(i, opts.source));
  if (!items.length) return;
  const index = Math.min(Math.max(0, opts.index ?? 0), items.length - 1);
  useExternalViewer.setState({ open: true, items, index, opts });
}

/** A new list (e.g. after `loadMore`) or other options; keeps the shown picture. */
export function updateExternalViewer(patch: Partial<ExternalViewerOptions>): void {
  const s = useExternalViewer.getState();
  if (!s.open || !s.opts) return;
  const opts = { ...s.opts, ...patch };
  if (!patch.images) { useExternalViewer.setState({ opts }); return; }
  const items = patch.images.map((i) => toViewerItem(i, opts.source));
  const key = s.items[s.index]?.key;
  const at = items.findIndex((it) => it.key === key);
  useExternalViewer.setState({ opts, items: items.length ? items : NONE, index: at >= 0 ? at : Math.min(s.index, Math.max(0, items.length - 1)) });
}

export function setExternalViewerIndex(index: number): void {
  const s = useExternalViewer.getState();
  if (!s.open || !s.items.length) return;
  const i = Math.min(Math.max(0, index), s.items.length - 1);
  if (i === s.index) return;
  useExternalViewer.setState({ index: i });
  s.opts?.onIndexChange?.(i);
  if (s.opts?.hasMore && s.opts.loadMore && i >= s.items.length - 3) void s.opts.loadMore();
}

export function closeExternalViewer(): void {
  const s = useExternalViewer.getState();
  if (!s.open) return;
  const { opts, index } = s;
  useExternalViewer.setState({ open: false, items: NONE, index: 0, opts: null });
  opts?.onClose?.(index);
}

export const isExternalViewerOpen = (): boolean => useExternalViewer.getState().open;

/** An action took the picture somewhere (a step): close, and let the opener step aside. */
export function leaveExternalViewer(): void {
  const s = useExternalViewer.getState();
  if (!s.open) return;
  const leave = s.opts?.onLeave;
  closeExternalViewer();
  if (leave) leave(); else useModelViewer.getState().close();
}
