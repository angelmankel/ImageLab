/**
 * Rule 8: the right panel is history. A filter row only (This step | All, then the Images · Videos · ★
 * toggles), no title, no search, no date dividers, one grid. This step (the default) shows what the
 * open step made (`inStep`, tags from `resultSteps.ts`). Click = show on the stage, double-click = fullscreen, the ★
 * toggles favourite, the trash (top-left, on hover) deletes with Undo (`~/app/deleteResult`). Images
 * from the main store's history; videos from the video / workflow run stores. The pure merge +
 * filter is `historyLogic.ts` (tested).
 * Collections (FIXLIST 21): a row of collection tiles under the filters (`collections/*`); a picked
 * collection fills the grid with its pictures (any picture: results, imports, model pictures), and
 * a picture dropped on a tile (or on the grid while a collection is shown) moves there.
 */
import { useMemo, useState } from 'react';
import { IconArrowLeft, IconHeart, IconHeartFilled, IconTrash } from '@tabler/icons-react';
import { FullscreenImage } from '@/components/FullscreenImage';
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useStage } from './stageStore';
import { useSteps } from '~/app/stepsStore';
import { deleteOutput } from '~/app/deleteResult';
import { filterTiles, inStep, mergeTiles, type HistoryFilter, type HistoryScope, type Tile } from './historyLogic';
import { useResultSteps } from './resultSteps';
import { makePayload, useImageDrag, useLongPress, openSendTo } from '~/dnd';
import { menuProps } from '~/app/contextMenu';
import { useImageDrop } from '~/dnd';
import { undoNote } from '~/app/undoNote';
import { CollectionsRow } from './collections/CollectionsRow';
import { useCollectionView } from './collections/useCollectionView';
import { addImageToCollection, moveItem, removeFromCollections, setActiveCollection, useCollectionsUi } from './collections/collectionActions';
import './collections/collectionMenus';
import { usePaste } from '~/compose/usePaste';
import { PasteButton, PasteNote } from '~/compose/PasteButton';

const SCOPES: Array<{ key: HistoryScope; label: string; title: string }> = [{ key: 'step', label: 'This step', title: 'Only what the open step made' }, { key: 'all', label: 'All', title: 'Every generation' }];
/** Toggles: tap one to show only that, tap it again for everything (no 'All' chip, Donny 10-20). */
const FILTERS: Array<{ key: HistoryFilter; label: string }> = [{ key: 'images', label: 'Images' }, { key: 'videos', label: 'Videos' }, { key: 'liked', label: '★' }];

const corner: React.CSSProperties = { position: 'absolute', top: 6, width: 26, height: 26, border: 0, borderRadius: '50%', background: 'color-mix(in srgb, var(--il-bg-deep) 60%, transparent)', display: 'grid', placeItems: 'center', cursor: 'pointer' };

