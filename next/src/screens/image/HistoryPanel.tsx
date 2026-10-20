/**
 * Rule 8: the right panel is history. A filter row only (All · Images · Videos · ★), no title, no
 * search, no date dividers, one grid. Click = show on the stage, double-click = fullscreen, the ★
 * toggles favourite. Images from the main store's history; videos from the video / workflow run
 * stores. The pure merge + filter is `historyLogic.ts` (tested).
 */
import { useMemo, useState } from 'react';
import { IconHeart, IconHeartFilled } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useStage } from './stageStore';
import { filterTiles, mergeTiles, type HistoryFilter, type Tile } from './historyLogic';

const FILTERS: Array<{ key: HistoryFilter; label: string }> = [{ key: 'all', label: 'All' }, { key: 'images', label: 'Images' }, { key: 'videos', label: 'Videos' }, { key: 'liked', label: '★' }];

function TileView({ tile, selected, onPick, onOpen, onLike }: { tile: Tile<HistoryEntry>; selected: boolean; onPick: () => void; onOpen: () => void; onLike?: () => void }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: 'var(--il-bg-deep)', outline: selected ? '3px solid var(--il-ember)' : undefined, outlineOffset: -3 }}>
      <button type="button" onClick={onPick} onDoubleClick={onOpen} aria-label={tile.filename} aria-pressed={selected} data-viewer-origin={tile.entryId}
        style={{ display: 'block', width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
        {tile.kind === 'video'
          ? <video src={tile.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
          : <img src={tile.url} alt="" loading="lazy" draggable style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onDragStart={(e) => { e.dataTransfer.setData('application/x-imagelab-image', JSON.stringify({ url: tile.url, name: tile.filename })); e.dataTransfer.setData('text/uri-list', tile.url); }} />}
      </button>
      {onLike && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onLike(); }} aria-label={tile.liked ? 'Remove from favourites' : 'Favourite'} aria-pressed={tile.liked}
          style={{ position: 'absolute', right: 6, top: 6, width: 26, height: 26, border: 0, borderRadius: '50%', background: 'rgba(15,15,17,.6)', color: tile.liked ? 'var(--il-ember)' : 'rgba(242,242,244,.8)', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: tile.liked ? 1 : undefined }} className="il-tile-like">
          {tile.liked ? <IconHeartFilled size={13} /> : <IconHeart size={13} stroke={2.4} />}
        </button>
      )}
      {tile.kind === 'video' && <span style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 10, fontWeight: 800, color: 'rgba(242,242,244,.9)', background: 'rgba(15,15,17,.6)', borderRadius: 999, padding: '2px 7px' }}>VIDEO</span>}
    </div>
  );
}

export function HistoryPanel({ columns = 2, phone = false }: { columns?: number; phone?: boolean }) {
  const images = useImageResults();
  const videos = useVideoResults();
  const runs = useWorkflowResults();
  const selected = useStore((s) => s.selectedEntry);
  const newest = useStore((s) => s.history[0] ?? null);
  const select = useStore((s) => s.selectHistoryEntry);
  const openViewer = useStore((s) => s.openViewer);
  const toggleLiked = useStore((s) => s.toggleHistoryLiked);
  const runKey = useStage((s) => s.runKey);
  const showRun = useStage((s) => s.showRun);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const tiles = useMemo(() => filterTiles(mergeTiles(images, videos, runs), filter), [images, videos, runs, filter]);
  const currentKey = runKey ?? (selected ?? newest)?.id ?? null;

  return (
    <aside aria-label="History" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-panel)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 8px', flex: 'none' }}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={on} style={{ height: 30, padding: '0 12px', border: 0, borderRadius: 999, background: on ? 'var(--il-fg)' : 'var(--il-card)', color: on ? 'var(--il-bg)' : 'var(--il-fg2)', fontWeight: on ? 800 : 700, fontSize: 12, cursor: 'pointer' }}>{f.label}</button>;
        })}
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '0 12px 12px', touchAction: 'pan-y' }}>
        {tiles.length === 0 && <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>{filter === 'liked' ? 'No favourites yet.' : 'Nothing here yet.'}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${phone ? 3 : columns}, minmax(0, 1fr))`, gap: 6 }}>
          {tiles.map((t) => (
            <TileView key={t.key} tile={t} selected={t.key === currentKey}
              onPick={() => { if (t.entry) { select(t.entry); showRun(null); } else showRun(t.key); }}
              onOpen={() => { if (t.entry) { select(t.entry); showRun(null); openViewer(); } else showRun(t.key); }}
              onLike={t.entry ? () => toggleLiked(t.entry!.id) : undefined} />
          ))}
        </div>
      </div>
    </aside>
  );
}
