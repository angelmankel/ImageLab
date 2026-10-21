/**
 * Library — History & Collections on the phone, as places in the phone map (mobile pass, Donny
 * 10-21: stacked cards, depth is vertical; mockup agent-handoffs/fixlist2-mockups/mobile-m-browse.html §1).
 *
 *   'library'  (depth 1, from the HUD ring)       'picture' {key} (one card deeper)
 *   ┌ ▬ History ─────────────────────┐            ┌ ▬ Picture ─────────────────────┐
 *   │ [search……][All items ▾][⇅]     │  tap a  →  │ the picture (tap = full screen) │
 *   │ [All|Images|Videos|★]          │  tile      │ when · prompt · settings        │
 *   │ grid (3 cols; wider = more)    │            │ Use prompt · Reuse · Send · ★ ↓ │
 *   └ band: ‹ Home · ◉ · Select ─────┘            └ band: ‹ History · ◉ · Recall ───┘
 *
 * Sideways on the picture card = the previous / next picture of the grid (its siblings); pull it
 * down = back to the grid. Hold a tile = the picture menu (+ Select). Select mode: the bulk bar
 * sits at the bottom of the page. Landscape: the frame puts the grid and the picture card side by
 * side; the grid outlines the open picture, a tap on it = full screen. The visible order is
 * published for the siblings (`visibleKeys`); the filters and Select mode live in the store, so a
 * rotation or going in and out keeps them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconRotateClockwise, IconSquareCheck } from '@tabler/icons-react';
import { phoneNav, usePhoneBand, usePhoneNav, haptic, type PhonePageProps } from '~/phone';
import { usePhoneLandscape } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { useLibrary } from './libraryStore';
import { useAllItems, useVisibleItems } from './useLibraryItems';
import type { LibItem } from './libraryLogic';
import { SearchBox } from './SearchBox';
import { CollectionPicker } from './CollectionPicker';
import { KindTabs } from './KindTabs';
import { SortMenu } from './SortMenu';
import { BulkBar } from './BulkBar';
import { LibraryGrid } from './LibraryGrid';
import { LibraryViewer } from './LibraryViewer';
import { ItemDetail } from './ItemDetail';
import { EmptyState } from './EmptyState';
import { recallItem } from './libraryActions';
import './library.css';

/** The grid's order as the History page shows it: the picture card's siblings (pure reads). */
export const visibleKeys: { keys: readonly string[] } = { keys: [] };

const openPicture = (key: string, from?: string) => {
  haptic();
  useLibrary.getState().select(key);
  phoneNav.push('picture', { key }, { from });
};

