/**
 * The full-screen viewer (item 30, list-2 item 22). A click on the canvas opens it straight to the
 * REAL full screen: the picture gets everything under a slim nav row (`ViewerNav`, its own row —
 * nothing over the picture; its buttons fade after 2.5 s without a mouse move and the cursor hides,
 * a move or a tap brings them back). ⓘ turns on the metadata view (remembered): desktop
 * [thumbnail strip 92 | picture | panel 380], phone the picture over a sheet; the panel has Send
 * and Details tabs (external pictures, item 31: their CivitAI data). Previous / next are round
 * frosted buttons at the picture's edges (hover), ←/→ keys, a finger's swipe (the only animated
 * move, item 3); only the slideshow animates otherwise (transition + speed in the nav).
 * Keys: Esc close · ←/→ previous / next (wrap) · S slideshow · I details · F favourite · Del delete.
 * The controller drives it through `registerViewer`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/store';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { registerViewer } from '@/components/viewerTransition';
import { useIsPhone } from '~/app/useIsPhone';
import { usePhoneLandscape } from '~/app/useFormFactor';
import { menuProps } from '~/app/contextMenu';
import { deleteOutput } from '~/app/deleteResult';
import { makePayload, useImageDrag } from '~/dnd';
import { T } from '~/theme/tokens';
import { PagerPicture, ShowPicture } from './ViewerPicture';
import { ViewerNav } from './ViewerNav';
import { ViewerStrip } from './ViewerStrip';
import { SendPanel } from './SendPanel';
import { DetailsPanel } from './DetailsPanel';
import { ExternalDetails } from './ExternalDetails';
import { NavArrows } from '~/ui/NavArrows';
import { useIdle } from './useIdle';
import { useViewerStore, type ViewerTab } from './viewerStore';
import type { ViewerItem } from './types';
import './viewerMenu';
import './resultMeta';
import { dvh } from '~/theme/uiScale';

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

/**
 * Mantine's Modal (a picker under the viewer) closes on Escape unless the key's target carries
 * this attribute: the root has it and every element that takes focus inside is stamped.
 */
const STOP = { 'data-mantine-stop-propagation': 'true' } as const;
const stamp = (e: React.FocusEvent) => (e.target as HTMLElement).setAttribute?.('data-mantine-stop-propagation', 'true');

