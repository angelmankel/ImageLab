/**
 * Item 30: the full-screen viewer, redesigned from the ground up (mockup:
 * agent-handoffs/fixlist-mockups/30-viewer.html). Nothing is drawn over the picture:
 *   desktop  top bar (56) / [thumbnail rail 92 | picture between its prev / next gutters | panel 380]
 *   phone    top bar / the picture (swipe pages with motion, pull down closes) / a sheet with the
 *            Send chips and the Details cards, scrolling.
 * The panel has two tabs: Send (quick actions) and Details (rich metadata). Open, close and every
 * seek but a finger's swipe are instant (item 3); only the slideshow animates (its transition and
 * speed live in the top bar). A tap on the picture toggles focus (chrome hidden).
 * Keys: Esc close (focus first) · ←/→ previous / next (wrap) · S slideshow · I panel · F favourite
 * · Del delete. The controller drives it through `registerViewer`.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { registerViewer } from '@/components/viewerTransition';
import { useIsPhone } from '~/app/useIsPhone';
import { menuProps } from '~/app/contextMenu';
import { deleteOutput } from '~/app/deleteResult';
import { makePayload, useImageDrag } from '~/dnd';
import { IconBtn } from '~/ui';
import { T } from '~/theme/tokens';
import { PagerPicture, ShowPicture } from './ViewerPicture';
import { ViewerTopBar } from './ViewerTopBar';
import { ViewerStrip } from './ViewerStrip';
import { SendPanel } from './SendPanel';
import { DetailsPanel } from './DetailsPanel';
import { useViewerStore, type ViewerTab } from './viewerStore';
import type { ViewerItem } from './types';
import './viewerMenu';
import './resultMeta';

export type { ViewerItem } from './types';

function Tabs({ tab, setTab }: { tab: ViewerTab; setTab: (t: ViewerTab) => void }) {
  const one = (id: ViewerTab, label: string) => (
    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      style={{ height: 40, padding: '0 14px', border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: 12, color: tab === id ? 'var(--il-fg)' : 'var(--il-muted)', boxShadow: tab === id ? 'inset 0 -2px 0 var(--il-ember)' : undefined }}>
      {label}
    </button>
  );
  return <div role="tablist" style={{ display: 'flex', gap: 2, padding: '0 10px', borderBottom: '1px solid var(--il-line)', flex: 'none' }}>{one('send', 'Send')}{one('details', 'Details')}</div>;
}

export function ImageViewer({ items, index, onIndexChange, onClose, liveUrl = null }: {
  items: readonly ViewerItem[]; index: number; onIndexChange: (i: number) => void; onClose: () => void; liveUrl?: string | null;
}) {
  const phone = useIsPhone();
  const panel = useViewerStore((s) => s.panel);
  const setPanel = useViewerStore((s) => s.setPanel);
  const tab = useViewerStore((s) => s.tab);
  const setTab = useViewerStore((s) => s.setTab);
  const transition = useViewerStore((s) => s.transition);
  const speedMs = useViewerStore((s) => s.speedMs);
  const playing = useStore((s) => s.slideshowPlaying);
  const setPlaying = useStore((s) => s.setSlideshowPlaying);
  const [focus, setFocus] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const len = items.length;
  const i = Math.min(Math.max(0, index), Math.max(0, len - 1));
  const item = items[i] as ViewerItem | undefined;
  const live = !!liveUrl;
  const canPage = len > 1 && !live;
  const canPlay = len > 1 && !live;
  const showing = playing && canPlay;

  useEffect(() => { setNatural(null); }, [item?.key]);
  const onNatural = useCallback((w: number, h: number) => setNatural((n) => (n && n.w === w && n.h === h ? n : { w, h })), []);

  const go = useCallback((dir: 1 | -1) => { if (canPage) onIndexChange((i + dir + len) % len); }, [canPage, i, len, onIndexChange]);
  const close = useCallback(() => { setPlaying(false); onClose(); }, [onClose, setPlaying]);

  useEffect(() => registerViewer({ step: (dir) => { if (!canPage) return false; go(dir); return true; }, close }), [canPage, go, close]);

  const P = ShortcutPriority.TopOverlay;
  useShortcut('Escape', () => { if (focus) setFocus(false); else close(); }, { priority: P });
  useShortcut('ArrowLeft', () => go(-1), { priority: P });
  useShortcut('ArrowRight', () => go(1), { priority: P });
  useShortcut(['s', 'S'], () => { if (canPlay) setPlaying(!playing); }, { priority: P });
  useShortcut(['i', 'I'], () => setPanel(!panel), { priority: P, when: () => !phone });
  useShortcut(['f', 'F'], () => { if (item?.entry) useStore.getState().toggleHistoryLiked(item.entry.id); }, { priority: P });
  useShortcut('Delete', () => { if (item && !live) deleteOutput({ entry: item.entry ?? null, url: item.url }); }, { priority: P });

  const drag = useImageDrag(() => (item && !live ? makePayload({ url: item.url, name: item.filename, kind: item.kind, key: item.key, entryId: item.entry?.id, source: 'viewer' }) : null), { disabled: !item || live || phone });

  if (!item && !live) return null;

  const tapPicture = () => { if (showing) setPlaying(false); else setFocus((f) => !f); };
  const picture = showing ? (
    <ShowPicture items={items} index={i} onIndexChange={onIndexChange} transition={transition} speedMs={speedMs} onTap={tapPicture} onNatural={onNatural} />
  ) : (
    <PagerPicture items={items} index={i} onIndexChange={onIndexChange} liveUrl={liveUrl} onClose={close} onTap={tapPicture} onNatural={onNatural} phone={phone} dragProps={phone || !('onDragStart' in drag) ? undefined : drag} />
  );
  const pictureBox = (
    <div {...(item && !live ? menuProps('viewer-image', { item, onClose: close }) : {})}
      style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>{picture}</div>
    </div>
  );
  const gutter = (dir: 1 | -1) => (
    <div style={{ width: 64, flex: 'none', display: 'grid', placeItems: 'center' }}>
      {canPage && !showing && (
        <IconBtn icon={dir < 0 ? <IconChevronLeft size={20} stroke={2.4} /> : <IconChevronRight size={20} stroke={2.4} />} label={dir < 0 ? 'Previous' : 'Next'} keys={dir < 0 ? '←' : '→'}
          onClick={() => go(dir)} size={44} style={{ borderRadius: '50%', background: 'var(--il-elev)', color: 'var(--il-fg)' }} />
      )}
    </div>
  );
  const panelBody = item && !live ? (tab === 'send' ? <SendPanel item={item} onClose={close} /> : <DetailsPanel item={item} natural={natural} />) : (
    <div style={{ padding: 24, color: 'var(--il-muted)', fontWeight: 600, fontSize: 12, textAlign: 'center' }}>Live preview — the details show when the job is done.</div>
  );

  const root: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: T.z.viewer, background: '#0B0B0D', color: 'var(--il-fg)', display: 'flex', flexDirection: 'column', fontFamily: T.font };
  const bar = !focus && (
    <ViewerTopBar item={item} index={i} count={len} live={live} natural={natural} playing={showing} setPlaying={setPlaying} onClose={close} phone={phone} canPlay={canPlay} />
  );

  if (phone) {
    return createPortal(
      <div role="dialog" aria-label="Viewer" data-no-swipe data-pad-layer="viewer" style={root}>
        {bar}
        <div style={{ flex: focus ? 1 : 'none', height: focus ? undefined : '58dvh', display: 'flex', minHeight: 0 }}>{pictureBox}</div>
        {!focus && canPage && (
          <div aria-hidden style={{ height: 22, flex: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
            {items.slice(Math.max(0, i - 3), i + 4).map((it) => (
              <i key={it.key} style={{ width: it.key === item?.key ? 18 : 6, height: 6, borderRadius: 9, background: it.key === item?.key ? 'var(--il-ember)' : 'var(--il-line-strong)' }} />
            ))}
          </div>
        )}
        {!focus && (
          <div style={{ flex: 1, minHeight: 0, background: 'var(--il-panel)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column' }}>
            <Tabs tab={tab} setTab={setTab} />
            <div className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', touchAction: 'pan-y' }}>{panelBody}</div>
          </div>
        )}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div role="dialog" aria-label="Viewer" data-no-swipe data-pad-layer="viewer" style={root}>
      {bar}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {!focus && len > 1 && !live && <ViewerStrip items={items} index={i} onPick={onIndexChange} />}
        {!focus && gutter(-1)}
        {pictureBox}
        {!focus && gutter(1)}
        {!focus && panel && (
          <aside style={{ width: 380, flex: 'none', borderLeft: '1px solid var(--il-line)', background: 'var(--il-panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Tabs tab={tab} setTab={setTab} />
            <div className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>{panelBody}</div>
          </aside>
        )}
      </div>
    </div>,
    document.body,
  );
}
