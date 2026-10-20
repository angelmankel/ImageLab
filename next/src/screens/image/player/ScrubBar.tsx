/**
 * The player's scrub bar: it fills the controls row's middle at the row's full height (the hit
 * area), a hairline track with ember progress, a thumb on hover / drag (always on the phone), the
 * time under the pointer on hover. A press seeks at once and a drag seeks live; the parent pauses
 * for the drag and restores the playing state on release. `touch-action: none` on the bar only.
 */
import { useRef, useState } from 'react';
import { fmtTime, posOf, timeAt } from './playerLogic';

export function ScrubBar({ time, duration, phone, disabled, onSeekStart, onSeek, onSeekEnd }: {
  time: number;
  duration: number;
  phone: boolean;
  disabled: boolean;
  onSeekStart: () => void;
  onSeek: (t: number) => void;
  onSeekEnd: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const at = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return { x: 0, t: 0 };
    const t = timeAt(clientX, r.left, r.width, duration);
    return { x: Math.min(r.width, Math.max(0, clientX - r.left)), t };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onSeekStart();
    const p = at(e.clientX);
    setHover(p);
    onSeek(p.t);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const p = at(e.clientX);
    if (dragging) { setHover(p); onSeek(p.t); return; }
    if (e.pointerType === 'mouse') setHover(p);
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    onSeekEnd();
    if (e.pointerType !== 'mouse') setHover(null);
  };

  const pct = posOf(time, duration) * 100;
  const showThumb = !disabled && (phone || !!hover || dragging);
  const trackH = phone ? 4 : 3;
  const thumb = phone ? 14 : 12;

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={duration || 0}
      aria-valuenow={time}
      aria-valuetext={fmtTime(time, true)}
      aria-disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => { if (!dragging) setHover(null); }}
      style={{ flex: 1, minWidth: 40, height: '100%', position: 'relative', cursor: disabled ? 'default' : 'pointer', touchAction: 'none', userSelect: 'none', opacity: disabled ? 0.4 : 1 }}
    >
      <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: trackH, marginTop: -trackH / 2, borderRadius: 2, background: 'var(--il-line-strong)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--il-ember)', borderRadius: 2 }} />
      </div>
      <div aria-hidden style={{ position: 'absolute', top: '50%', left: `${pct}%`, width: thumb, height: thumb, marginLeft: -thumb / 2, marginTop: -thumb / 2, borderRadius: '50%', background: 'var(--il-ember-hi)', boxShadow: '0 0 0 2px var(--il-bg)', opacity: showThumb ? 1 : 0, transform: dragging ? 'scale(1.15)' : 'none', transition: 'opacity .12s, transform .12s', pointerEvents: 'none' }} />
      {hover && !disabled && (
        <span aria-hidden style={{ position: 'absolute', top: 2, left: hover.x, transform: 'translateX(-50%)', height: 16, padding: '0 6px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg2)', fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: '16px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {fmtTime(hover.t, true)}
        </span>
      )}
    </div>
  );
}

/** The live-render bar in the scrub bar's place: ember progress on the hairline, a sweep when unknown. */
export function RenderBar({ progress }: { progress: number | null }) {
  const pct = progress != null ? Math.max(2, Math.round(progress * 100)) : null;
  return (
    <div aria-hidden style={{ flex: 1, minWidth: 40, height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 3, marginTop: -1.5, borderRadius: 2, background: 'var(--il-line-strong)', overflow: 'hidden' }}>
        {pct != null
          ? <div style={{ height: '100%', width: `${pct}%`, background: 'var(--il-ember)', borderRadius: 2, transition: 'width .2s' }} />
          : <div className="il-sweep" style={{ height: '100%', width: '33%', background: 'linear-gradient(90deg, transparent, var(--il-ember), transparent)' }} />}
      </div>
    </div>
  );
}
