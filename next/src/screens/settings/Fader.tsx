/**
 * A vertical fader for the Settings → Sounds mixer (Donny 10-21: "vertical sliders and a value at
 * the bottom that is editable"). Dressed like the app's Slider (6 px track, ember fill, 20 px
 * ember handle with the page-colour ring, ember value bubble while dragging / hovering / focused).
 * Drag anywhere on it (the handle jumps to the finger), arrow keys / Page keys / Home / End, the
 * wheel over it, double-click resets. `onChangeEnd` fires once per drag / key burst / wheel pause.
 * Touch: `touch-action: pan-x`, so the mixer row still scrolls sideways under a finger.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';

export interface FaderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onChangeEnd?: (v: number) => void;
  onReset?: () => void;
  format: (v: number) => string;
  label: string;
  height: number;
  disabled?: boolean;
  /** The master's look: a light cap instead of ember. */
  master?: boolean;
}

export function Fader({ value, min = 0, max = 100, step = 1, onChange, onChangeEnd, onReset, format, label, height, disabled, master }: FaderProps) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const [hot, setHot] = useState(false);
  const live = useRef(value);
  live.current = value;
  const endTimer = useRef<number | undefined>(undefined);
  const cb = useRef({ onChange, onChangeEnd });
  cb.current = { onChange, onChangeEnd };

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const fromY = (y: number) => {
    const r = box.current!.getBoundingClientRect();
    const pad = THUMB / 2;
    const f = 1 - (y - r.top - pad) / Math.max(1, r.height - THUMB);
    return clamp(min + Math.min(1, Math.max(0, f)) * (max - min));
  };
  const set = (v: number) => { if (v !== live.current) { live.current = v; cb.current.onChange(v); } };
  const endSoon = () => {
    window.clearTimeout(endTimer.current);
    endTimer.current = window.setTimeout(() => cb.current.onChangeEnd?.(live.current), 350);
  };
  useEffect(() => () => window.clearTimeout(endTimer.current), []);

  // Wheel: non-passive, so the page does not scroll while stepping the fader.
  useEffect(() => {
    const el = box.current;
    if (!el || disabled) return;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      e.stopPropagation(); // the mixer row would scroll sideways too
      set(clamp(live.current + (e.deltaY < 0 ? step : -step) * (e.shiftKey ? 5 : 1)));
      endSoon();
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, min, max, step]);

  const down = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    box.current?.focus({ preventScroll: true });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(true);
    set(fromY(e.clientY));
  };
  const move = (e: React.PointerEvent) => { if (drag) set(fromY(e.clientY)); };
  const up = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag(false);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* gone */ }
    cb.current.onChangeEnd?.(live.current);
  };
  const key = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const big = (max - min) / 10;
    const k: Record<string, number> = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: big, PageDown: -big };
    let v: number | undefined;
    if (e.key in k) v = live.current + k[e.key] * (e.shiftKey ? 5 : 1);
    else if (e.key === 'Home') v = min;
    else if (e.key === 'End') v = max;
    if (v === undefined) return;
    e.preventDefault();
    e.stopPropagation(); // ←/→ never also step results
    set(clamp(v));
    endSoon();
  };

  const f = (Math.min(max, Math.max(min, value)) - min) / Math.max(1e-9, max - min);
  const travel = height - THUMB;
  const thumbTop = (1 - f) * travel;
  const showBubble = drag || hot;
  const cap: CSSProperties = master
    ? { background: 'var(--il-fg)', boxShadow: '0 0 0 1px var(--il-line-strong), 0 2px 8px rgba(0,0,0,.4)' }
    : { background: 'var(--il-ember)', boxShadow: '0 0 0 1px var(--il-ember-line), 0 2px 8px rgba(0,0,0,.4)' };
  return (
    <div
      ref={box}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      aria-disabled={disabled || undefined}
      data-sound="none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      onDoubleClick={() => !disabled && onReset?.()}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHot(true)}
      onPointerLeave={() => setHot(false)}
      onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setHot(true); }}
      onBlur={() => setHot(false)}
      className="il-fader"
      style={{
        position: 'relative', width: 32, height, cursor: disabled ? 'default' : 'ns-resize', touchAction: 'pan-x',
        opacity: disabled ? 0.45 : 1, outline: 'none', flex: 'none',
      }}
    >
      {/* the track and its fill */}
      <div style={{ position: 'absolute', left: 13, width: 6, top: THUMB / 2, bottom: THUMB / 2, borderRadius: 3, background: 'var(--il-line)' }} />
      <div style={{ position: 'absolute', left: 13, width: 6, bottom: THUMB / 2, height: f * travel, borderRadius: 3, background: master ? 'var(--il-fg2)' : 'var(--il-ember)' }} />
      {/* the handle */}
      <div className="il-fader-thumb" data-dragging={drag || undefined}
        style={{
          position: 'absolute', left: 16 - THUMB / 2, top: thumbTop, width: THUMB, height: THUMB, borderRadius: 999,
          border: '3px solid var(--il-bg)', boxSizing: 'border-box', ...cap,
        }} />
      {showBubble && (
        <div style={{
          position: 'absolute', left: '50%', top: thumbTop - 26, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 5,
          background: master ? 'var(--il-fg)' : 'var(--il-ember)', color: 'var(--il-bg)', fontSize: 11, fontWeight: 800, lineHeight: 1,
          padding: '5px 7px', borderRadius: 8, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', boxShadow: '0 4px 14px rgba(0,0,0,.35)',
        }}>{format(value)}</div>
      )}
    </div>
  );
}

const THUMB = 20;
