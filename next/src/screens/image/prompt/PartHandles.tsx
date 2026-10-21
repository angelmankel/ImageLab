/**
 * Item 44 (+ 47): drag a prompt part, in the text. Hover a part (touch: the part under the caret)
 * and a slim grip shows in the GAP just left of its first letter (the ", " before it, or the box's
 * left padding for a part that starts a line) — it never covers a letter. A snippet part also gets
 * a small × in the gap after it. Press the grip and drag: the part lifts as a chip that follows the
 * pointer, the target shows (a part to SWAP with, or an insert line to MOVE to — `partDrag.ts`),
 * release drops it. Esc cancels. Every handle is an absolutely positioned overlay: the text never
 * moves. Window listeners + pointer capture keep the drag alive wherever the pointer goes; the
 * grip stays mounted for the whole drag (unmounting it was what killed the first version).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconGripVertical, IconX } from '@tabler/icons-react';
import { toCssPx } from '~/theme/uiScale';
import type { Part } from './promptSections';
import { dropTarget, hitBox, placeGrip, type Box, type PartBoxes } from './partDrag';

export interface PartDrag {
  from: number;
  /** Swap target (a part index) or move slot (0..n); -1 = nowhere yet. */
  to: number;
  mode: 'swap' | 'move';
  /** Pointer, relative to the wrap (CSS px). */
  x: number; y: number;
  /** The insert line for a move, relative to the wrap (CSS px). */
  line: { x: number; y: number; h: number } | null;
}

interface Props {
  wrap: React.RefObject<HTMLDivElement>;
  back: React.RefObject<HTMLDivElement>;
  ta: React.RefObject<HTMLTextAreaElement>;
  parts: Part[];
  value: string;
  /** The part under the caret: it owns the grip (stable while the pointer travels to the gutter). */
  caretPart: number;
  /** The selected part: drawn as boxes (one per line) behind the text — soft fill + thin border. */
  activePart: number;
  isSnippet: (p: Part) => boolean;
  drag: PartDrag | null;
  setDrag: (d: PartDrag | null) => void;
  /** The hovered part (the backdrop tints it, so you see what the grip holds). */
  onHover: (i: number) => void;
  onMove: (from: number, to: number, mode: 'swap' | 'move') => void;
  onRemove: (p: Part) => void;
  onPick: (p: Part) => void;
  /** Hide everything (e.g. the "/" picker is open). */
  off?: boolean;
}

/** Every part's line boxes, in window px. */
function measure(back: HTMLElement): PartBoxes[] {
  return Array.from(back.querySelectorAll<HTMLElement>('[data-pi]')).map((el) => ({
    i: Number(el.dataset.pi),
    boxes: Array.from(el.getClientRects()).filter((r) => r.width > 0).map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
  }));
}

const noHover = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches;

interface Spot { x: number; y: number; at: string; endX: number; endY: number; endH: number; isLast: boolean }