export function ImageViewer({ items, index, onIndexChange, onClose, liveUrl = null, z = T.z.viewer }: {
  items: readonly ViewerItem[]; index: number; onIndexChange: (i: number) => void; onClose: () => void; liveUrl?: string | null;
  /** The layer (the external viewer sits above the model viewer modal). */
  z?: number;
}) {
  const phone = useIsPhone();
  /** A phone on its side: the picture and the details side by side (mobile pass), not a sheet under a short picture. */
  const land = usePhoneLandscape();
  const meta = useViewerStore((s) => s.meta);
  const setMeta = useViewerStore((s) => s.setMeta);
  const tab = useViewerStore((s) => s.tab);
  const setTab = useViewerStore((s) => s.setTab);
  const transition = useViewerStore((s) => s.transition);
  const speedMs = useViewerStore((s) => s.speedMs);
  const playing = useStore((s) => s.slideshowPlaying);
  const setPlaying = useStore((s) => s.setSlideshowPlaying);
  /** The shown picture's real size, tagged with its key (a stale one reads as null: no reset render per picture). */
  const [nat, setNat] = useState<{ key: string; w: number; h: number } | null>(null);
  /** External NSFW pictures shown after a tap (item 31 / 27), for as long as the viewer is open. */
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  /** The nav is held awake: a popover of it is open or the pointer is on it. */
  const [hold, setHold] = useState(false);
  const { idle, wake } = useIdle(2500, !meta && !phone, hold);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);

  const len = items.length;
  const i = Math.min(Math.max(0, index), Math.max(0, len - 1));
  const item = items[i] as ViewerItem | undefined;
  const live = !!liveUrl;
  const canPage = len > 1 && !live;
  const canPlay = len > 1 && !live;
  const showing = playing && canPlay;

  const shownKey = useRef<string | undefined>(item?.key);
  shownKey.current = item?.key;
  const natural = nat && nat.key === item?.key ? nat : null;
  const onNatural = useCallback((w: number, h: number) => {
    const key = shownKey.current ?? '';
    setNat((n) => (n && n.key === key && n.w === w && n.h === h ? n : { key, w, h }));
  }, []);

  const go = useCallback((dir: 1 | -1) => { if (canPage) onIndexChange((i + dir + len) % len); }, [canPage, i, len, onIndexChange]);
  const close = useCallback(() => { setPlaying(false); onClose(); }, [onClose, setPlaying]);

  useEffect(() => registerViewer({ step: (dir) => { if (!canPage) return false; go(dir); return true; }, close }), [canPage, go, close]);

  const P = ShortcutPriority.TopOverlay;
  useShortcut('Escape', () => close(), { priority: P });
  useShortcut('ArrowLeft', () => go(-1), { priority: P });
  useShortcut('ArrowRight', () => go(1), { priority: P });
  useShortcut(['s', 'S'], () => { if (canPlay) setPlaying(!playing); }, { priority: P });
  useShortcut(['i', 'I'], () => setMeta(!meta), { priority: P });
  useShortcut(['f', 'F'], () => { if (item?.entry) useStore.getState().toggleHistoryLiked(item.entry.id); }, { priority: P });
  useShortcut('Delete', (e) => { if (e.repeat) return; if (item && !live && !item.external) deleteOutput({ entry: item.entry ?? null, url: item.url }); }, { priority: P });

  const drag = useImageDrag(() => (item && !live ? makePayload({ url: item.url, name: item.filename, kind: item.kind, key: item.key, entryId: item.entry?.id, source: 'viewer' }) : null), { disabled: !item || live || phone });

  if (!item && !live) return null;

  // A tap / click on the picture closes the viewer (list-2: open and close are a toggle with the
  // canvas click). Not on the nav, the arrows or the panel (they are outside the picture or
  // buttons), not after a drag / swipe / pan, not while zoomed in (ViewerPicture), not on a clip
  // (its controls). A running slideshow stops first.
  const tapPicture = () => { if (showing) setPlaying(false); else if (item?.kind !== 'video' || live) close(); };
  const picture = showing ? (
    <ShowPicture items={items} index={i} onIndexChange={onIndexChange} transition={transition} speedMs={speedMs} onTap={tapPicture} onNatural={onNatural} />
  ) : (
    <PagerPicture items={items} index={i} onIndexChange={onIndexChange} liveUrl={liveUrl} onClose={close} onTap={tapPicture} onNatural={onNatural} phone={phone} dragProps={phone || !('onDragStart' in drag) ? undefined : drag} />
  );
  const covered = !!item?.external?.nsfw && !revealed.has(item.key);
  const pictureBox = (
    <div {...(item && !live && !covered ? menuProps('viewer-image', { item, onClose: close }) : {})}
      style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
      {covered ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          {/* A clip cannot be an <img> (it fetched the whole MP4 for a broken picture): only stills get the blurred veil. */}
          {item!.kind !== 'video' && <img src={item!.url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', filter: 'blur(48px) brightness(.6)' }} />}
          <button type="button" className="il-btn" onClick={() => setRevealed((r) => new Set(r).add(item!.key))}
            style={{ position: 'relative', height: 44, padding: '0 18px', borderRadius: 999, border: 0, background: 'var(--il-elev)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            NSFW · tap to show
          </button>
        </div>
      ) : <div style={{ position: 'absolute', inset: 0 }}>{picture}</div>}
      {canPage && !showing && !phone && <NavArrows onPrev={() => go(-1)} onNext={() => go(1)} show={!idle} size={44} inset={14} />}
    </div>
  );
  const panelBody = item?.external ? <ExternalDetails item={item} natural={natural} /> : item && !live ? (tab === 'send' ? <SendPanel item={item} onClose={close} /> : <DetailsPanel item={item} natural={natural} />) : (
    <div style={{ padding: 24, color: 'var(--il-muted)', fontWeight: 600, fontSize: 12, textAlign: 'center' }}>Live preview — the details show when the job is done.</div>
  );
  const tabs = !item?.external && <Tabs tab={tab} setTab={setTab} />;

  const root: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: z, ...(land ? { paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' } : {}), outline: 'none', background: '#0B0B0D', color: 'var(--il-fg)', display: 'flex', flexDirection: 'column', fontFamily: T.font, cursor: idle && !phone ? 'none' : undefined };
  const nav = (
    <ViewerNav item={item} index={i} count={len} live={live} natural={natural} playing={showing} setPlaying={setPlaying} onClose={close} phone={phone} canPlay={canPlay} idle={idle} onHold={setHold} />
  );
  const rootProps = {
    ref: rootRef, tabIndex: -1, role: 'dialog', 'aria-label': 'Viewer', 'data-no-swipe': true, 'data-pad-layer': 'viewer', ...STOP,
    onFocusCapture: stamp, onPointerMove: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') wake(); }, style: root,
  } as const;

  if (phone && !land) {
    return createPortal(
      <div {...rootProps}>
        {nav}
        <div style={{ flex: meta ? 'none' : 1, height: meta ? dvh(58) : undefined, display: 'flex', minHeight: 0 }}>{pictureBox}</div>
        {meta && canPage && (
          <div aria-hidden style={{ height: 22, flex: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
            {items.slice(Math.max(0, i - 3), i + 4).map((it) => (
              <i key={it.key} style={{ width: it.key === item?.key ? 18 : 6, height: 6, borderRadius: 9, background: it.key === item?.key ? 'var(--il-ember)' : 'var(--il-line-strong)' }} />
            ))}
          </div>
        )}
        {meta && (
          <div style={{ flex: 1, minHeight: 0, background: 'var(--il-panel)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column' }}>
            {tabs}
            <div className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', touchAction: 'pan-y' }}>{panelBody}</div>
          </div>
        )}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div {...rootProps}>
      {nav}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {meta && len > 1 && !live && !phone && <ViewerStrip items={items} index={i} onPick={onIndexChange} />}
        {pictureBox}
        {meta && (
          <aside style={{ width: phone ? 'clamp(280px, 40%, 380px)' : 380, flex: 'none', borderLeft: '1px solid var(--il-line)', background: 'var(--il-panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {tabs}
            <div className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, paddingBottom: phone ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 12, touchAction: 'pan-y' }}>{panelBody}</div>
          </aside>
        )}
      </div>
    </div>,
    document.body,
  );
}
