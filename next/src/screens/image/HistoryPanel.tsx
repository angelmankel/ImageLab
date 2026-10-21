/**
 * Rule 8: the right panel is history. A filter row only (This step | All, then the Images · Videos · ★
 * segmented control — tap the lit one again for every kind — and ⋯ = Clear history / Reset session; the row wraps when narrow), no title, no search, no date dividers, one grid. This step (the default) shows what the
 * open step made (`inStep`, tags from `resultSteps.ts`). Click = show on the stage, a click on the shown one = fullscreen, the ♥
 * toggles favourite, the trash (top-left, on hover) deletes with Ctrl+Z (`TileActions`, shared by every grid) (`~/app/deleteResult`). Images
 * from the main store's history; videos from the video / workflow run stores. The pure merge +
 * filter is `historyLogic.ts` (tested).
 * Collections (FIXLIST 21): a row of collection tiles under the filters (`collections/*`); a picked
 * collection fills the grid with its pictures (any picture: results, imports, model pictures), and
 * a picture dropped on a tile (or on the grid while a collection is shown) moves there.
 */
import { useMemo, useRef, useState } from 'react';
import { LoadingImage, TileActions, tileClick, useScrollIntoView, VideoThumb } from '~/ui';
import { IconArrowLeft, IconDots, IconEraser, IconRestore } from '@tabler/icons-react';
import { ImageViewer } from '~/screens/viewer/ImageViewer';
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useStage } from './stageStore';
import { useSteps } from '~/app/stepsStore';
import { useSessions } from '~/app/sessionsStore';
import { ownedBy, useOwnerCtx } from '~/app/outputs';
import { deleteOutput } from '~/app/deleteResult';
import { filterTiles, inStep, mergeTiles, type HistoryFilter, type HistoryScope, type Tile } from './historyLogic';
import { useResultSteps } from './resultSteps';
import { makePayload, useImageDrag, useLongPress, openSendTo } from '~/dnd';
import { menuProps, openMenu, registerMenu } from '~/app/contextMenu';
import { confirmClearHistory, confirmResetSession } from '~/app/sessionActions';
import { useImageDrop } from '~/dnd';
import { pushUndo } from '~/app/undo';
import { CollectionsRow } from './collections/CollectionsRow';
import { useCollectionView } from './collections/useCollectionView';
import { addImageToCollection, moveItem, removeFromCollections, setActiveCollection, useCollectionsUi } from './collections/collectionActions';
import './collections/collectionMenus';
import { usePaste } from '~/compose/usePaste';
import { PasteButton, PasteNote } from '~/compose/PasteButton';

const SCOPES: Array<{ key: HistoryScope; label: string; title: string }> = [{ key: 'step', label: 'This step', title: 'This step only' }, { key: 'all', label: 'All', title: 'Whole session' }];
/** Toggles: tap one to show only that, tap it again for everything (no 'All' chip, Donny 10-20). */
const FILTERS: Array<{ key: HistoryFilter; label: string; title: string }> = [{ key: 'images', label: 'Images', title: 'Only images' }, { key: 'videos', label: 'Videos', title: 'Only videos' }, { key: 'liked', label: '★', title: 'Only favourites' }];

// The bar's ⋯ (fix list 2, item 9: "an easy Clear all history"): the open session's history actions.
registerMenu<string>('history-bar', [
  { id: 'clear', label: 'Clear history…', icon: IconEraser, group: 'session', action: (id) => confirmClearHistory(id) },
  { id: 'reset', label: 'Reset session…', icon: IconRestore, group: 'session', action: (id) => confirmResetSession(id) },
]);

