/**
 * Library (rule 12): the one grid. No date dividers, no title. Columns follow the tile size and
 * the width (medium: 5, down to 3 when narrow; `fixedColumns` pins it, e.g. 3 on the phone).
 * The parent scrolls; this lays tiles out and runs the one video-autoplay controller for them
 * (`paused` stops every clip, e.g. while the fullscreen viewer covers the grid).
 */
import { useEffect, useRef, useState } from 'react';
import { gridColumns, type LibItem, type TileSize } from './libraryLogic';
import { Tile } from './Tile';
import { AutoplayContext, useGridAutoplay } from './useVideoAutoplay';

export function LibraryGrid({ items, size, fixedColumns, gap = 8, radius = 14, selectedKey, selecting, picked, paused = false, onClick, onOpen }: {
  items: LibItem[]; size: TileSize; fixedColumns?: number; gap?: number; radius?: number; paused?: boolean;
  selectedKey: string | null; selecting: boolean; picked: readonly string[];
  onClick: (it: LibItem) => void; onOpen: (it: LibItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const autoplay = useGridAutoplay(ref, paused);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || fixedColumns) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedColumns]);
  const cols = fixedColumns ?? gridColumns(width, size, gap);
  const pickedSet = new Set(picked);

  return (
    <AutoplayContext.Provider value={autoplay}>
      <div ref={ref} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
        {items.map((it) => (
          <Tile key={it.key} item={it} radius={radius} selected={it.key === selectedKey} selecting={selecting} picked={pickedSet.has(it.key)} onClick={onClick} onOpen={onOpen} />
        ))}
      </div>
    </AutoplayContext.Provider>
  );
}