function TileView({ tile, selected, onPick, onOpen, onLike, onDelete }: { tile: Tile<HistoryEntry>; selected: boolean; onPick: () => void; onOpen: () => void; onLike?: () => void; onDelete: () => void }) {
  // A tile is a drag source app-wide (fix list 42); a long-press opens the Send-to sheet on a phone.
  const payload = () => makePayload({ url: tile.url, name: tile.filename, kind: tile.kind, key: tile.key, entryId: tile.entryId ?? undefined, source: 'history' });
  const drag = useImageDrag(payload);
  const press = useLongPress(() => openSendTo(payload()));
  return (
    <div {...menuProps('history-image', tile)} style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: 'var(--il-bg-deep)', outline: selected ? '3px solid var(--il-ember)' : undefined, outlineOffset: -3 }}>
      {/* data-no-ctx: on a phone the hold is the Send-to sheet's; right-click still opens the menu. */}
      <button type="button" onClick={onPick} onDoubleClick={onOpen} aria-label={tile.filename} aria-pressed={selected} data-viewer-origin={tile.entryId} data-no-ctx {...press}
        style={{ display: 'block', width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
        {tile.kind === 'video'
          ? <video src={tile.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
          : <img src={tile.url} alt="" loading="lazy" {...drag} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </button>
      {onLike && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onLike(); }} aria-label={tile.liked ? 'Remove from favourites' : 'Favourite'} aria-pressed={tile.liked}
          style={{ ...corner, right: 6, color: tile.liked ? 'var(--il-ember)' : 'color-mix(in srgb, var(--il-fg) 80%, transparent)', opacity: tile.liked ? 1 : undefined }} className="il-tile-like">
          {tile.liked ? <IconHeartFilled size={13} /> : <IconHeart size={13} stroke={2.4} />}
        </button>
      )}
      <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} onDoubleClick={(e) => e.stopPropagation()} aria-label="Delete" title="Delete (Undo in the note)"
        style={{ ...corner, left: 6, color: 'color-mix(in srgb, var(--il-fg) 80%, transparent)' }} className="il-tile-del">
        <IconTrash size={13} stroke={2.4} />
      </button>
      {tile.kind === 'video' && <span style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 10, fontWeight: 800, color: 'color-mix(in srgb, var(--il-fg) 90%, transparent)', background: 'color-mix(in srgb, var(--il-bg-deep) 60%, transparent)', borderRadius: 999, padding: '2px 7px' }}>VIDEO</span>}
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
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const tags = useResultSteps((s) => s.tags);
  const scope = useResultSteps((s) => s.scope);
  const setScope = useResultSteps((s) => s.setScope);
  const all = useMemo(
    () => mergeTiles(images.map((i) => ({ ...i, source: 'image' as const })), videos.map((v) => ({ ...v, source: 'video' as const })), runs.map((r) => ({ ...r, source: 'workflow' as const }))),
    [images, videos, runs],
  );
  const coll = useCollectionView(all);
  const activeCollection = useCollectionsUi((s) => s.active);
  const toggleImportedLiked = useStore((s) => s.toggleImportedLiked);
  const [viewing, setViewing] = useState<number | null>(null);
  const tiles = useMemo(() => {
    if (coll.tiles) return filterTiles(coll.tiles, filter);
    const step = steps.find((s) => s.id === activeId);
    return filterTiles(scope === 'step' && step ? all.filter((t) => inStep(t, step, steps, tags)) : all, filter);
  }, [all, coll.tiles, filter, scope, steps, activeId, tags]);
  // While a collection is shown, the whole grid takes drops into it.
  const gridDrop = useImageDrop({ onDrop: (item) => { if (activeCollection) void addImageToCollection(activeCollection, item); }, disabled: !coll.tiles });
  // …and a paste (item 36): the Paste button in its header, Ctrl+V over the grid.
  const clip = usePaste({ onItem: (item) => { if (activeCollection) void addImageToCollection(activeCollection, item); }, disabled: !coll.tiles });
  /** Out of the collection (an imported picture's "delete"), with Undo. */
  const takeOut = (key: string) => {
    const from = activeCollection;
    removeFromCollections(key);
    if (from) undoNote('Taken out of the collection', () => moveItem(from, key));
  };
  const currentKey = runKey ?? (selected ?? newest)?.id ?? null;

  return (
    <aside aria-label="History" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-panel)' }}>
      <div className="il-scroll-x" data-no-swipe style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 8px', flex: 'none', touchAction: 'pan-x pan-y' }}>
        <div role="group" aria-label="Show" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 999, background: 'var(--il-bg-deep)', flex: 'none' }}>
          {SCOPES.map((sc) => {
            const on = sc.key === scope;
            return <button key={sc.key} type="button" onClick={() => setScope(sc.key)} aria-pressed={on} title={sc.title} style={{ height: 26, padding: '0 10px', border: 0, borderRadius: 999, background: on ? 'var(--il-card-on)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-muted)', fontWeight: 800, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>{sc.label}</button>;
          })}
        </div>
        <span aria-hidden style={{ width: 1, height: 18, background: 'var(--il-line)', flex: 'none' }} />
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return <button key={f.key} type="button" onClick={() => setFilter(on ? 'all' : f.key)} aria-pressed={on} style={{ flex: 'none', height: 30, padding: '0 12px', border: 0, borderRadius: 999, background: on ? 'var(--il-fg)' : 'var(--il-card)', color: on ? 'var(--il-bg)' : 'var(--il-fg2)', fontWeight: on ? 800 : 700, fontSize: 12, cursor: 'pointer' }}>{f.label}</button>;
        })}
      </div>
      <CollectionsRow lookup={coll.lookup} />
      {coll.name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 8px', flex: 'none' }}>
          <button type="button" onClick={() => setActiveCollection(null)} title="Back to the history"
            style={{ height: 30, padding: '0 12px 0 9px', border: 0, borderRadius: 999, background: 'var(--il-card)', color: 'var(--il-fg2)', fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 'none' }}>
            <IconArrowLeft size={14} stroke={2.4} />History
          </button>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{coll.name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', flex: 'none' }}>{coll.tiles?.length ?? 0}</span>
          <PasteButton onPaste={() => void clip.paste()} />
        </div>
      )}
      {coll.name && clip.note && <div style={{ padding: '0 12px 8px', flex: 'none' }}><PasteNote note={clip.note} /></div>}
      <div className="il-scroll" {...gridDrop.props} {...clip.zone} style={{ flex: 1, minHeight: 0, padding: '0 12px 12px', touchAction: 'pan-y', outline: gridDrop.over ? '2px solid var(--il-ember)' : undefined, outlineOffset: -2, borderRadius: 14 }}>
        {tiles.length === 0 && <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>{coll.tiles ? 'Drag or paste pictures here to keep them in this collection.' : filter === 'liked' ? 'No favourites yet.' : scope === 'step' ? 'This step has made nothing yet.' : 'Nothing here yet.'}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${phone ? 3 : columns}, minmax(0, 1fr))`, gap: 6 }}>
          {tiles.map((t, i) => coll.isImported(t.key) ? (
            // An imported picture (Collections): the stage cannot show it, so a click opens the viewer.
            <TileView key={t.key} tile={t} selected={false}
              onPick={() => setViewing(i)} onOpen={() => setViewing(i)}
              onLike={() => toggleImportedLiked(t.key)}
              onDelete={() => takeOut(t.key)} />
          ) : (
            <TileView key={t.key} tile={t} selected={t.key === currentKey}
              onPick={() => { if (t.entry) { select(t.entry); showRun(null); } else showRun(t.key); }}
              onOpen={() => { if (t.entry) { select(t.entry); showRun(null); openViewer(); } else showRun(t.key); }}
              onLike={t.entry ? () => toggleLiked(t.entry!.id) : undefined}
              onDelete={() => deleteOutput(t)} />
          ))}
        </div>
      </div>
      {viewing != null && tiles[viewing] && (
        <FullscreenImage items={tiles.map((t) => ({ key: t.key, url: t.url }))} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(null)} instantClose
          pageCaption={tiles[viewing].filename} />
      )}
    </aside>
  );
}