/** One segmented control (This step | All, Images | Videos | ★): segments share one pill; 40px tall on a phone. */
function Segmented({ label, items, phone }: { label: string; phone: boolean; items: Array<{ key: string; label: string; title: string; on: boolean; onClick: () => void }> }) {
  const h = phone ? 36 : 26;
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 999, background: 'var(--il-bg-deep)', flex: 'none' }}>
      {items.map((it) => (
        <button key={it.key} type="button" onClick={it.onClick} aria-pressed={it.on} title={it.title}
          style={{ height: h, minWidth: phone ? 40 : undefined, padding: '0 10px', border: 0, borderRadius: 999, background: it.on ? 'var(--il-card-on)' : 'transparent', color: it.on ? 'var(--il-fg)' : 'var(--il-muted)', fontWeight: 800, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

function TileView({ tile, selected, phone, onPick, onOpen, onLike, onDelete }: { tile: Tile<HistoryEntry>; selected: boolean; phone: boolean; onPick: () => void; onOpen: () => void; onLike?: () => void; onDelete: () => void }) {
  // A tile is a drag source app-wide (fix list 42); a long-press opens the Send-to sheet on a phone.
  const payload = () => makePayload({ url: tile.url, name: tile.filename, kind: tile.kind, key: tile.key, entryId: tile.entryId ?? undefined, source: 'history' });
  const drag = useImageDrag(payload);
  const press = useLongPress(() => openSendTo(payload()));
  return (
    <div {...menuProps('history-image', tile)} data-tile-selected={selected} style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: 'var(--il-bg-deep)' }}>
      {/* data-no-ctx: on a phone the hold is the Send-to sheet's; right-click still opens the menu.
          Click = select; a click on the selected tile = the full-screen viewer (`tileClick`, shared by every grid). */}
      <button type="button" onClick={tileClick(selected, onPick, onOpen)} aria-label={tile.filename} aria-pressed={selected} data-viewer-origin={tile.entryId} data-no-ctx {...press}
        style={{ display: 'block', width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent', cursor: selected ? 'zoom-in' : 'pointer' }}>
        {tile.kind === 'video'
          ? <VideoThumb src={tile.url} style={{ width: '100%', height: '100%' }} />
          : <LoadingImage src={tile.url} alt="" {...drag} style={{ width: '100%', height: '100%' }} />}
      </button>
      {/* The selected ring: its own layer over the picture (an outline on the tile was painted under the
          positioned LoadingImage, so it vanished), inset so no scroller clips it. */}
      {selected && <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 14, boxShadow: 'inset 0 0 0 3px var(--il-ember)', pointerEvents: 'none' }} />}
      <TileActions liked={tile.liked} onLike={onLike} onDelete={onDelete} phone={phone} />
      {tile.kind === 'video' && <span style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 10, fontWeight: 800, color: 'color-mix(in srgb, var(--il-fg) 90%, transparent)', background: 'color-mix(in srgb, var(--il-bg-deep) 60%, transparent)', borderRadius: 999, padding: '2px 7px' }}>VIDEO</span>}
    </div>
  );
}

export function HistoryPanel({ columns = 2, phone = false, onPicked }: {
  columns?: number; phone?: boolean;
  /** After a tap showed a result (the phone's history sheet closes so the Output page shows it). */
  onPicked?: () => void;
}) {
  const images = useImageResults();
  const videos = useVideoResults();
  const runs = useWorkflowResults();
  const selected = useStore((s) => s.selectedEntry);
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
  // Fix list 2, item 9: the history is THIS session's outputs (All) or this step's (This step); collections keep every picture.
  const ownerCtx = useOwnerCtx();
  const sessionId = useSessions((s) => s.currentId);
  const mine = useMemo(() => ownedBy(all, sessionId, ownerCtx), [all, sessionId, ownerCtx]);
  const coll = useCollectionView(all);
  const activeCollection = useCollectionsUi((s) => s.active);
  const toggleImportedLiked = useStore((s) => s.toggleImportedLiked);
  const [viewing, setViewing] = useState<number | null>(null);
  const tiles = useMemo(() => {
    if (coll.tiles) return filterTiles(coll.tiles, filter);
    const step = steps.find((s) => s.id === activeId);
    return filterTiles(scope === 'step' && step ? mine.filter((t) => inStep(t, step, steps, tags)) : mine, filter);
  }, [mine, coll.tiles, filter, scope, steps, activeId, tags]);
  // While a collection is shown, the whole grid takes drops into it.
  const gridDrop = useImageDrop({ onDrop: (item) => { if (activeCollection) void addImageToCollection(activeCollection, item); }, disabled: !coll.tiles });
  // …and a paste (item 36): the Paste button in its header, Ctrl+V over the grid.
  const clip = usePaste({ onItem: (item) => { if (activeCollection) void addImageToCollection(activeCollection, item); }, disabled: !coll.tiles });
  /** Out of the collection (an imported picture's "delete"), with Undo. */
  const takeOut = (key: string) => {
    const from = activeCollection;
    removeFromCollections(key);
    if (from) pushUndo({ label: 'Remove from collection', undo: () => moveItem(from, key), redo: () => removeFromCollections(key) });
  };
  // What the stage shows: the pick when it is this session's, else the session's newest picture (as `useStageMedia`).
  const currentKey = runKey ?? (selected && mine.some((t) => t.key === selected.id) ? selected.id : mine.find((t) => t.entry)?.key ?? null);
  // ← / → on the stage move the selection: keep its tile in view, scrolling this grid only (item 39).
  const gridRef = useRef<HTMLDivElement>(null);
  useScrollIntoView(gridRef, currentKey, { selector: 'button[aria-pressed="true"][data-viewer-origin]', axis: 'y' });

  return (
    <aside aria-label="History" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-panel)' }}>
      {/* Item 3: the bar wraps to a second row when the panel is narrow (never clipped); kind = one segmented control. */}
      <div data-no-swipe role="toolbar" aria-label="History filters" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '10px 12px 8px', flex: 'none' }}>
        <Segmented label="Show" phone={phone} items={SCOPES.map((sc) => ({ key: sc.key, label: sc.label, title: sc.title, on: sc.key === scope, onClick: () => setScope(sc.key) }))} />
        <Segmented label="Kind" phone={phone} items={FILTERS.map((f) => ({ key: f.key, label: f.label, title: f.title, on: f.key === filter, onClick: () => setFilter(f.key === filter ? 'all' : f.key) }))} />
        <button type="button" aria-label="History options" title="History options"
          onClick={(e) => openMenu('history-bar', sessionId, e.currentTarget)}
          style={{ marginLeft: 'auto', width: phone ? 40 : 30, height: phone ? 40 : 30, border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
          <IconDots size={16} stroke={2.4} />
        </button>
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
      <div ref={gridRef} className="il-scroll" {...gridDrop.props} {...clip.zone} style={{ flex: 1, minHeight: 0, padding: '0 12px 12px', touchAction: 'pan-y', outline: gridDrop.over ? '2px solid var(--il-ember)' : undefined, outlineOffset: -2, borderRadius: 14 }}>
        {tiles.length === 0 && <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>{coll.tiles ? 'Drag or paste pictures here to keep them in this collection.' : filter === 'liked' ? 'No favourites yet.' : scope === 'step' ? 'This step has made nothing yet.' : 'Nothing here yet.'}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${phone ? 3 : columns}, minmax(0, 1fr))`, gap: 6 }}>
          {tiles.map((t, i) => coll.isImported(t.key) ? (
            // An imported picture (Collections): the stage cannot show it, so a click opens the viewer.
            <TileView key={t.key} tile={t} selected={false} phone={phone}
              onPick={() => setViewing(i)} onOpen={() => setViewing(i)}
              onLike={() => toggleImportedLiked(t.key)}
              onDelete={() => takeOut(t.key)} />
          ) : (
            <TileView key={t.key} tile={t} selected={t.key === currentKey} phone={phone}
              onPick={() => { if (t.entry) { select(t.entry); showRun(null); } else showRun(t.key); onPicked?.(); }}
              onOpen={() => { if (t.entry) { select(t.entry); showRun(null); openViewer(); } else { showRun(t.key); setViewing(i); } }}
              onLike={t.entry ? () => toggleLiked(t.entry!.id) : undefined}
              onDelete={() => deleteOutput(t)} />
          ))}
        </div>
      </div>
      {viewing != null && tiles[viewing] && (
        <ImageViewer items={tiles} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(null)} />
      )}
    </aside>
  );
}
