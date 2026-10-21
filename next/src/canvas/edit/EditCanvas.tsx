/**
 * Item 13: the stage in Edit mode — the GPU canvas (`gpu/engine`) with its grid, the session's
 * present picture with its live look, a checkerboard under it (cut-outs), the crop handles when
 * Crop is open, and the floating tool bar on the left (`EditBar`). Fit keeps the picture clear of
 * the bar (insets), so at fit nothing covers it. It exposes the zoom controls the toolbar uses.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader } from '@mantine/core';
import { createGpuCanvas, type GpuCanvas } from '../gpu/engine';
import { useEdit, setEditEngine } from './editStore';
import { CropOverlay } from './CropOverlay';
import { EditBar, EDIT_BAR_INSET } from './EditBar';
import { useEditKeys } from './useEditKeys';
import { zoomControlsOf, type ZoomControls } from '../gpu/zoomControls';

export function EditCanvas({ onZoom, phone = false }: { onZoom?: (z: ZoomControls | null) => void; phone?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<GpuCanvas | null>(null);
  const [, setTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const frame = useEdit((s) => s.hist?.present ?? null);
  const loading = useEdit((s) => s.loading);
  const tool = useEdit((s) => s.tool);
  const error = useEdit((s) => s.error);
  const busy = useEdit((s) => s.busy);
  useEditKeys(!phone);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let raf = 0;
    const e = createGpuCanvas(el, { pad: 24, onChange: () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setTick((t) => t + 1); }); } });
    e.setZoomMode('edit');
    e.setGrid(true);
    e.setChecker(true);
    void e.ready.then((ok) => { if (!ok) setFailed(true); });
    setEngine(e);
    setEditEngine(e);
    return () => { cancelAnimationFrame(raf); setEditEngine(null); setEngine(null); e.dispose(); };
  }, []);

  useEffect(() => { engine?.setInsets(phone ? { left: 0, top: 0, right: 0, bottom: 0 } : { left: EDIT_BAR_INSET, top: 0, right: 0, bottom: 0 }); }, [engine, phone]);
  useEffect(() => { if (engine && frame) void engine.setPicture(frame.pic.url); }, [engine, frame?.pic.url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { engine?.setLook(frame?.look ?? null); }, [engine, frame?.look]);
  useEffect(() => { engine?.setPanEnabled(true); }, [engine, tool]);

  // One stable controls object per engine (its `state` reads the live zoom).
  useEffect(() => {
    if (!onZoom) return;
    if (!engine) { onZoom(null); return; }
    onZoom(zoomControlsOf(engine));
    return () => onZoom(null);
  }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps

  const size = engine?.pictureSize();
  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: phone ? 'column' : 'row', position: 'relative' }}>
      <div ref={host} aria-label="Edit canvas" style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', background: 'var(--il-bg-deep)', touchAction: 'none', cursor: 'grab' }}>
        {engine && size && tool === 'crop' && <CropOverlay engine={engine} W={size.w} H={size.h} />}
        {(loading || failed || error || busy) && (
          <div role={error || failed ? 'alert' : 'status'} style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999,
            background: 'var(--il-elev)', boxShadow: 'inset 0 0 0 1px var(--il-line-strong)', color: error || failed ? 'var(--il-err)' : 'var(--il-fg2)', fontSize: 12, fontWeight: 700, maxWidth: 'calc(100% - 32px)' }}>
            {(loading || (busy && !error)) && <Loader size={14} color="var(--il-ember)" />}
            {failed ? 'This browser could not start the GPU canvas (WebGL).' : error ?? (busy ? `${busy}…` : 'Loading the picture…')}
            {error && <button type="button" className="il-btn" onClick={() => useEdit.setState({ error: null })} style={{ border: 0, background: 'transparent', color: 'var(--il-muted)', fontWeight: 800, cursor: 'pointer' }}>Dismiss</button>}
          </div>
        )}
        {!phone && <EditBar phone={false} />}
      </div>
      {phone && <EditBar phone />}
    </div>
  );
}