export function PartHandles({ wrap, back, ta, parts, value, caretPart, activePart, isSnippet, drag, setDrag, onHover, onMove, onRemove, onPick, off }: Props) {
  const [hover, setHoverState] = useState(-1);
  const [tick, setTick] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touch = noHover();
  // Any touch screen (a touchscreen laptop too): the big hit area.
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(any-pointer: coarse)').matches;
  const [hl, setHl] = useState<Array<{ x: number; y: number; w: number; h: number }>>([]);
  const setHover = (i: number) => { setHoverState(i); onHover(i); };
  // The grip belongs to the selected (caret) part when there is one, else to the hovered part.
  const shown = drag ? drag.from : off ? -1 : caretPart >= 0 ? caretPart : hover;
  const part = shown >= 0 ? parts[shown] : undefined;

  // Hover: hit-test the backdrop (the textarea sits on top of it).
  useEffect(() => {
    const w = wrap.current;
    const b = back.current;
    if (!w || !b || touch) return;
    const cancelLeave = () => { if (leave.current) { clearTimeout(leave.current); leave.current = null; } };
    const move = (e: MouseEvent) => {
      if (e.buttons) return; // selecting text: no handles
      if ((e.target as HTMLElement).closest?.('[data-part-handles]')) { cancelLeave(); return; }
      const hit = hitBox(measure(b), e.clientX, e.clientY);
      if (hit) { cancelLeave(); setHover(hit.i); } else if (!leave.current) leave.current = setTimeout(() => { leave.current = null; setHover(-1); }, 300);
    };
    const out = () => { cancelLeave(); leave.current = setTimeout(() => { leave.current = null; setHover(-1); }, 200); };
    w.addEventListener('mousemove', move);
    w.addEventListener('mouseleave', out);
    return () => { w.removeEventListener('mousemove', move); w.removeEventListener('mouseleave', out); cancelLeave(); };
  }, [wrap, back, touch]); // eslint-disable-line react-hooks/exhaustive-deps

  // New text: indexes moved, drop the hover.
  useEffect(() => { setHover(-1); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the textarea's scroll and the window size.
  useEffect(() => {
    const t = ta.current;
    if (!t) return;
    const on = () => setTick((n) => n + 1);
    t.addEventListener('scroll', on);
    window.addEventListener('resize', on);
    return () => { t.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, [ta]);

  // Where the grip goes (option 2: floating over the text, no gutter): measured — the spot around
  // the part's first / last line that covers the least of the OTHER parts (`placeGrip`). Wrap CSS px.
  const pillW = coarse ? 26 : 20;
  const pillH = coarse ? 32 : 24;
  useLayoutEffect(() => {
    const w = wrap.current; const b = back.current; const t = ta.current;
    if (!w || !b || !t || shown < 0) { setSpot(null); return; }
    const wr = w.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    const toBox = (r: { left: number; top: number; right: number; bottom: number }): Box => ({
      left: toCssPx(r.left - wr.left), top: toCssPx(r.top - wr.top), right: toCssPx(r.right - wr.left), bottom: toCssPx(r.bottom - wr.top),
    });
    const all = measure(b);
    const mine = all.find((p) => p.i === shown)?.boxes ?? [];
    if (!mine.length) { setSpot(null); return; }
    const first = mine[0];
    const last = mine[mine.length - 1];
    if (first.bottom < tr.top + 2 || first.top > tr.bottom - 2) { setSpot(null); return; }
    const others = all.filter((p) => p.i !== shown).flatMap((p) => p.boxes.map(toBox));
    const width = toCssPx(wr.width);
    const height = toCssPx(tr.bottom - wr.top);
    const g = placeGrip(toBox(first), toBox(last), others, pillW, pillH, { left: -12, top: -8, right: width + 12, bottom: height + 4 });
    const lb = toBox(last);
    setSpot({ x: g.x, y: g.y, at: g.at, endX: lb.right, endY: lb.top, endH: lb.bottom - lb.top, isLast: last.bottom >= tr.top && last.top <= tr.bottom });
  }, [shown, value, tick, wrap, back, ta, pillW, pillH]);

  // The selected part's highlight: one box per line box, widened 6 px each side, behind the text.
  useLayoutEffect(() => {
    const w = wrap.current; const b = back.current;
    if (!w || !b || activePart < 0 || drag) { setHl((h) => (h.length ? [] : h)); return; }
    const wr = w.getBoundingClientRect();
    const rects = Array.from(b.querySelector<HTMLElement>(`[data-pi="${activePart}"]`)?.getClientRects() ?? []).filter((r) => r.width > 0);
    setHl(rects.map((r) => ({ x: toCssPx(r.left - wr.left), y: toCssPx(r.top - wr.top), w: toCssPx(r.width), h: toCssPx(r.height) })));
  }, [activePart, value, tick, drag, wrap, back]);

  const startDrag = (e: React.PointerEvent<HTMLElement>, from: number) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no focus change, no text selection
    e.stopPropagation();
    const w = wrap.current; const b = back.current; const t = ta.current;
    if (!w || !b || !t) return;
    const grip = e.currentTarget;
    try { grip.setPointerCapture(e.pointerId); } catch { /* fine without */ }
    const id = e.pointerId;
    const x0 = e.clientX; const y0 = e.clientY;
    let moved = false;
    let cur: PartDrag | null = null;
    let raf = 0;
    const update = (cx: number, cy: number, scroll = true) => {
      const tr = t.getBoundingClientRect();
      // Near the box's top / bottom edge: scroll it (the backdrop follows through onScroll).
      if (scroll) { if (cy < tr.top + 10) t.scrollTop -= 14; else if (cy > tr.bottom - 10) t.scrollTop += 14; }
      const wr = w.getBoundingClientRect();
      const d = dropTarget(measure(b), from, cx, cy);
      cur = {
        from, to: d.to, mode: d.mode, x: toCssPx(cx - wr.left), y: toCssPx(cy - wr.top),
        line: d.line ? { x: toCssPx(d.line.x - wr.left), y: toCssPx(d.line.top - wr.top), h: toCssPx(d.line.h) } : null,
      };
      setDrag(cur);
    };
    const prevSelect = document.body.style.userSelect;
    const finish = () => {
      window.removeEventListener('pointermove', mv, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('keydown', key, true);
      cancelAnimationFrame(raf);
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = '';
      try { grip.releasePointerCapture(id); } catch { /* gone */ }
    };
    const mv = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      ev.preventDefault();
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      if (!moved) { moved = true; document.body.style.userSelect = 'none'; document.body.style.cursor = 'grabbing'; }
      cancelAnimationFrame(raf);
      const cx = ev.clientX; const cy = ev.clientY;
      raf = requestAnimationFrame(() => update(cx, cy));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      finish();
      if (!moved) { setDrag(null); onPick(parts[from]); return; }
      update(ev.clientX, ev.clientY, false);
      const d = cur;
      setDrag(null);
      if (d && d.to >= 0) onMove(d.from, d.to, d.mode);
    };
    const cancel = (ev: PointerEvent) => { if (ev.pointerId !== id) return; finish(); setDrag(null); };
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(); setDrag(null); } };
    window.addEventListener('pointermove', mv, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('keydown', key, true);
  };

  // Grip hit area: wide enough to grab (it may lie over the ", " before the part, never over the
  // part's own letters); the visible grip is a slim bar in the gap itself.
  // A 24 px pill (32 px on a touch screen) with a 44 px hit area on touch, centred on the pill.
  const hitW = coarse ? 44 : pillW + 4;
  const hitH = coarse ? 44 : pillH + 4;
  const xSize = touch ? 28 : 16;
  return (
    <>
      <div className="il-sp-hl-layer" aria-hidden>
        {hl.map((r, k) => <div key={k} className="il-sp-hl" style={{ left: r.x - 6, top: r.y - 1, width: r.w + 12, height: r.h + 2 }} />)}
      </div>
      {part && spot && (
        <div data-part-handles className={`il-sp-grip${drag ? ' is-dragging' : ''}${coarse ? ' is-coarse' : ''}`} role="button" aria-label="Drag to move this part" title={touch ? undefined : 'Move part'}
          onPointerDown={(e) => startDrag(e, shown)} onMouseDown={(e) => e.preventDefault()}
          style={{ left: spot.x + pillW / 2 - hitW / 2, top: spot.y + pillH / 2 - hitH / 2, width: hitW, height: hitH, touchAction: 'none' }}>
          <span className="il-sp-grip-pill"><IconGripVertical size={coarse ? 16 : 14} stroke={2.4} /></span>
        </div>
      )}
      {part && spot && spot.isLast && !drag && isSnippet(part) && (
        <button type="button" data-part-handles className="il-sp-x" aria-label="Take this snippet out" title="Take it out"
          onMouseDown={(e) => e.preventDefault()} onClick={() => { setHover(-1); onRemove(part); }}
          style={spot.at === 'after'
            ? { left: spot.x + pillW + 3, top: spot.y + pillH / 2 - xSize / 2, width: xSize, height: xSize }
            : { left: spot.endX + 2, top: spot.endY + spot.endH / 2 - xSize / 2, width: xSize, height: xSize }}>
          <IconX size={touch ? 13 : 10} stroke={3} />
        </button>
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
