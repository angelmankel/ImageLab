/**
 * Item 13: THE main canvas, on the GPU (PixiJS, `gpu/engine`). One engine for both modes, so
 * entering / leaving Edit mode never reloads the canvas:
 *   view — what today's stage did: the shown picture fitted (Fit · zoom 1…8× · pan when zoomed ·
 *     wheel / pinch), live preview frames cross-fade in ~150 ms (item 41, a cut with motion off),
 *     a finished image cuts in as soon as it decoded (L1 #3), a picture that may carry alpha sits on
 *     a checkerboard, a tap opens the full-screen viewer, a press at fit drags the picture out
 *     (`~/dnd`, through a see-through proxy over the picture that also carries
 *     `data-viewer-origin` for the viewer's grow-out), right-click = the canvas menu.
 *     Children (the many-preview grid, the empty text) sit over the canvas.
 *   edit — the session's picture with its live look, the grid, a checkerboard, crop handles, the
 *     floating tool bar on the left (`edit/EditBar`), Fit kept clear of the bar.
 * If WebGL cannot start (or a picture cannot be read as a texture) the `fallback` (the DOM
 * picture) shows instead, so the stage never goes blank.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Spinner } from '~/ui';
import { createGpuCanvas, type GpuCanvas } from './gpu/engine';
import { zoomControlsOf, type ZoomControls } from './gpu/zoomControls';
import { useEdit, setEditEngine } from './edit/editStore';
import { CropOverlay } from './edit/CropOverlay';
import { EditBar, EDIT_BAR_INSET } from './edit/EditBar';
import { useEditKeys } from './edit/useEditKeys';

export interface GpuViewProps {
  /** The picture to show (a live frame or a result), null = nothing. */
  src: string | null;
  /** Cross-fade this change (live frames). */
  fade: boolean;
  /** The result's key: a new key re-fits the view (a new pick), a live frame keeps it. */
  itemKey: string | null;
  checker: boolean;
  onTap?: () => void;
  /** Drag-source props for the picture (only used at fit). */
  dragProps?: object;
  /** `data-viewer-origin` for the full-screen viewer's grow-out. */
  originId?: string | null;
  /** The canvas right-click menu props (`menuProps(...)`), or nothing. */
  menu?: object;
}

const NOOP_TAP = () => {};

export function GpuStage({ editing, view, onZoom, fallback, children, phone = false, style }: {
  editing: boolean;
  view: GpuViewProps;
  onZoom?: (z: ZoomControls | null) => void;
  /** The DOM picture, used when the GPU canvas cannot show this picture. */
  fallback?: ReactNode;
  /** Over the canvas in view mode (the live grid, the empty text). */
  children?: ReactNode;
  phone?: boolean;
  style?: CSSProperties;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<GpuCanvas | null>(null);
  const [, setTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const [badSrc, setBadSrc] = useState<string | null>(null);
  const tapRef = useRef<() => void>(NOOP_TAP);
  tapRef.current = !editing && view.onTap ? view.onTap : NOOP_TAP;

  const frame = useEdit((s) => s.hist?.present ?? null);
  const loading = useEdit((s) => s.loading);
  const tool = useEdit((s) => s.tool);
  const error = useEdit((s) => s.error);
  const busy = useEdit((s) => s.busy);
  useEditKeys(editing && !phone);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let raf = 0;
    const e = createGpuCanvas(el, {
      onTap: () => tapRef.current(),
      onChange: () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setTick((t) => t + 1); }); },
    });
    void e.ready.then((ok) => { if (!ok) setFailed(true); });
    setEngine(e);
    return () => { cancelAnimationFrame(raf); setEngine(null); e.dispose(); };
  }, []);

  // The mode: grid, insets, padding, zoom limits, the edit engine handle.
  useEffect(() => {
    if (!engine) return;
    engine.setZoomMode(editing ? 'edit' : 'view');
    engine.setGrid(editing);
    engine.setPad(editing ? 24 : 0);
    engine.setInsets(editing && !phone ? { left: EDIT_BAR_INSET, top: 0, right: 0, bottom: 0 } : { left: 0, top: 0, right: 0, bottom: 0 });
    if (!editing) engine.setLook(null);
    setEditEngine(editing ? engine : null);
    engine.fit();
    return () => { if (editing) setEditEngine(null); };
  }, [engine, editing, phone]);

  // What shows.
  const editUrl = editing ? frame?.pic.url ?? null : null;
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!engine) return;
    if (editing) { if (editUrl) void engine.setPicture(editUrl); return; }
    const refit = !view.fade && view.itemKey !== lastKey.current;
    if (!view.fade) lastKey.current = view.itemKey;
    const src = view.src;
    void engine.setPicture(src, { fade: view.fade, refit }).then((ok) => { if (!ok && src) setBadSrc(src); else if (ok) setBadSrc(null); });
  }, [engine, editing, editUrl, view.src, view.fade, view.itemKey]);
  useEffect(() => { engine?.setChecker(editing || view.checker); }, [engine, editing, view.checker]);
  useEffect(() => { if (editing) engine?.setLook(frame?.look ?? null); }, [engine, editing, frame?.look]);

  // One stable controls object per engine (its `state` reads the live zoom).
  useEffect(() => {
    if (!onZoom || !engine || failed) return;
    onZoom(zoomControlsOf(engine));
    return () => onZoom(null);
  }, [engine, failed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed && !editing) return <>{fallback}</>;

  const size = engine?.pictureSize();
  const rect = !editing && engine && view.src && view.src !== badSrc ? engine.pictureRect() : null;
  const fitted = engine?.isFitted() ?? true;
  const showFallback = !editing && !!badSrc && badSrc === view.src;
  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: phone ? 'column' : 'row', position: 'relative', ...style }}>
      <div ref={host} aria-label={editing ? 'Edit canvas' : 'Stage'} {...(!editing ? view.menu : {})}
        style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', background: 'var(--il-bg-deep)', touchAction: 'none', userSelect: 'none',
          cursor: editing ? 'grab' : !view.src ? 'default' : fitted ? 'zoom-in' : 'grab' }}>
        {rect && (
          <div {...(fitted && view.dragProps ? view.dragProps : { draggable: false })} data-viewer-origin={view.originId ?? undefined} aria-hidden
            style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: 1 }} />
        )}
        {showFallback && <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--il-bg-deep)' }}>{fallback}</div>}
        {!editing && children}
        {editing && engine && size && tool === 'crop' && <CropOverlay engine={engine} W={size.w} H={size.h} />}
        {editing && (loading || failed || error || busy) && (
          <div role={error || failed ? 'alert' : 'status'} style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999,
            background: 'var(--il-elev)', boxShadow: 'inset 0 0 0 1px var(--il-line-strong)', color: error || failed ? 'var(--il-err)' : 'var(--il-fg2)', fontSize: 12, fontWeight: 700, maxWidth: 'calc(100% - 32px)' }}>
            {(loading || (busy && !error)) && <Spinner size={14} />}
            {failed ? 'This browser could not start the GPU canvas (WebGL).' : error ?? (busy ? `${busy}…` : 'Loading the picture…')}
            {error && <button type="button" className="il-btn" onClick={() => useEdit.setState({ error: null })} style={{ border: 0, background: 'transparent', color: 'var(--il-muted)', fontWeight: 800, cursor: 'pointer' }}>Dismiss</button>}
          </div>
        )}
        {editing && !phone && <EditBar phone={false} />}
      </div>
      {editing && phone && <EditBar phone />}
    </div>
  );
}
