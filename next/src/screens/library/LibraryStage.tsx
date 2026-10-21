/**
 * List-2 item 18: the History page's CENTER column — the selected output, big, fit to the space
 * (keeps its aspect). Same canvas behaviour as the stage: wheel / pinch zoom, double-click zooms,
 * a drag pans when zoomed. ←/→ (the page's keys) and the round edge arrows step through the grid
 * in its order. Its own 44px row on top: the counter, the zoom with Fit, and ⤢ (the full-screen
 * viewer). Nothing over the picture but the edge arrows (on hover).
 */
import { useRef, useState, type ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowsMaximize, IconZoomReset } from '@tabler/icons-react';
import { usePanZoom } from '@/hooks/usePanZoom';
import { usePreloadAround } from '@/hooks/usePreload';
import { menuProps } from '~/app/contextMenu';
import { IconBtn } from '~/ui';
import { CHECKER, mayHaveAlpha } from '~/screens/image/checker';
import { NavArrows } from '~/ui/NavArrows';
import type { LibItem } from './libraryLogic';
import { libToViewer } from './LibraryViewer';
import '~/screens/viewer/viewerMenu';

export function LibraryStage({ items, index, onPick, onOpen, lead }: {
  items: readonly LibItem[]; index: number; onPick: (i: number) => void; onOpen: () => void;
  /** Phone landscape: the Back button at the start of the top row. */
  lead?: ReactNode;
}) {
  const item = items[index] as LibItem | undefined;
  const box = useRef<HTMLDivElement>(null);
  const [fitN, setFitN] = useState(0);
  // A click / tap that did not move (< 5 px; not on the arrows, not a pan) opens the full-screen
  // viewer at this picture. A mouse opens at once (the wheel zooms); touch keeps double-tap zoom.
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)', true, { getInitialValueInEffect: false });
  const pz = usePanZoom(box, { resetKey: `${item?.key ?? ''}:${fitN}`, onTap: onOpen, instantTap: fine });
  usePreloadAround(items.map((i) => i.url), index);
  const len = items.length;
  const go = (dir: 1 | -1) => { if (len > 1) onPick((index + dir + len) % len); };
  const isVideo = item?.kind === 'video';
  const zoomed = pz.zoom > 1.01;

  return (
    <section aria-label="Preview" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-bg-deep)' }}>
      <div style={{ height: 44, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
        {lead}
        {len > 0 && <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--il-fg2)', fontVariantNumeric: 'tabular-nums' }}>{index + 1} / {len}</span>}
        <div style={{ flex: 1 }} />
        {zoomed && <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--il-muted)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(pz.zoom * 100)}%</span>}
        {zoomed && <IconBtn icon={<IconZoomReset size={17} stroke={2.2} />} label="Fit" onClick={() => setFitN((n) => n + 1)} size={34} />}
        <IconBtn icon={<IconArrowsMaximize size={17} stroke={2.2} />} label="Full screen" keys="Enter" onClick={onOpen} disabled={!item} size={34} />
      </div>
      <div
        ref={box}
        {...(item && !isVideo ? pz.handlers : {})}
        {...(item ? menuProps('viewer-image', { item: libToViewer(item), onClose: () => undefined }) : {})}
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', userSelect: 'none', cursor: zoomed ? 'grab' : item ? 'zoom-in' : 'default' }}
      >
        {!item ? (
          <span style={{ color: 'var(--il-muted)', fontWeight: 600, fontSize: 13 }}>Nothing here yet.</span>
        ) : isVideo ? (
          <video key={item.key} src={item.url} autoPlay muted loop playsInline controls style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
        ) : (
          <img key={item.key} src={item.url} alt="" draggable={false} decoding="async" onDoubleClick={(e) => e.preventDefault()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', ...(mayHaveAlpha(item.filename) ? CHECKER : {}),
              transform: `translate(${pz.offset.x}px, ${pz.offset.y}px) scale(${pz.zoom})`, transition: pz.reframing ? 'transform 250ms cubic-bezier(.22, 1, .36, 1)' : undefined, willChange: 'transform' }} />
        )}
        {len > 1 && <NavArrows onPrev={() => go(-1)} onNext={() => go(1)} />}
      </div>
    </section>
  );
}
