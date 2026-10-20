/**
 * Make an element a drag SOURCE for a picture (fix list 42): spread the result on the <img> /
 * tile. Sets our payload plus text/uri-list and text/plain, so the same drag also lands in another
 * tab, the desktop or a text box. Marks the drag in `dragStore` so every target can light up.
 *
 *   const drag = useImageDrag(() => makePayload({ url, name, source: 'history' }));
 *   <img {...drag} />
 */
import { useCallback, type DragEvent } from 'react';
import { useDrag } from './dragStore';
import { encodePayload, MIME, type ImagePayload } from './payload';

export interface ImageDragProps {
  draggable: true;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
}

/** Write a payload onto a DataTransfer (what `useImageDrag` does; for a drag started by hand). */
export function setDragPayload(dt: DataTransfer, p: ImagePayload): void {
  dt.setData(MIME, encodePayload(p));
  dt.setData('text/uri-list', p.url);
  dt.setData('text/plain', p.url);
  dt.effectAllowed = 'copyLink';
}

export function useImageDrag(payload: ImagePayload | (() => ImagePayload | null) | null, opts: { disabled?: boolean } = {}): ImageDragProps | { draggable: false } {
  const begin = useDrag((s) => s.begin);
  const end = useDrag((s) => s.end);
  const onDragStart = useCallback((e: DragEvent) => {
    const p = typeof payload === 'function' ? payload() : payload;
    if (!p) { e.preventDefault(); return; }
    setDragPayload(e.dataTransfer, p);
    // The picture itself as the ghost when the source is an <img> (the browser does that on its own); a tile with a cover <img> inside: use that image.
    const img = (e.currentTarget as HTMLElement).querySelector?.('img');
    if (img && e.currentTarget !== img) { try { e.dataTransfer.setDragImage(img, img.clientWidth / 2, img.clientHeight / 2); } catch { /* fine */ } }
    begin(p, false);
  }, [payload, begin]);
  const onDragEnd = useCallback(() => end(), [end]);
  if (opts.disabled || !payload) return { draggable: false };
  return { draggable: true, onDragStart, onDragEnd };
}
