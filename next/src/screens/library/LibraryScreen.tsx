/**
 * Library — History & Collections, desktop (rule 12; list-2 item 18: three columns, mockup
 * agent-handoffs/fixlist2-mockups/18-history-3col.html). No title, no date dividers.
 *
 *   ┌ grid (420, resizable) ─┐┌ preview ───────────────────────┐┌ item (380) ──┐
 *   │ search ……………………………… ││ 2 / 48 ············ Fit  ⤢     ││ when · kind   │
 *   │ All items ▾ All Img Vid ★ ││                                ││ prompt …      │
 *   │ Newest ▾ ▪▪▪ Select      ││   the selected output, fit;    ││ settings grid │
 *   │ (Select: bulk bar)       ││   zoom / pan; ‹ › at the edges ││ Recall / Use  │
 *   │ ▢ ▢ ▢ click = select     ││                                ││ ★ ↓ 🗑         │
 *   └──────────────────────────┘└────────────────────────────────┘└───────────────┘
 * ←/→ move the selection (the grid's order), Enter / ⤢ / double-click = the full-screen viewer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useScrollIntoView } from '~/ui/scrollIntoNearest';
import { IconFileZip, IconSquareCheck } from '@tabler/icons-react';
import { Panel } from '~/ui';
import { T } from '~/theme/tokens';
import { GRID_W, useLibrary } from './libraryStore';
import { useAllItems, useVisibleItems } from './useLibraryItems';
import { COLS, fitColumns, type LibItem } from './libraryLogic';
import { confirmDelete } from './libraryActions';
import { SearchBox } from './SearchBox';
import { CollectionPicker } from './CollectionPicker';
import { KindTabs } from './KindTabs';
import { SortMenu } from './SortMenu';
import { TileSizeSwitch } from './TileSizeSwitch';
import { zipItems } from './zip';
import { MenuPill } from './MenuPill';
import { BulkBar } from './BulkBar';
import { LibraryGrid } from './LibraryGrid';
import { ItemDetail } from './ItemDetail';
import { LibraryViewer } from './LibraryViewer';
import { LibraryStage } from './LibraryStage';
import { EmptyState } from './EmptyState';
import './library.css';

export function LibraryScreen() {
  const all = useAllItems();
  const visible = useVisibleItems(all);
  const selectedKey = useLibrary((s) => s.selectedKey);
  const select = useLibrary((s) => s.select);
  const selecting = useLibrary((s) => s.selecting);
  const setSelecting = useLibrary((s) => s.setSelecting);
  const picked = useLibrary((s) => s.picked);
  const togglePick = useLibrary((s) => s.togglePick);
  const tileSize = useLibrary((s) => s.tileSize);
  const panelOpen = useLibrary((s) => s.panelOpen);
  const setPanelOpen = useLibrary((s) => s.setPanelOpen);
  const panelWidth = useLibrary((s) => s.panelWidth);
  const setPanelWidth = useLibrary((s) => s.setPanelWidth);
  const gridOpen = useLibrary((s) => s.gridOpen);
  const setGridOpen = useLibrary((s) => s.setGridOpen);
  const gridWidth = useLibrary((s) => s.gridWidth);
  const setGridWidth = useLibrary((s) => s.setGridWidth);
  const [viewer, setViewer] = useState<number | null>(null);

  // The panel shows the picked item, else the first one, so it is never blank while items exist.
  const current = visible.find((i) => i.key === selectedKey) ?? visible[0] ?? null;
  const currentIndex = current ? visible.indexOf(current) : -1;
  // ← / → move the selection: keep its tile in view, scrolling the grid only (item 39).
  const gridRef = useRef<HTMLDivElement>(null);
  useScrollIntoView(gridRef, current?.key, { selector: '[data-lib-key][aria-pressed="true"]', axis: 'y' });

  // The three columns always fit the row: the side columns give way (never under their
  // minimum) so the preview keeps room and nothing runs past the window (any UI scale).
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowW, setRowW] = useState(0);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setRowW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tabs = (gridOpen ? 0 : T.size.collapsedTab) + (panelOpen ? 0 : T.size.collapsedTab) + 2;
  const fitted = fitColumns(rowW - tabs, gridOpen ? gridWidth : 0, panelOpen ? panelWidth : 0);
  const gridW = gridOpen ? fitted.grid : gridWidth;
  const panelW = panelOpen ? fitted.panel : panelWidth;

  // A narrow grid column: the sort pill and Select drop their words.
  const narrow = gridW < 480;

  const onClick = useCallback((it: LibItem) => {
    if (useLibrary.getState().selecting) togglePick(it.key);
    else select(it.key);
  }, [togglePick, select]);
  const onOpen = useCallback((it: LibItem) => {
    const i = visible.findIndex((x) => x.key === it.key);
    if (i < 0) return;
    select(it.key);
    setViewer(i);
  }, [visible, select]);

  // The selected tile stays in view as ←/→ or the preview's arrows move it (no scroll animation).
  const currentKey = current?.key;
  useEffect(() => {
    if (!currentKey) return;
    document.querySelector(`[data-lib-key="${CSS.escape(currentKey)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
  }, [currentKey]);

  // Keys (grid only, never while typing or with the viewer or a dialog open): ← → move, Enter opens,
  // Delete deletes, Esc leaves Select mode.
  useEffect(() => {
    if (viewer !== null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && selecting) { setSelecting(false); return; }
      if (!current) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const next = visible[currentIndex + (e.key === 'ArrowRight' ? 1 : -1)];
        if (next) { e.preventDefault(); select(next.key); }
      } else if (e.key === 'Enter' && !selecting && t?.tagName !== 'BUTTON') {
        e.preventDefault(); setViewer(currentIndex);
      } else if (e.key === 'Delete' && !selecting) {
        e.preventDefault(); confirmDelete([current]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, selecting, setSelecting, current, currentIndex, visible, select]);

  return (
    <div ref={rowRef} style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
      <Panel side="left" width={gridW} min={COLS.gridMin} max={900} defaultWidth={GRID_W} open={gridOpen} onToggle={() => setGridOpen(!gridOpen)} onResize={setGridWidth} tabLabel="Grid">
        <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: 10 }}>
          <SearchBox style={{ flex: '1 1 100%', minWidth: 0 }} />
          <CollectionPicker all={all} />
          <div style={{ flex: 'none' }}><KindTabs /></div>
          <div style={{ flex: 1 }} />
          <SortMenu iconOnly={narrow} />
          <TileSizeSwitch />
          <MenuPill outline onClick={() => void zipItems(all)} disabled={!all.length} title={`Download all ${all.length} as a zip`} style={{ gap: 6, padding: narrow ? '0 11px' : undefined }}>
            <IconFileZip size={15} stroke={2.2} />{!narrow && 'Zip all'}
          </MenuPill>
          <MenuPill outline on={selecting} onClick={() => setSelecting(!selecting)} aria-pressed={selecting} title="Select several" style={{ gap: 6, padding: narrow ? '0 11px' : undefined }}>
            <IconSquareCheck size={15} stroke={2.2} />{!narrow && 'Select'}
          </MenuPill>
        </div>
        {selecting && (
          <div style={{ flex: 'none', padding: '0 10px 8px' }}><BulkBar visible={visible} /></div>
        )}
        <div ref={gridRef} className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '0 10px 10px', touchAction: 'pan-y' }}>
          {visible.length
            ? <LibraryGrid items={visible} size={tileSize} selectedKey={current?.key ?? null} selecting={selecting} picked={picked} paused={viewer !== null} onClick={onClick} onOpen={onOpen} />
            : <EmptyState total={all.length} />}
        </div>
      </Panel>

      <LibraryStage items={visible} index={Math.max(0, currentIndex)} onPick={(i) => { const it = visible[i]; if (it) select(it.key); }} onOpen={() => { if (currentIndex >= 0) setViewer(currentIndex); }} />

      <Panel side="right" width={panelW} min={COLS.panelMin} max={560} open={panelOpen} onToggle={() => setPanelOpen(!panelOpen)} onResize={setPanelWidth} tabLabel="Item">
        <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: T.pad.panel, touchAction: 'pan-y' }}>
          {current
            ? <ItemDetail item={current} hidePicture onOpen={() => setViewer(currentIndex)} pager={`${currentIndex + 1} / ${visible.length}`} />
            : <div style={{ padding: '48px 8px', textAlign: 'center', color: 'var(--il-muted)', fontSize: 12, fontWeight: 600 }}>Pick something in the grid.</div>}
        </div>
      </Panel>

      {viewer !== null && (
        <LibraryViewer items={visible} index={Math.min(viewer, visible.length - 1)}
          onIndexChange={(i) => { setViewer(i); const it = visible[i]; if (it) select(it.key); }}
          onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
