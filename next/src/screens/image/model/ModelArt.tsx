/**
 * The selected model's art on its card (fix list item 16: "show off more of the model's art"):
 * the first three previews in "Model preview starts on" order — one big, two stacked; two side
 * by side; one full width — with "+N" on the last when there are more. A tap opens the model
 * viewer on that picture; each picture is a drag source (~/dnd). No pictures: the initials banner.
 */
import { IconArrowsMaximize } from '@tabler/icons-react';
import { makePayload, nameFromUrl, useImageDrag } from '~/dnd';
import { T } from '~/theme/tokens';
import { Thumb } from './Thumb';
import { smallThumb } from './useModelMeta';
import type { ViewerStart } from './viewerBridge';
import '~/screens/models/models.css';

export interface ArtPicture { url: string; start?: ViewerStart }

function Tile({ pic, px, more, label, onOpen, style }: { pic: ArtPicture; px: number; more?: number; label: string; onOpen: (p: ArtPicture) => void; style?: React.CSSProperties }) {
  const drag = useImageDrag(() => (/\.(mp4|webm)(\?|$)/i.test(pic.url) ? null : makePayload({ url: pic.url, name: nameFromUrl(pic.url) || `${label}.png`, source: 'model' })));
  return (
    <button type="button" className="ilm-art" onClick={() => onOpen(pic)} aria-label={`Open ${label} in the model viewer`} {...drag}
      style={{ position: 'relative', padding: 0, border: 0, borderRadius: 10, overflow: 'hidden', background: 'var(--il-bg-deep)', cursor: 'zoom-in', minWidth: 0, minHeight: 0, ...style }}>
      <img src={smallThumb(pic.url, px)} alt="" loading="lazy" decoding="async" draggable={false} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      {more ? (
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(10,10,12,.5)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 13 }}>+{more}</span>
      ) : null}
    </button>
  );
}

export function ModelArt({ pictures, label, height, onOpen, rootRef, onPointerEnter }: {
  pictures: ArtPicture[]; label: string; height: number; onOpen: (p: ArtPicture) => void;
  rootRef?: (el: HTMLElement | null) => void; onPointerEnter?: (e: React.PointerEvent) => void;
}) {
  if (!pictures.length) {
    return (
      <div ref={rootRef} onPointerEnter={onPointerEnter} style={{ height: Math.round(height * 0.6), borderRadius: T.radius.lg, overflow: 'hidden', display: 'flex' }}>
        <Thumb label={label || '?'} images={[]} size={0} style={{ width: '100%', height: '100%', borderRadius: T.radius.lg, fontSize: 28 }} />
      </div>
    );
  }
  const shown = pictures.slice(0, 3);
  const more = pictures.length - shown.length;
  const grid: React.CSSProperties = shown.length === 1
    ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
    : shown.length === 2
      ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }
      : { gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr' };
  return (
    <div ref={rootRef} onPointerEnter={onPointerEnter} style={{ position: 'relative', display: 'grid', gap: 4, height, ...grid }}>
      {shown.map((p, i) => (
        <Tile key={p.url + i} pic={p} label={label} onOpen={onOpen} px={i === 0 ? 260 : 130}
          more={i === shown.length - 1 && more > 0 ? more : undefined}
          style={shown.length === 3 && i === 0 ? { gridRow: '1 / 3', borderRadius: 12 } : undefined} />
      ))}
      <span aria-hidden style={{ position: 'absolute', left: 6, top: 6, width: 24, height: 24, borderRadius: '50%', background: 'color-mix(in srgb, var(--il-bg) var(--il-glass-pct, 72%), transparent)', color: 'var(--il-fg)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
        <IconArrowsMaximize size={12} stroke={2.4} />
      </span>
    </div>
  );
}
