/**
 * Library — History & Collections, phone (rule 12 + 11). No dock: one centred glass Back pill.
 *
 *   ┌ sticky: [search……][All items ▾][☑] ┐
 *   │         [All|Images|Videos|★] [⇅]  │
 *   │ 3-column grid (scrolls, pan-y)     │   tap = the item sheet (bottom Drawer)
 *   └──────────── ‹ Back ────────────────┘   sheet picture = fullscreen
 */
import { useCallback, useState } from 'react';
import { IconSquareCheck } from '@tabler/icons-react';
import { BackPill } from '~/ui';
import { useRoute } from '~/app/routeStore';
import { T } from '~/theme/tokens';
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
import { EmptyState } from './EmptyState';
import './library.css';

export function LibraryPhoneScreen() {
  const go = useRoute((s) => s.go);
  const all = useAllItems();
  const visible = useVisibleItems(all);
  const select = useLibrary((s) => s.select);
  const selectedKey = useLibrary((s) => s.selectedKey);
  const selecting = useLibrary((s) => s.selecting);
  const setSelecting = useLibrary((s) => s.setSelecting);
  const picked = useLibrary((s) => s.picked);
  const togglePick = useLibrary((s) => s.togglePick);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const sheetIndex = sheetKey ? visible.findIndex((i) => i.key === sheetKey) : -1;
  const sheetItem = sheetIndex >= 0 ? visible[sheetIndex] : null;

  const onClick = useCallback((it: LibItem) => {
    if (useLibrary.getState().selecting) { togglePick(it.key); return; }
    select(it.key);
    setSheetKey(it.key);
  }, [togglePick, select]);
  const onOpen = useCallback((it: LibItem) => {
    const i = visible.findIndex((x) => x.key === it.key);
    if (i >= 0) setViewer(i);
  }, [visible]);
  const stepSheet = (dir: 1 | -1) => {
    const next = visible[sheetIndex + dir];
    if (next) { setSheetKey(next.key); select(next.key); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, background: 'var(--il-bg)', borderBottom: '1px solid var(--il-line)',
          padding: `calc(${T.pad.panel}px + env(safe-area-inset-top, 0px)) ${T.pad.panel}px 8px`, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <SearchBox style={{ flex: 1, minWidth: 0 }} />
            <CollectionPicker all={all} compact />
            <MenuPill outline on={selecting} aria-label="Select several" aria-pressed={selecting} onClick={() => setSelecting(!selecting)} style={{ padding: '0 10px' }}>
              <IconSquareCheck size={16} stroke={2.2} />
            </MenuPill>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}><KindTabs fill /></div>
            <SortMenu iconOnly />
          </div>
          {selecting && <BulkBar visible={visible} phone />}
        </div>
        <div style={{ padding: `8px ${T.pad.panel}px calc(84px + var(--il-safe-bottom))` }}>
          {visible.length
            ? <LibraryGrid items={visible} size="m" fixedColumns={3} gap={6} radius={12} selectedKey={selecting ? null : selectedKey} selecting={selecting} picked={picked} paused={viewer !== null} onClick={onClick} onOpen={onOpen} />
            : <EmptyState total={all.length} />}
        </div>
      </div>

      <PhoneSheet item={sheetItem} index={sheetIndex} count={visible.length} onClose={() => setSheetKey(null)} onOpen={() => setViewer(sheetIndex)} onStep={stepSheet} />
      {viewer !== null && (
        <LibraryViewer phone items={visible} index={Math.min(viewer, visible.length - 1)}
          onIndexChange={(i) => { setViewer(i); const it = visible[i]; if (it) { select(it.key); if (sheetKey) setSheetKey(it.key); } }}
          onClose={() => setViewer(null)} />
      )}
      {!sheetItem && viewer === null && <BackPill onClick={() => go('step')} />}
    </div>
  );
}
