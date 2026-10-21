/**
 * Make an element a drag SOURCE for a picture (fix list 42): spread the result on the <img> /
 * tile. Sets our payload plus text/uri-list and text/plain, so the same drag also lands in another
 * tab, the desktop or a text box. Marks the drag in `dragStore` so every target can light up.
 * The drag shows the app's one small preview card (`dragGhost.ts`), primed when the pointer
 * reaches the source, never the browser's full-size copy of the picture.
 *
 *   const drag = useImageDrag(() => makePayload({ url, name, source: 'history' }));
 *   <img {...drag} />
 */
import { useCallback, type DragEvent } from 'react';
import { useDrag } from './dragStore';
import { encodePayload, MIME, type ImagePayload } from './payload';
import { primeDragGhost, setDragGhost } from './dragGhost';

export interface ImageDragProps {
  draggable: true;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  /** Primes the preview card (capture phase: never collides with a tile's own hover handlers). */
  onPointerOverCapture: () => void;
  onPointerDownCapture: () => void;
}

/** Write a payload onto a DataTransfer (what `useImageDrag` does; for a drag started by hand). */
export function setDragPayload(dt: DataTransfer, p: ImagePayload): void {
  dt.setData(MIME, encodePayload(p));
  dt.setData('text/uri-list', p.url);
  dt.setData('text/plain', p.url);
  dt.effectAllowed = 'copyLink';
}

export function useImageDrag(payload: ImagePayload | (() => ImagePayload | null) | null, opts: { disabled?: boolean; count?: number } = {}): ImageDragProps | { draggable: false } {
  const begin = useDrag((s) => s.begin);
  const end = useDrag((s) => s.end);
  const onDragStart = useCallback((e: DragEvent) => {
    const p = typeof payload === 'function' ? payload() : payload;
    if (!p) { e.preventDefault(); return; }
    setDragPayload(e.dataTransfer, p);
    setDragGhost(e.dataTransfer, p.url, { kind: p.kind, count: opts.count });
    begin(p, false);
  }, [payload, begin, opts.count]);
  const onDragEnd = useCallback(() => end(), [end]);
  const prime = useCallback(() => {
    const p = typeof payload === 'function' ? payload() : payload;
    if (p) primeDragGhost(p.url, p.kind);
  }, [payload]);
  if (opts.disabled || !payload) return { draggable: false };
  return { draggable: true, onDragStart, onDragEnd, onPointerOverCapture: prime, onPointerDownCapture: prime };
}
