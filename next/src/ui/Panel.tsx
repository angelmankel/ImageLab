import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { T } from '~/theme/tokens';

/** The invisible grab area centred on the 1px hairline (wide enough for a finger). */
const HIT = 10;

/**
 * A docked side panel (step panel, history, library/models detail): fixed width, resizable by its
 * inner edge, collapsible to a slim tab on that edge (design rules 3 and 8). Content scrolls inside.
 *
 *   side='left'  : [ panel ]|      collapsed → [tab]
 *   side='right' :      |[ panel ] collapsed →      [tab]
 *
 * The edge `|` is the splitter: a 1px hairline (`--il-line`) that turns a 2px ember line on hover
 * and while dragging, with an invisible HIT-px grab area centred on it (`col-resize`,
 * `touch-action: none`). Double-click resets to `defaultWidth`. Hovering the edge shows a small
 * chevron on the panel's side of it (always shown on touch screens) that collapses the panel;
 * the collapsed slim tab (`T.size.collapsedTab`) reopens it.
 */
export function Panel({ side, width, min = 240, max = 640, open, onResize, onToggle, children, tabLabel, resizable = true, defaultWidth, edgeToggle = true }: {
  side: 'left' | 'right'; width: number; min?: number; max?: number; open: boolean;
  onResize?: (w: number) => void; onToggle: () => void; children: ReactNode; tabLabel: string; resizable?: boolean;
  /** Double-click on the edge resets to this (clamped to min/max). Default: the step / history panel width. */
  defaultWidth?: number;
  /** false = no chevron on the edge (the step panel folds by clicking its open step in the rail, fix list 8). */
  edgeToggle?: boolean;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const touch = useMediaQuery('(hover: none)');
  const canResize = resizable && !!onResize;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!onResize || e.button !== 0) return;
    e.preventDefault(); // no text selection while dragging
    start.current = { x: e.clientX, w: width };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }, [onResize, width]);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!start.current || !onResize) return;
    const dx = (e.clientX - start.current.x) * (side === 'left' ? 1 : -1);
    onResize(Math.max(min, Math.min(max, start.current.w + dx)));
  }, [onResize, side, min, max]);
  const onPointerUp = useCallback(() => { start.current = null; setDragging(false); }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Show ${tabLabel}`}
        title={`Show ${tabLabel}`}
        style={{
          width: T.size.collapsedTab, alignSelf: 'stretch', border: 0, flex: 'none', cursor: 'pointer',
          background: 'var(--il-panel)', color: 'var(--il-muted)',
          borderLeft: side === 'right' ? '1px solid var(--il-line)' : undefined,
          borderRight: side === 'left' ? '1px solid var(--il-line)' : undefined,
          display: 'grid', placeItems: 'center',
        }}
      >
        <span style={{ writingMode: 'vertical-rl', fontSize: 10, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase' }}>{tabLabel}</span>
      </button>
    );
  }

  const lit = canResize && (hover || dragging);
  const showChevron = (hover || touch) && !dragging;
  const reset = () => {
    if (!onResize) return;
    const d = defaultWidth ?? (side === 'left' ? T.size.stepPanel : T.size.historyPanel);
    onResize(Math.max(min, Math.min(max, d)));
  };

  // The edge takes 1px in the row; the grab area and the chevron hang off it (absolute).
  const edge = (
    <div
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{ position: 'relative', width: 1, flex: 'none', alignSelf: 'stretch', background: 'var(--il-line)', zIndex: 2 }}
    >
      <div aria-hidden style={{
        position: 'absolute', top: 0, bottom: 0, left: '50%', width: lit ? 2 : 1, transform: 'translateX(-50%)',
        background: lit ? 'var(--il-ember)' : 'transparent', transition: 'background-color .12s, width .12s', pointerEvents: 'none',
      }} />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${tabLabel}`}
        aria-valuenow={Math.round(width)}
        aria-valuemin={min}
        aria-valuemax={max}
        title={canResize ? 'Drag to resize · double-click to reset' : undefined}
        onPointerDown={canResize ? onPointerDown : undefined}
        onPointerMove={canResize ? onPointerMove : undefined}
        onPointerUp={canResize ? onPointerUp : undefined}
        onPointerCancel={canResize ? onPointerUp : undefined}
        onLostPointerCapture={canResize ? onPointerUp : undefined}
        onDoubleClick={canResize ? reset : undefined}
        style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%', width: HIT, transform: 'translateX(-50%)',
          cursor: canResize ? 'col-resize' : 'default', touchAction: 'none', background: 'transparent',
        }}
      />
      {edgeToggle && <button
        type="button"
        onClick={onToggle}
        aria-label={`Hide ${tabLabel}`}
        title={`Hide ${tabLabel}`}
        style={{
          position: 'absolute', top: '50%', [side === 'left' ? 'right' : 'left']: Math.ceil(HIT / 2),
          transform: 'translateY(-50%)', width: 14, height: 32, padding: 0, borderRadius: T.radius.pill,
          border: '1px solid var(--il-line-soft)', background: 'var(--il-elev)', color: 'var(--il-muted)',
          display: 'grid', placeItems: 'center', fontSize: 12, lineHeight: 1, cursor: 'pointer',
          opacity: showChevron ? 1 : 0, pointerEvents: showChevron ? 'auto' : 'none', transition: 'opacity .12s',
        }}
      >
        {side === 'left' ? '‹' : '›'}
      </button>}
    </div>
  );

  const body = (
    <div style={{ width, flex: 'none', minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-panel)', overflow: 'hidden', position: 'relative' }}>
      {children}
    </div>
  );

  return side === 'left' ? <>{body}{edge}</> : <>{edge}{body}</>;
}
