/**
 * Library — History & Collections, phone (rule 12 + 11; mobile pass, mockup
 * agent-handoffs/fixlist2-mockups/mobile-m-browse.html §1).
 *
 * Portrait (no dock, one centred glass Back pill):
 *   ┌ sticky: [search……][All items ▾][☑] ┐
 *   │         [All|Images|Videos|★] [⇅]  │
 *   │ 3-column grid (scrolls, pan-y)     │   tap = the item sheet; hold = the picture menu
 *   └──────────── ‹ Back ────────────────┘   Select mode: the bulk bar replaces the Back pill
 *
 * Landscape (two panes, the desktop's three columns in two):
 *   ┌ ‹ Back  3 / 48 ······ ⤢ ┬ search · ▣ ▾ · ⇅ · ☑ ──────┐
 *   │  the selected picture   │ [Grid | Item] [All Img Vid ★] │
 *   │  (zoom, ‹ ›, tap = full │ 4-column grid  — or —        │
 *   │   screen)               │ the item's details + actions │
 *   └─────────────────────────┴──────────────────────────────┘
 * The selection, the open item (`detail`) and Select mode live in the store, so a rotation keeps them.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconSquareCheck } from '@tabler/icons-react';
import { BackPill, GlassBar, Tabs } from '~/ui';
import { useRoute } from '~/app/routeStore';
import { usePhoneLandscape } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { LandBack } from '~/screens/browseKit/LandBack';
import { PhoneTwoPane, haptic } from '~/phone';
import { useLibrary } from './libraryStore';
import { useAllItems, useVisibleItems } from './useLibraryItems';
import type { LibItem } from './libraryLogic';
import { SearchBox } from './SearchBox';
import { CollectionPicker } from './CollectionPicker';
import { KindTabs } from './KindTabs';
import { SortMenu } from './SortMenu';
import { MenuPill } from './MenuPill';
import { BulkBar } from './BulkBar';
import { LibraryGrid } from './LibraryGrid';
import { PhoneSheet } from './PhoneSheet';
import { LibraryViewer } from './LibraryViewer';
import { LibraryStage } from './LibraryStage';
import { ItemDetail } from './ItemDetail';
import { EmptyState } from './EmptyState';
import './library.css';

/** On mount (a rotation swaps the layout): bring the selected tile into view in this grid. */
function useRevealSelected(ref: { current: HTMLElement | null }, key: string | null) {
  const first = useRef(true);
  useEffect(() => {
    if (!first.current) return;
    first.current = false;
    if (!key) return;
    ref.current?.querySelector(`[data-lib-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  }, [ref, key]);
}

function SelectToggle() {
  const selecting = useLibrary((s) => s.selecting);
  const setSelecting = useLibrary((s) => s.setSelecting);
  return (
    <MenuPill outline on={selecting} aria-label="Select several" aria-pressed={selecting} onClick={() => setSelecting(!selecting)} style={{ padding: '0 10px', minWidth: 44 }}>
      <IconSquareCheck size={16} stroke={2.2} />
    </MenuPill>
  );
}

export function LibraryPhoneScreen() {
  const land = usePhoneLandscape();
  const all = useAllItems();
  const visible = useVisibleItems(all);
  const select = useLibrary((s) => s.select);
  const [viewer, setViewer] = useState<number | null>(null);
  const viewerEl = viewer !== null && (
    <LibraryViewer phone items={visible} index={Math.min(viewer, visible.length - 1)}
      onIndexChange={(i) => { setViewer(i); const it = visible[i]; if (it) select(it.key); }}
      onClose={() => setViewer(null)} />
  );
  return (
    <>
      {land
        ? <Landscape all={all} visible={visible} viewerOpen={viewer !== null} onViewer={setViewer} />
        : <Portrait all={all} visible={visible} viewerOpen={viewer !== null} onViewer={setViewer} />}
      {viewerEl}
    </>
  );
}

interface LayoutProps { all: LibItem[]; visible: LibItem[]; viewerOpen: boolean; onViewer: (i: number) => void }

function Portrait({ all, visible, viewerOpen, onViewer }: LayoutProps) {
  const go = useRoute((s) => s.go);
  const select = useLibrary((s) => s.select);
  const selectedKey = useLibrary((s) => s.selectedKey);
  const selecting = useLibrary((s) => s.selecting);
  const picked = useLibrary((s) => s.picked);
  const togglePick = useLibrary((s) => s.togglePick);
  const detail = useLibrary((s) => s.detail);
  const setDetail = useLibrary((s) => s.setDetail);
  const scroller = useRef<HTMLDivElement>(null);
  useRevealSelected(scroller, selectedKey);

  const sheetIndex = detail && selectedKey && !selecting ? visible.findIndex((i) => i.key === selectedKey) : -1;
  const sheetItem = sheetIndex >= 0 ? visible[sheetIndex] : null;

  const onClick = useCallback((it: LibItem) => {
    if (useLibrary.getState().selecting) { haptic(); togglePick(it.key); return; }
    select(it.key);
    setDetail(true);
  }, [togglePick, select, setDetail]);
  const onOpen = useCallback((it: LibItem) => {
    const i = visible.findIndex((x) => x.key === it.key);
    if (i >= 0) onViewer(i);
  }, [visible, onViewer]);
  const stepSheet = (dir: 1 | -1) => {
    const next = visible[sheetIndex + dir];
    if (next) select(next.key);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div ref={scroller} className="il-scroll" style={{ flex: 1, minHeight: 0, touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, background: 'var(--il-bg)', borderBottom: '1px solid var(--il-line)',
          padding: `calc(${T.pad.panel}px + env(safe-area-inset-top, 0px)) ${T.pad.panel}px 8px`, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <SearchBox style={{ flex: 1, minWidth: 0 }} />
            <CollectionPicker all={all} compact />
            <SelectToggle />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}><KindTabs fill /></div>
            <SortMenu iconOnly />
          </div>
        </div>
        <div style={{ padding: `8px ${T.pad.panel}px calc(${selecting ? 120 : 84}px + var(--il-safe-bottom))` }}>
          {visible.length
            ? <LibraryGrid items={visible} size="m" fixedColumns={3} gap={6} radius={12} selectedKey={selecting ? null : selectedKey} selecting={selecting} picked={picked} paused={viewerOpen} onClick={onClick} onOpen={onOpen} />
            : <EmptyState total={all.length} />}
        </div>
      </div>

      <PhoneSheet item={sheetItem} index={sheetIndex} count={visible.length} onClose={() => setDetail(false)} onOpen={() => onViewer(sheetIndex)} onStep={stepSheet} />
      {/* Select mode: the bulk actions sit at the bottom, in thumb reach (they were in the top header). */}
      {selecting && !viewerOpen && (
        <GlassBar style={{ left: 10, right: 10, padding: 8 }}><BulkBar visible={visible} phone /></GlassBar>
      )}
      {!sheetItem && !viewerOpen && !selecting && <BackPill onClick={() => go('step')} />}
    </div>
  );
}

function Landscape({ all, visible, viewerOpen, onViewer }: LayoutProps) {
  const go = useRoute((s) => s.go);
  const select = useLibrary((s) => s.select);
  const selectedKey = useLibrary((s) => s.selectedKey);
  const selecting = useLibrary((s) => s.selecting);
  const picked = useLibrary((s) => s.picked);
  const togglePick = useLibrary((s) => s.togglePick);
  const detail = useLibrary((s) => s.detail);
  const setDetail = useLibrary((s) => s.setDetail);
  const gridRef = useRef<HTMLDivElement | null>(null);
  useRevealSelected(gridRef, selectedKey);

  const current = visible.find((i) => i.key === selectedKey) ?? visible[0] ?? null;
  const index = current ? visible.indexOf(current) : -1;
  const pane: 'grid' | 'item' = detail && current && !selecting ? 'item' : 'grid';

  const onClick = useCallback((it: LibItem) => {
    haptic();
    if (useLibrary.getState().selecting) togglePick(it.key);
    else select(it.key);
  }, [togglePick, select]);
  const onOpen = useCallback((it: LibItem) => {
    const i = visible.findIndex((x) => x.key === it.key);
    if (i >= 0) { select(it.key); onViewer(i); }
  }, [visible, select, onViewer]);

  const first = (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
    <LibraryStage items={visible} index={Math.max(0, index)} lead={<LandBack onClick={() => go('step')} />}
      onPick={(i) => { const it = visible[i]; if (it) select(it.key); }}
      onOpen={() => { if (index >= 0) onViewer(index); }} />
    </div>
  );
  const header = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <SearchBox style={{ flex: 1, minWidth: 0 }} />
        <CollectionPicker all={all} compact />
        <SortMenu iconOnly />
        <SelectToggle />
      </div>
      {selecting ? <BulkBar visible={visible} phone /> : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ flex: 'none', width: 140 }}>
            <Tabs<'grid' | 'item'> items={[{ key: 'grid', label: 'Grid' }, { key: 'item', label: 'Item' }]} value={pane} onChange={(k) => { haptic(); setDetail(k === 'item'); }} />
          </div>
          {pane === 'grid' && <div style={{ flex: 1, minWidth: 0 }}><KindTabs fill /></div>}
        </div>
      )}
    </div>
  );
  const side = (
    <div style={{ padding: '0 10px 10px' }}>
      {pane === 'item' && current
        ? <ItemDetail key={current.key} item={current} phone hidePicture onOpen={() => onViewer(index)} onDeleted={() => setDetail(false)} pager={`${index + 1} / ${visible.length}`} />
        : visible.length
          ? <LibraryGrid items={visible} size="m" fixedColumns={4} gap={6} radius={12} selectedKey={selecting ? null : current?.key ?? null} selecting={selecting} picked={picked} paused={viewerOpen} onClick={onClick} onOpen={onOpen} />
          : <EmptyState total={all.length} />}
    </div>
  );
  return <PhoneTwoPane main={first} side={side} sideHeader={header} sideWidth="clamp(320px, 45%, 480px)" sideScrollRef={(el) => { gridRef.current = el; }} />;
}
