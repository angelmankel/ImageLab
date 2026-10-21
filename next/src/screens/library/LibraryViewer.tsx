/**
 * Library (rule 12): full screen = the app's one full-screen viewer (`~/screens/viewer`, list-2
 * items 18 / 22), paging the visible items; paging moves the selection. On a touch phone a video
 * opens in `@/components/VideoFullscreen` (drag to scrub, rotate).
 */
import { useMemo } from 'react';
import { VideoFullscreen } from '@/components/VideoFullscreen';
import { ImageViewer } from '~/screens/viewer/ImageViewer';
import type { ViewerItem } from '~/screens/viewer/types';
import type { LibItem } from './libraryLogic';

export const libToViewer = (i: LibItem): ViewerItem => ({ key: i.key, url: i.url, kind: i.kind, filename: i.filename, createdAt: i.createdAt, durationMs: i.entry?.durationMs, entry: i.entry ?? null });

export function LibraryViewer({ items, index, onIndexChange, onClose, phone }: {
  items: LibItem[]; index: number; onIndexChange: (i: number) => void; onClose: () => void; phone?: boolean;
}) {
  const list = useMemo(() => items.map(libToViewer), [items]);
  const item = items[index];
  if (!item) return null;
  if (phone && item.kind === 'video') return <VideoFullscreen url={item.url} onClose={onClose} />;
  return <ImageViewer items={list} index={index} onIndexChange={onIndexChange} onClose={onClose} />;
}
