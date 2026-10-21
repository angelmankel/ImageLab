/**
 * Item 44 (+ 47): the floating handles on a prompt part, IN the text. Hover a part (touch: the part
 * under the caret) and a small cluster floats at its top-right corner: a grip ⋮⋮ (drag it — drop
 * ON another part = swap, BETWEEN parts = move there) and, on a snippet part, × (take it out).
 * The cluster, the lifted chip and the drop line are absolutely positioned overlays: they take no
 * space, so the text never moves, wraps or jumps when they show. Positions come from the backdrop's
 * part spans (`data-pi`), which share every metric with the textarea.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconGripVertical, IconX } from '@tabler/icons-react';
import type { Part } from './promptSections';

export interface PartDrag {
  from: number;
  /** Swap target (a part index) or move slot (0..n); -1 = nowhere yet. */
  to: number;
  mode: 'swap' | 'move';
  /** Pointer, relative to the wrap. */
  x: number; y: number;
  /** The insert line for a move, relative to the wrap. */
  line: { x: number; y: number; h: number } | null;
}

interface Props {
  wrap: React.RefObject<HTMLDivElement>;
  back: React.RefObject<HTMLDivElement>;
  ta: React.RefObject<HTMLTextAreaElement>;
  parts: Part[];
  value: string;
  /** The part under the caret (touch devices show the handles there). */
  caretPart: number;
  isSnippet: (p: Part) => boolean;
  drag: PartDrag | null;
  setDrag: (d: PartDrag | null) => void;
  onMove: (from: number, to: number, mode: 'swap' | 'move') => void;
  onRemove: (p: Part) => void;
  onPick: (p: Part) => void;
  /** Hide everything (e.g. the "/" picker is open). */
  off?: boolean;
}

const spansOf = (back: HTMLElement) => Array.from(back.querySelectorAll<HTMLElement>('[data-pi]'));
const idxOf = (el: HTMLElement) => Number(el.dataset.pi);

/** The part under (x, y) (client coords), or -1. A few px of slack around each line box. */
function hitPart(back: HTMLElement, x: number, y: number, skip = -1): number {
  for (const el of spansOf(back)) {
    const i = idxOf(el);
    if (i === skip) continue;
    for (const r of Array.from(el.getClientRects())) if (x >= r.left - 3 && x <= r.right + 3 && y >= r.top - 2 && y <= r.bottom + 2) return i;
  }
  return -1;
}

/** The move slot nearest (x, y): before or after the nearest part's nearest line box. */
function slotAt(back: HTMLElement, x: number, y: number): { slot: number; r: DOMRect; after: boolean } | null {
  let best: { slot: number; r: DOMRect; after: boolean; d: number } | null = null;
  for (const el of spansOf(back)) {
    const i = idxOf(el);
    for (const r of Array.from(el.getClientRects())) {
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const d = dy * 3 + dx;
      if (!best || d < best.d) {
        const after = x > r.left + r.width / 2;
        best = { slot: after ? i + 1 : i, r, after, d };
      }
    }
  }
  return best;
}

const noHover = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches;

