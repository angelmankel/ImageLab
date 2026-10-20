import { useCallback, useRef, type ReactNode } from 'react';
import { T } from '~/theme/tokens';

/**
 * A docked side panel (step panel, history, library/models detail): fixed width, resizable by its
 * inner edge, collapsible to a slim tab on that edge (design rules 3 and 8). Content scrolls inside.
 *
 *   side='left'  : [ panel ][handle]      collapsed → [tab]
 *   side='right' :      [handle][ panel ] collapsed →      [tab]
 */
export function Panel({ side, width, min = 240, max = 640, open, onResize, onToggle, children, tabLabel, resizable = true }: {
  side: 'left' | 'right'; width: number; min?: number; max?: number; open: boolean;
  onResize?: (w: number) => void; onToggle: () => void; children: ReactNode; tabLabel: string; resizable?: boolean;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!onResize) return;
    start.current = { x: e.clientX, w: width };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [onResize, width]);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!start.current || !onResize) return;
    const dx = (e.clientX - start.current.x) * (side === 'left' ? 1 : -1);
    onResize(Math.max(min, Math.min(max, start.current.w + dx)));
  }, [onResize, side, min, max]);
  const onPointerUp = useCallback(() => { start.current = null; }, []);

  const tab = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${open ? 'Hide' : 'Show'} ${tabLabel}`}
      title={`${open ? 'Hide' : 'Show'} ${tabLabel}`}
      style={{
        width: T.size.collapsedTab, alignSelf: 'stretch', border: 0, flex: 'none', cursor: 'pointer',
        background: open ? 'transparent' : 'var(--il-panel)', color: 'var(--il-muted)',
        borderLeft: side === 'right' ? '1px solid var(--il-line)' : undefined,
        borderRight: side === 'left' ? '1px solid var(--il-line)' : undefined,
        display: 'grid', placeItems: 'center', fontSize: 14,
      }}
    >
      <span style={{ writingMode: 'vertical-rl', fontSize: 10, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', display: open ? 'none' : 'block' }}>{tabLabel}</span>
      <span style={{ display: open ? 'block' : 'none' }}>{side === 'left' ? '‹' : '›'}</span>
    </button>
  );

  if (!open) return tab;

  const handle = resizable && onResize ? (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => onResize(side === 'left' ? T.size.stepPanel : T.size.historyPanel)}
      style={{ width: 6, cursor: 'col-resize', flex: 'none', background: 'transparent', touchAction: 'none' }}
    />
  ) : null;

  const body = (
    <div style={{ width, flex: 'none', minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-panel)', overflow: 'hidden', position: 'relative' }}>
      {children}
      <div style={{ position: 'absolute', top: 0, bottom: 0, [side === 'left' ? 'right' : 'left']: 0, width: 1, background: 'var(--il-line)' }} />
    </div>
  );

  return side === 'left'
    ? <>{body}{handle}{tab}</>
    : <>{tab}{handle}{body}</>;
}
