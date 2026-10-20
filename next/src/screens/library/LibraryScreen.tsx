/**
 * Library — History & Collections, desktop (rule 12). No left panel, no title, no date dividers.
 *
 *   ┌ search · All items ▾ │ All Images Videos ★ ······ Newest ▾ │ ▪▪▪ │ Select ┐┌ item (380) ┐
 *   ├ (Select mode) 3 selected · All · None ····· Add to collection ▾ ★ ↓ 🗑 Done ┤│ picture     │
 *   │ 5-column grid (3 when narrow) · click = select · double-click/⤢ = fullscreen ││ prompt …    │
 *   └────────────────────────────────────────────────────────────────────────────┘└ actions ─────┘
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconSquareCheck } from '@tabler/icons-react';
import { Panel, Sep } from '~/ui';
import { T } from '~/theme/tokens';
import { useLibrary } from './libraryStore';
import { useAllItems, useVisibleItems } from './useLibraryItems';
import type { LibItem } from './libraryLogic';
import { confirmDelete } from './libraryActions';
import { SearchBox } from './SearchBox';
import { CollectionPicker } from './CollectionPicker';
import { KindTabs } from './KindTabs';
import { SortMenu } from './SortMenu';
import { TileSizeSwitch } from './TileSizeSwitch';
import { MenuPill } from './MenuPill';
import { BulkBar } from './BulkBar';
import { LibraryGrid } from './LibraryGrid';
import { ItemDetail } from './ItemDetail';
import { LibraryViewer } from './LibraryViewer';
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
  const [viewer, setViewer] = useState<number | null>(null);

  // The panel shows the picked item, else the first one, so it is never blank while items exist.
  const current = visible.find((i) => i.key === selectedKey) ?? visible[0] ?? null;
  const currentIndex = current ? visible.indexOf(current) : -1;

  // Narrow main column: the sort pill and Select drop their words.
  const mainRef = useRef<HTMLElement>(null);
  const [mainW, setMainW] = useState(1200);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setMainW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = mainW < 900;

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
    <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
      <main ref={mainRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: T.size.toolbar, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
          <SearchBox style={{ flex: '0 1 220px', minWidth: 120 }} />
          <CollectionPicker all={all} />
          <Sep />
          <div style={{ flex: 'none' }}><KindTabs /></div>
          <div style={{ flex: 1 }} />
          <SortMenu iconOnly={narrow} />
          <Sep />
          <TileSizeSwitch />
          <Sep />
          <MenuPill outline on={selecting} onClick={() => setSelecting(!selecting)} aria-pressed={selecting} title="Select several" style={{ gap: 6, padding: narrow ? '0 11px' : undefined }}>
            <IconSquareCheck size={15} stroke={2.2} />{!narrow && 'Select'}
          </MenuPill>
        </div>
        {selecting && (
          <div style={{ flex: 'none', padding: '0 10px 8px' }}><BulkBar visible={visible} /></div>
        )}
        <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '4px 10px 10px', touchAction: 'pan-y' }}>
          {visible.length
            ? <LibraryGrid items={visible} size={tileSize} selectedKey={current?.key ?? null} selecting={selecting} picked={picked} onClick={onClick} onOpen={onOpen} />
            : <EmptyState total={all.length} />}
        </div>
      </main>

      <Panel side="right" width={panelWidth} min={320} max={560} open={panelOpen} onToggle={() => setPanelOpen(!panelOpen)} onResize={setPanelWidth} tabLabel="Item">
        <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: T.pad.panel, touchAction: 'pan-y' }}>
          {current
            ? <ItemDetail item={current} onOpen={() => setViewer(currentIndex)} pager={`${currentIndex + 1} / ${visible.length}`} />
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
