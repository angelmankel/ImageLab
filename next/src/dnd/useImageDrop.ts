/**
 * Make an element a drop TARGET for a picture (fix list 42): spread `props` on it, use `over`
 * (the pointer is on it with a picture) and `active` (a picture drag is on anywhere: show the
 * soft "you can drop here" ring) for the look. The drop arrives as a `DropItem` (`payload.ts`):
 * turn it into a Blob / dataUrl with `importImage.ts`.
 *
 *   const drop = useImageDrop({ onDrop: (item) => …, accept: (item) => item.kind === 'file' || … });
 *   <div {...drop.props} style={{ outline: drop.over ? ring : drop.active ? softRing : undefined }} />
 */
import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useDrag } from './dragStore';
import { mayCarryImage, readDrop, type DropItem } from './payload';

export interface ImageDropOptions {
  onDrop: (item: DropItem, e: DragEvent) => void;
  /** Refuse some drops (the pointer then shows "not allowed" and the target does not light). */
  accept?: (item: DropItem) => boolean;
  disabled?: boolean;
}

export interface ImageDropProps {
  onDragEnter: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

export function useImageDrop({ onDrop, accept, disabled }: ImageDropOptions): { props: ImageDropProps; over: boolean; active: boolean } {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const active = useDrag((s) => s.dragging !== null) && !disabled;
  const end = useDrag((s) => s.end);

  const wants = useCallback((e: DragEvent) => !disabled && mayCarryImage(e.dataTransfer?.types), [disabled]);
  const onDragEnter = useCallback((e: DragEvent) => {
    if (!wants(e)) return;
    e.preventDefault(); e.stopPropagation();
    depth.current += 1;
    setOver(true);
  }, [wants]);
  const onDragOver = useCallback((e: DragEvent) => {
    if (!wants(e)) return;
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!over) setOver(true);
  }, [wants, over]);
  const onDragLeave = useCallback((e: DragEvent) => {
    if (!wants(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }, [wants]);
  const onDropCb = useCallback((e: DragEvent) => {
    depth.current = 0; setOver(false);
    if (disabled) return;
    const item = readDrop(e.dataTransfer);
    e.preventDefault(); e.stopPropagation();
    end();
    if (!item || (accept && !accept(item))) return;
    onDrop(item, e);
  }, [disabled, accept, onDrop, end]);

  return { props: { onDragEnter, onDragOver, onDragLeave, onDrop: onDropCb }, over: over && !disabled, active };
}
