/**
 * Library (rule 12): fullscreen. The original ImageLab viewer (`@/components/FullscreenImage`)
 * pages through the visible items (it plays videos too); on a touch phone a video opens in
 * `@/components/VideoFullscreen` instead (drag to scrub, rotate). Paging moves the selection.
 */
import { useMemo } from 'react';
import { FullscreenImage, type FullscreenItem } from '@/components/FullscreenImage';
import { VideoFullscreen } from '@/components/VideoFullscreen';
import type { LibItem } from './libraryLogic';

export function LibraryViewer({ items, index, onIndexChange, onClose, phone }: {
  items: LibItem[]; index: number; onIndexChange: (i: number) => void; onClose: () => void; phone?: boolean;
}) {
  const list = useMemo<FullscreenItem[]>(() => items.map((i) => ({ key: i.key, url: i.url })), [items]);
  const item = items[index];
  if (!item) return null;
  if (phone && item.kind === 'video') return <VideoFullscreen url={item.url} onClose={onClose} />;
  return (
    <FullscreenImage
      items={list}
      index={index}
      onIndexChange={onIndexChange}
      onClose={onClose}
      instantClose
      pageCaption={item.entry?.positive ? undefined : item.filename}
    />
  );
}
