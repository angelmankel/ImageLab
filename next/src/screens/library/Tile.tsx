/**
 * Library (rule 12): one grid tile. Picture fills the square (cover); play + duration bottom-left
 * for videos; 🗑 top-left and ♥ top-right on hover (♥ always when liked; on touch on the selected
 * tile) — the shared `TileActions`, as in the history panel. Hover: the model · time along the
 * bottom. Selected = 3px ember ring inside; in Select mode a round check top-left. Click = select
 * (or pick); a click on the selected tile = fullscreen (`tileClick`).
 * Videos autoplay muted while on screen; the grid's controller (useVideoAutoplay) owns src/play/pause.
 */
import { memo, useState } from 'react';
import { IconCheck, IconPlayerPlayFilled } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { deleteOutput } from '~/app/deleteResult';
import { useIsPhone } from '~/app/useIsPhone';
import { TileActions, tileClick } from '~/ui';
import { durationLabel, prettyModel, whenLabel, type LibItem } from './libraryLogic';
import { useAutoplayVideo } from './useVideoAutoplay';
import { makePayload, nameFromUrl, useImageDrag } from '~/dnd';

export const Tile = memo(function Tile({ item, selected, selecting, picked, radius, onClick, onOpen }: {
  item: LibItem; selected: boolean; selecting: boolean; picked: boolean; radius: number;
  onClick: (it: LibItem) => void; onOpen: (it: LibItem) => void;
}) {
  const [dur, setDur] = useState<number | null>(null);
  const [broken, setBroken] = useState(false);
  const phone = useIsPhone();
  const videoRef = useAutoplayVideo(item.url, item.kind === 'video' && !broken);
  const ring = picked || (selected && !selecting);
  // A drag source app-wide (fix list 42): onto a drop zone, a collection, the rail, a tab.
  const drag = useImageDrag(() => (broken ? null : makePayload({ url: item.url, name: item.entry?.filename ?? nameFromUrl(item.url), kind: item.kind, key: item.key, entryId: item.entry?.id, source: 'collection' })));
  const model = item.entry ? prettyModel(item.entry.workflow?.checkpoints?.[0]?.name || item.entry.model || '') : '';

  // Shared tile behaviour (fix list 2, consistent clicks): a click selects, a click on the selected tile opens the
  // viewer; ♥ / 🗑 as in the history panel (`TileActions`). Select mode: a click picks, no actions.
  const click = selecting ? () => onClick(item) : tileClick(selected, () => onClick(item), () => onOpen(item));
  const entry = item.entry;
  return (
    <div data-tile-selected={selected && !selecting} style={{ position: 'relative' }}>
    <button
      type="button"
      className="lib-tile"
      data-lib-key={item.key}
      aria-label={item.kind === 'video' ? 'Video' : 'Image'}
      aria-pressed={selecting ? picked : selected}
      onClick={click}
      {...drag}
      style={{ borderRadius: radius, cursor: selected && !selecting ? 'zoom-in' : undefined }}
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

      {/* The selected ring as its own inset layer over the picture: never under a positioned child, never clipped. */}
      {ring && <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: radius, boxShadow: 'inset 0 0 0 3px var(--il-ember)', pointerEvents: 'none' }} />}
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
    {!selecting && (
      <TileActions liked={item.liked} phone={phone}
        onLike={entry ? () => useStore.getState().toggleHistoryLiked(entry.id) : undefined}
        onDelete={() => deleteOutput({ entry: entry ?? null, url: item.url })} />
    )}
    </div>
  );
});