const scrollStyle = { position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y' } as const;

export function LibraryPage({ page }: Partial<PhonePageProps>) {
  const all = useAllItems();
  const visible = useVisibleItems(all);
  const selectedKey = useLibrary((s) => s.selectedKey);
  const selecting = useLibrary((s) => s.selecting);
  const setSelecting = useLibrary((s) => s.setSelecting);
  const picked = useLibrary((s) => s.picked);
  const togglePick = useLibrary((s) => s.togglePick);
  const [viewer, setViewer] = useState<number | null>(null);
  // The picture card open on top of this page (landscape shows them side by side: outline it).
  const openKey = usePhoneNav((s) => {
    const i = page ? s.stack.findIndex((p) => p.key === page.key) : -1;
    const next = i >= 0 ? s.stack[i + 1] : undefined;
    return next?.kind === 'picture' ? String(next.params?.key ?? '') : null;
  });
  const land = usePhoneLandscape();

  useEffect(() => { visibleKeys.keys = visible.map((i) => i.key); }, [visible]);

  usePhoneBand({
    right: selecting
      ? { label: 'Done', icon: <IconCheck size={18} stroke={2.6} />, tone: 'primary', onClick: () => setSelecting(false) }
      : { label: 'Select', icon: <IconSquareCheck size={18} stroke={2.2} />, onClick: () => { haptic(); setSelecting(true); } },
  });

  const onClick = useCallback((it: LibItem) => {
    if (useLibrary.getState().selecting) { haptic(); togglePick(it.key); return; }
    openPicture(it.key, page?.key);
  }, [togglePick, page?.key]);
  const onOpen = useCallback((it: LibItem) => {
    const i = visible.findIndex((x) => x.key === it.key);
    if (i >= 0) setViewer(i);
  }, [visible]);

  // Back from a card: the tile it showed stays in view.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedKey || openKey) return;
    scroller.current?.querySelector(`[data-lib-key="${CSS.escape(selectedKey)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
  }, [openKey, selectedKey]);

  return (
    <div ref={scroller} className="il-scroll" style={scrollStyle}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--il-panel)', borderBottom: '1px solid var(--il-line)', padding: `4px ${T.pad.panel}px 8px`, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <SearchBox style={{ flex: 1, minWidth: 0 }} />
          <CollectionPicker all={all} compact />
          <SortMenu iconOnly />
        </div>
        <KindTabs fill />
      </div>
      <div style={{ padding: `8px ${T.pad.panel}px ${selecting ? 0 : 16}px` }}>
        {visible.length
          ? <LibraryGrid items={visible} size={land ? 's' : 'm'} fixedColumns={land ? undefined : 3} gap={6} radius={12}
              selectedKey={selecting ? null : openKey} selecting={selecting} picked={picked} paused={viewer !== null} onClick={onClick} onOpen={onOpen} />
          : <EmptyState total={all.length} />}
      </div>
      {/* Select mode: the bulk actions at the bottom of the page, in thumb reach. */}
      {selecting && (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 2, padding: `8px ${T.pad.panel}px`, background: 'color-mix(in srgb, var(--il-panel) 92%, transparent)', backdropFilter: T.blur, WebkitBackdropFilter: T.blur, borderTop: '1px solid var(--il-line)' }}>
          <BulkBar visible={visible} phone />
        </div>
      )}
      {viewer !== null && (
        <LibraryViewer phone items={visible} index={Math.min(viewer, visible.length - 1)}
          onIndexChange={setViewer} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}

/** Kept for the old name (the map's stand-in, any old import). */
export function LibraryPhoneScreen() { return <LibraryPage />; }

/** One picture of the History page, a card above the grid. */
export function PicturePage({ params }: PhonePageProps<{ key: string }>) {
  const all = useAllItems();
  const visible = useVisibleItems(all);
  const land = usePhoneLandscape();
  const item = useMemo(() => all.find((i) => i.key === params.key) ?? null, [all, params.key]);
  const index = item ? visible.findIndex((i) => i.key === item.key) : -1;
  const [viewer, setViewer] = useState<number | null>(null);
  useEffect(() => { if (item) useLibrary.getState().select(item.key); }, [item]);

  usePhoneBand({
    right: item?.entry
      ? { label: 'Recall', icon: <IconRotateClockwise size={18} stroke={2.4} />, tone: 'primary', onClick: () => { haptic(); recallItem(item); } }
      : null,
  });

  if (!item) {
    return <div style={{ ...scrollStyle, display: 'grid', placeItems: 'center', color: 'var(--il-muted)', fontSize: 13, fontWeight: 600 }}>This picture is gone.</div>;
  }
  const openViewer = () => setViewer(Math.max(0, index));
  const pager = index >= 0 ? `${index + 1} / ${visible.length}` : undefined;
  return (
    <div className="il-scroll" style={{ ...scrollStyle, padding: `0 ${T.pad.panel}px 16px` }}>
      {land ? (
        // Landscape: the picture beside its details (the card is wide and short).
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 1fr)', gap: 12, alignItems: 'start' }}>
          <div style={{ position: 'sticky', top: 0 }}><PictureBox item={item} onOpen={openViewer} /></div>
          <ItemDetail key={item.key} item={item} phone hidePicture onOpen={openViewer} onDeleted={() => phoneNav.pop()} pager={pager} />
        </div>
      ) : (
        <ItemDetail key={item.key} item={item} phone onOpen={openViewer} onDeleted={() => phoneNav.pop()} pager={pager} />
      )}
      {viewer !== null && visible.length > 0 && (
        <LibraryViewer phone items={visible} index={Math.min(viewer, visible.length - 1)}
          onIndexChange={setViewer}
          onClose={() => {
            // The viewer paged elsewhere: this card follows (same depth, no slide).
            const at = visible[viewer];
            setViewer(null);
            if (at && at.key !== item.key) { useLibrary.getState().select(at.key); phoneNav.replace('picture', { key: at.key }); }
          }} />
      )}
    </div>
  );
}

function PictureBox({ item, onOpen }: { item: LibItem; onOpen: () => void }) {
  return (
    <div onClick={onOpen} role="button" aria-label="Open fullscreen"
      style={{ width: '100%', aspectRatio: '1', borderRadius: 14, background: 'var(--il-bg-deep)', overflow: 'hidden', cursor: 'zoom-in' }}>
      {item.kind === 'video'
        ? <video key={item.key} src={item.url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        : <img key={item.key} src={item.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />}
    </div>
  );
}
