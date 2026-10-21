/**
 * Library (rule 12): one grid tile. Picture fills the square (cover); ★ badge top-right when
 * starred, play + duration bottom-left for videos. Hover (pointer devices only): an expand button
 * top-left and the model · time along the bottom. Selected = 3px ember ring inside; in Select
 * mode a round check top-left. Click = select (or pick), double-click / expand = fullscreen.
 * Videos autoplay muted while on screen; the grid's controller (useVideoAutoplay) owns src/play/pause.
 */
import { memo, useState } from 'react';
import { IconArrowsMaximize, IconCheck, IconPlayerPlayFilled, IconStarFilled } from '@tabler/icons-react';
import { durationLabel, prettyModel, whenLabel, type LibItem } from './libraryLogic';
import { useAutoplayVideo } from './useVideoAutoplay';
import { makePayload, nameFromUrl, useImageDrag } from '~/dnd';

export const Tile = memo(function Tile({ item, selected, selecting, picked, radius, onClick, onOpen }: {
  item: LibItem; selected: boolean; selecting: boolean; picked: boolean; radius: number;
  onClick: (it: LibItem) => void; onOpen: (it: LibItem) => void;
}) {
  const [dur, setDur] = useState<number | null>(null);
  const [broken, setBroken] = useState(false);
  const videoRef = useAutoplayVideo(item.url, item.kind === 'video' && !broken);
  const ring = picked || (selected && !selecting);
  // A drag source app-wide (fix list 42): onto a drop zone, a collection, the rail, a tab.
  const drag = useImageDrag(() => (broken ? null : makePayload({ url: item.url, name: item.entry?.filename ?? nameFromUrl(item.url), kind: item.kind, key: item.key, entryId: item.entry?.id, source: 'collection' })));
  const model = item.entry ? prettyModel(item.entry.workflow?.checkpoints?.[0]?.name || item.entry.model || '') : '';

  return (
    <button
      type="button"
      className="lib-tile"
      data-lib-key={item.key}
      aria-label={item.kind === 'video' ? 'Video' : 'Image'}
      aria-pressed={selecting ? picked : selected}
      onClick={() => onClick(item)}
      onDoubleClick={() => onOpen(item)}
      {...drag}
      style={{ borderRadius: radius, outline: ring ? '3px solid var(--il-ember)' : undefined, outlineOffset: -3 }}
    >
      {broken ? (
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--il-dim)', fontSize: 11, fontWeight: 700 }}>Not on the server</span>
      ) : item.kind === 'video' ? (
        <video ref={videoRef} muted loop playsInline preload="none" disablePictureInPicture
          onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setDur(d); }}
          onError={(e) => { if (e.currentTarget.getAttribute('src')) setBroken(true); }} />
      ) : (
        <img src={item.url} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} />
      )}

      {item.liked && (
        <span className="lib-badge" style={{ right: 8, top: 8, width: 22, height: 22, color: 'var(--il-ember-hi)' }}><IconStarFilled size={12} /></span>
      )}
      {item.kind === 'video' && (
        <span className="lib-badge" style={{ left: 8, bottom: 8, height: 22, padding: '0 8px 0 6px', display: 'flex', gap: 4, fontSize: 10, fontWeight: 800 }}>
          <IconPlayerPlayFilled size={10} />{dur != null ? durationLabel(dur) : 'Video'}
        </span>
      )}
      {selecting && (
        <span className="lib-badge" style={{ left: 8, top: 8, width: 22, height: 22, background: picked ? 'var(--il-ember)' : 'color-mix(in srgb, var(--il-bg) 70%, transparent)', color: 'var(--il-bg)', border: picked ? 0 : '2px solid var(--il-fg2)' }}>
          {picked && <IconCheck size={13} stroke={3.4} />}
        </span>
      )}

      {!selecting && (
        <span className="lib-hover" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <span
            role="button"
            aria-label="Fullscreen"
            title="Fullscreen"
            onClick={(e) => { e.stopPropagation(); onOpen(item); }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="lib-badge"
            style={{ left: 8, top: 8, width: 26, height: 26, pointerEvents: 'auto', cursor: 'zoom-in' }}
          >
            <IconArrowsMaximize size={13} stroke={2.4} />
          </span>
          {item.kind === 'image' && (
            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 8px 7px', display: 'flex', justifyContent: 'space-between', gap: 6,
              background: 'linear-gradient(to top, color-mix(in srgb, var(--il-bg-deep) 85%, transparent), color-mix(in srgb, var(--il-bg-deep) 0%, transparent))', fontSize: 10, fontWeight: 700, color: 'var(--il-fg2)', textAlign: 'left',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{model || 'Image'}</span>
              <span style={{ flex: 'none', color: 'var(--il-muted)' }}>{whenLabel(item.createdAt).replace('Today · ', '')}</span>
            </span>
          )}
        </span>
      )}
    </button>
  );
});
