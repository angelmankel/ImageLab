/**
 * Item 13: crop handles ON the picture (no separate crop screen, no help text). The rect lives in
 * picture px (`useEdit.crop`); it is drawn in screen px through the GPU view (`engine.toScreen`),
 * so it follows pan / zoom. Corners and edges resize (40 px touch targets), the inside moves, the
 * outside is dimmed, thirds lines while dragging. A ratio from the crop flyout keeps its shape.
 * Enter applies, Esc cancels (the flyout has the same as buttons).
 */
import { useEffect, useRef, useState } from 'react';
import type { GpuCanvas } from '../gpu/engine';
import { dragCrop, ratioRect, type Handle, type Rect } from './editLogic';
import { useEdit } from './editStore';
import { cropRatioValue } from './cropRatio';
import { toCssPx } from '~/theme/uiScale';

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSOR: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move' };

export function CropOverlay({ engine, W, H }: { engine: GpuCanvas; W: number; H: number }) {
  const crop = useEdit((s) => s.crop);
  const ratioId = useEdit((s) => s.cropRatio);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; handle: Handle; start: Rect; x: number; y: number } | null>(null);

  // A fresh crop covers the picture (at the chosen ratio).
  useEffect(() => {
    if (!crop || crop.x + crop.w > W || crop.y + crop.h > H) useEdit.setState({ crop: ratioRect(W, H, cropRatioValue(ratioId, W, H)) });
  }, [W, H]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!crop) return null;

  const a = engine.toScreen({ x: crop.x, y: crop.y });
  const b = engine.toScreen({ x: crop.x + crop.w, y: crop.y + crop.h });
  const z = engine.view().z;

  const down = (handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, handle, start: crop, x: e.clientX, y: e.clientY };
    setDragging(true);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    e.stopPropagation();
    const next = dragCrop(d.start, d.handle, toCssPx(e.clientX - d.x) / z, toCssPx(e.clientY - d.y) / z, W, H, cropRatioValue(ratioId, W, H));
    useEdit.setState({ crop: next });
  };
  const up = (e: React.PointerEvent) => { if (drag.current?.id === e.pointerId) { e.stopPropagation(); drag.current = null; setDragging(false); } };

  const box = { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
  const at = (h: Handle): React.CSSProperties => {
    const x = h.includes('w') ? 0 : h.includes('e') ? 1 : 0.5;
    const y = h.includes('n') ? 0 : h.includes('s') ? 1 : 0.5;
    return { left: `${x * 100}%`, top: `${y * 100}%` };
  };
  return (
    <div aria-label="Crop" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}>
      <div data-gpu-ignore onPointerDown={down('move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ position: 'absolute', ...box, cursor: 'move', pointerEvents: 'auto', touchAction: 'none', boxShadow: '0 0 0 100vmax rgba(0,0,0,.55)', outline: '1px solid rgba(255,255,255,.92)' }}>
        {dragging && (
          <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, transparent calc(33.333% - .5px), rgba(255,255,255,.4) calc(33.333% - .5px), rgba(255,255,255,.4) calc(33.333% + .5px), transparent calc(33.333% + .5px), transparent calc(66.666% - .5px), rgba(255,255,255,.4) calc(66.666% - .5px), rgba(255,255,255,.4) calc(66.666% + .5px), transparent calc(66.666% + .5px)), linear-gradient(transparent calc(33.333% - .5px), rgba(255,255,255,.4) calc(33.333% - .5px), rgba(255,255,255,.4) calc(33.333% + .5px), transparent calc(33.333% + .5px), transparent calc(66.666% - .5px), rgba(255,255,255,.4) calc(66.666% - .5px), rgba(255,255,255,.4) calc(66.666% + .5px), transparent calc(66.666% + .5px))' }} />
        )}
        {HANDLES.map((h) => {
          const corner = h.length === 2;
          return (
            <div key={h} role="slider" aria-label={`Crop ${h}`} aria-valuenow={0} onPointerDown={down(h)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              style={{ position: 'absolute', ...at(h), width: 40, height: 40, transform: 'translate(-50%, -50%)', cursor: CURSOR[h], touchAction: 'none', display: 'grid', placeItems: 'center' }}>
              <span aria-hidden style={{ width: corner ? 14 : h === 'n' || h === 's' ? 22 : 6, height: corner ? 14 : h === 'e' || h === 'w' ? 22 : 6, borderRadius: 3, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.5)' }} />
            </div>
          );
        })}
      </div>
      <div aria-hidden style={{ position: 'absolute', left: box.left, top: Math.max(4, box.top - 26), padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {crop.w} × {crop.h}
      </div>
    </div>
  );
}
