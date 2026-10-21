/**
 * Style tab: the row of references (like the Model tab's bubbles, mockup B): the first picture in
 * a circle (or the type's icon), the strength as a badge, the type under it, dimmed when off or not
 * for this model type; ember ring on the selected one, a red × to remove, a dashed green Add at the end.
 * Drag a bubble sideways (mouse / pen) to reorder; on touch the row scrolls instead.
 */
import { useRef, useState } from 'react';
import { IconPlus, IconX } from '@tabler/icons-react';
import { FACE_INFO, TYPE_INFO, methodOf, type StyleRef } from '@/lib/styleRefs';
import { TypeIcon } from './typeIcons';

const C = 56;
/** One bubble's slot: its width + the row's gap. */
const SLOT = 74;
const DRAG_START = 6;
let dragEndedAt = 0;

export function refLabel(r: StyleRef): string {
  const m = methodOf(r);
  return m && m !== 'faceid' ? FACE_INFO[m].title : TYPE_INFO[r.type].title;
}

export function RefBubbles({ refs, selectedId, onSelect, onRemove, onAdd, adding, unfit, onMove }: {
  refs: readonly StyleRef[]; selectedId: string | null; onSelect: (id: string) => void; onRemove: (id: string) => void;
  onAdd: () => void; adding: boolean; unfit: (r: StyleRef) => boolean;
  /** Drag to reorder: move a reference to an index. */
  onMove?: (id: string, to: number) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null);
  const grab = useRef<{ id: string; x: number; from: number; moved: boolean } | null>(null);
  const order = (() => {
    if (!drag) return refs;
    const from = refs.findIndex((r) => r.id === drag.id);
    if (from < 0) return refs;
    const next = [...refs];
    const [r] = next.splice(from, 1);
    next.splice(drag.to, 0, r);
    return next;
  })();
  const onGrab = (e: React.PointerEvent, id: string) => {
    if (!onMove || e.button !== 0 || e.pointerType === 'touch' || refs.length < 2) return;
    const from = refs.findIndex((r) => r.id === id);
    grab.current = { id, x: e.clientX, from, moved: false };
    const move = (ev: PointerEvent) => {
      const g = grab.current;
      if (!g) return;
      const dx = ev.clientX - g.x;
      if (!g.moved && Math.abs(dx) < DRAG_START) return;
      g.moved = true;
      const to = Math.max(0, Math.min(refs.length - 1, g.from + Math.round(dx / SLOT)));
      setDrag((d) => (d && d.to === to ? d : { id: g.id, to }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const g = grab.current;
      grab.current = null;
      if (g?.moved) {
        dragEndedAt = Date.now();
        setDrag((d) => { if (d && d.to !== g.from) onMove(g.id, d.to); return null; });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  return (
    <div className="il-scroll-x" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 4px 0', touchAction: 'pan-x pan-y', flex: 'none' }}>
      {order.map((r) => {
        const sel = !adding && r.id === selectedId;
        const off = !r.on || unfit(r);
        const thumb = r.images[0]?.thumb;
        const label = refLabel(r);
        return (
          <div key={r.id} style={{ position: 'relative', width: 64, flex: 'none', opacity: drag?.id === r.id ? 0.7 : 1 }}>
            <button type="button" className="ilm-bubble" data-selected={sel || undefined} aria-pressed={sel} aria-label={label} title={label}
              onPointerDown={(e) => onGrab(e, r.id)} onClick={() => { if (Date.now() - dragEndedAt < 250) return; onSelect(r.id); }}
              style={{ width: 64, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: sel ? 'var(--il-fg)' : off ? 'var(--il-dim)' : 'var(--il-fg2)' }}>
              <span style={{ position: 'relative', width: C, height: C }}>
                <span className="ilm-bubble-ring" style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', boxSizing: 'border-box', display: 'grid', placeItems: 'center',
                  border: `3px solid ${sel ? 'var(--il-ember)' : 'var(--il-line-strong)'}`, background: 'var(--il-card)', color: 'var(--il-ember-hi)', opacity: off ? 0.45 : 1,
                }}>
                  {thumb ? <img src={thumb} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <TypeIcon type={r.type} size={20} />}
                </span>
                <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -6, fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '2px 6px', whiteSpace: 'nowrap',
                  background: sel ? 'var(--il-ember)' : 'var(--il-card-on)', color: sel ? 'var(--il-bg)' : 'var(--il-fg)' }}>
                  {r.on ? String(Math.round(r.weight * 100) / 100) : 'off'}
                </span>
              </span>
              <span style={{ fontSize: 10, fontWeight: sel ? 800 : 700, maxWidth: 64, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(r.id); }} aria-label={`Remove ${label}`} title="Remove"
              style={{ position: 'absolute', top: -2, right: 2, width: 20, height: 20, padding: 0, border: '2px solid var(--il-panel)', borderRadius: '50%', background: 'var(--il-err)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <IconX size={11} stroke={3} />
            </button>
          </div>
        );
      })}
      <button type="button" onClick={onAdd} aria-label="Add a reference" aria-pressed={adding}
        style={{ width: 64, flex: 'none', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--il-ok)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <span style={{ width: C, height: C, borderRadius: '50%', border: `2px dashed ${adding ? 'var(--il-ember)' : 'var(--il-ok)'}`, background: 'color-mix(in srgb, var(--il-ok) 8%, transparent)', display: 'grid', placeItems: 'center' }}>
          <IconPlus size={18} stroke={2.8} />
        </span>
        <span style={{ fontSize: 10, fontWeight: 800 }}>Add</span>
      </button>
    </div>
  );
}