export function PartHandles({ wrap, back, ta, parts, value, caretPart, isSnippet, drag, setDrag, onMove, onRemove, onPick, off }: Props) {
  const [hover, setHover] = useState(-1);
  const [tick, setTick] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touch = noHover();
  const shown = drag ? -1 : off ? -1 : hover >= 0 ? hover : touch ? caretPart : -1;
  const part = shown >= 0 ? parts[shown] : undefined;

  // Hover tracking on the wrap (the textarea is on top of the backdrop, so hit-test the backdrop).
  useEffect(() => {
    const w = wrap.current;
    const b = back.current;
    if (!w || !b || touch) return;
    const cancelLeave = () => { if (leave.current) { clearTimeout(leave.current); leave.current = null; } };
    const move = (e: MouseEvent) => {
      if (e.buttons) return; // selecting text: no handles
      if ((e.target as HTMLElement).closest?.('[data-part-handles]')) { cancelLeave(); return; }
      const i = hitPart(b, e.clientX, e.clientY);
      if (i >= 0) { cancelLeave(); setHover(i); } else if (!leave.current) leave.current = setTimeout(() => { leave.current = null; setHover(-1); }, 260);
    };
    const out = () => { cancelLeave(); leave.current = setTimeout(() => { leave.current = null; setHover(-1); }, 200); };
    w.addEventListener('mousemove', move);
    w.addEventListener('mouseleave', out);
    return () => { w.removeEventListener('mousemove', move); w.removeEventListener('mouseleave', out); cancelLeave(); };
  }, [wrap, back, touch]);

  // Text changed under the hover: drop it (indexes moved).
  useEffect(() => { setHover(-1); }, [value]);

  // Follow the textarea's own scroll.
  useEffect(() => {
    const t = ta.current;
    if (!t) return;
    const on = () => setTick((n) => n + 1);
    t.addEventListener('scroll', on);
    window.addEventListener('resize', on);
    return () => { t.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, [ta]);

  useLayoutEffect(() => {
    const w = wrap.current; const b = back.current; const t = ta.current;
    if (!w || !b || !t || shown < 0) { setPos(null); return; }
    const el = b.querySelector<HTMLElement>(`[data-pi="${shown}"]`);
    const r = el?.getClientRects()[0];
    if (!r) { setPos(null); return; }
    const wr = w.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    if (r.bottom < tr.top + 2 || r.top > tr.bottom - 2) { setPos(null); return; }
    setPos({ x: r.right - wr.left, y: Math.max(r.top, tr.top) - wr.top });
  }, [shown, value, tick, wrap, back, ta]);

  // Escape cancels a drag.
  useEffect(() => {
    if (!drag) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setDrag(null); } };
    window.addEventListener('keydown', k, true);
    document.body.style.cursor = 'grabbing';
    return () => { window.removeEventListener('keydown', k, true); document.body.style.cursor = ''; };
  }, [!!drag]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, from: number) => {
    e.preventDefault();
    e.stopPropagation();
    const w = wrap.current; const b = back.current; const t = ta.current;
    if (!w || !b || !t) return;
    const btn = e.currentTarget;
    btn.setPointerCapture(e.pointerId);
    const x0 = e.clientX; const y0 = e.clientY;
    let moved = false;
    let cur: PartDrag | null = null;
    const update = (cx: number, cy: number) => {
      const wr = w.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      // Near the box's top / bottom edge: scroll it.
      if (cy < tr.top + 12) t.scrollTop -= 12; else if (cy > tr.bottom - 12) t.scrollTop += 12;
      const hit = hitPart(b, cx, cy, from);
      let next: PartDrag;
      if (hit >= 0) next = { from, to: hit, mode: 'swap', x: cx - wr.left, y: cy - wr.top, line: null };
      else {
        const s = slotAt(b, cx, cy);
        const useful = s && s.slot !== from && s.slot !== from + 1;
        next = { from, to: useful ? s!.slot : -1, mode: 'move', x: cx - wr.left, y: cy - wr.top,
          line: useful ? { x: (s!.after ? s!.r.right + 2 : s!.r.left - 3) - wr.left, y: s!.r.top - wr.top, h: s!.r.height } : null };
      }
      cur = next;
      setDrag(next);
    };
    const mv = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      moved = true;
      update(ev.clientX, ev.clientY);
    };
    const end = (ev: PointerEvent) => {
      btn.removeEventListener('pointermove', mv);
      btn.removeEventListener('pointerup', end);
      btn.removeEventListener('pointercancel', end);
      const d = cur;
      setDrag(null);
      if (ev.type === 'pointercancel') return;
      if (!moved) { onPick(parts[from]); return; }
      if (d && d.to >= 0) onMove(d.from, d.to, d.mode);
    };
    btn.addEventListener('pointermove', mv);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
  };

  const size = touch ? 30 : 20;
  return (
    <>
      {part && pos && (
        <div data-part-handles className="il-sp-handles" style={{ left: pos.x, top: pos.y }}
          onMouseDown={(e) => e.preventDefault()}>
          <button type="button" aria-label="Drag to move this part" title="Drag to move · Alt+← →" className="il-sp-hbtn is-grip"
            style={{ width: size, height: size, touchAction: 'none' }} onPointerDown={(e) => startDrag(e, shown)}>
            <IconGripVertical size={touch ? 15 : 12} stroke={2.4} />
          </button>
          {isSnippet(part) && (
            <button type="button" aria-label="Take this snippet out" title="Take it out" className="il-sp-hbtn is-x"
              style={{ width: size, height: size }} onClick={() => { setHover(-1); onRemove(part); }}>
              <IconX size={touch ? 14 : 11} stroke={2.8} />
            </button>
          )}
        </div>
      )}
      {drag && drag.to >= 0 && drag.line && <div className="il-sp-dropline" style={{ left: drag.line.x, top: drag.line.y, height: drag.line.h }} />}
      {drag && (
        <div className="il-sp-ghost" style={{ left: drag.x, top: drag.y }}>
          {(() => { const p = parts[drag.from]; return p ? value.slice(p.innerStart, p.innerEnd) : ''; })()}
        </div>
      )}
    </>
  );
}
