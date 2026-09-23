import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronRightIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { COLLAPSE_SLACK, PANEL_LIMITS, usePanelLayout, type PanelSide } from './panelLayout';

interface Props {
  side: PanelSide;
  open: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * The v1 resize handle, on the inner edge of a docked side panel. Drag to resize, drag well past
 * the minimum to fold the panel away (and back out to unfold it), double-click to restore the
 * default width. The chevron in the middle folds and unfolds with one click; it shows on hover,
 * and stays faintly visible while the panel is folded so the way back is never hidden.
 */
export function PanelResizeHandle({ side, open, setOpen }: Props) {
  const width = usePanelLayout(s => s[side]);
  const dragging = usePanelLayout(s => s.dragging);
  const drag = useRef<{ x: number; w: number } | null>(null);
  const { min, max } = PANEL_LIMITS[side];
  const dir = side === 'left' ? 1 : -1;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: open ? width : 0 };
    usePanelLayout.getState().setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const raw = drag.current.w + (e.clientX - drag.current.x) * dir;
    if (raw < min - COLLAPSE_SLACK) {
      // Fold, and put back the width the drag started from, so unfolding returns the panel as it was.
      if (open) { setOpen(false); if (drag.current.w) usePanelLayout.getState().setWidth(side, drag.current.w); }
      return;
    }
    if (!open) setOpen(true);
    usePanelLayout.getState().setWidth(side, raw);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    usePanelLayout.getState().setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === grow) { if (!open) setOpen(true); else usePanelLayout.getState().setWidth(side, width + step); }
    else if (e.key === shrink && open) usePanelLayout.getState().setWidth(side, width - step);
    else if (e.key === 'Enter') setOpen(!open);
    else return;
    e.preventDefault();
  };

  // A left chevron folds the left panel and unfolds the right one, so the arrow always points the
  // way the edge will move.
  const pointsLeft = side === 'left' ? open : !open;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${side} panel`}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={open ? width : 0}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => { usePanelLayout.getState().reset(side); if (!open) setOpen(true); }}
      onKeyDown={onKeyDown}
      className={cn(
        'group absolute inset-y-0 z-[31] flex w-2 cursor-col-resize touch-none items-center justify-center outline-none',
        'transition-colors hover:bg-white/5 active:bg-white/[0.08] focus-visible:bg-white/5',
      )}
      style={{
        [side]: open ? width - 4 : 0,
        transition: dragging ? 'none' : `${side} 200ms ease-out, background-color 150ms ease`,
      }}
    >
      <div className="h-2/3 w-1 rounded-md bg-border-default transition-colors group-hover:bg-white/50 group-active:bg-white/50" />
      <div className="absolute flex flex-col items-center">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? `Collapse ${side} panel` : `Expand ${side} panel`}
          title={open ? `Collapse ${side} panel` : `Expand ${side} panel`}
          className={cn(
            'flex h-6 w-5 cursor-pointer items-center justify-center rounded-sm bg-bg-elev text-fg-muted transition-opacity',
            'hover:bg-bg-card-on hover:text-fg-secondary group-hover:opacity-100',
            open ? 'opacity-0 focus-visible:opacity-100' : 'opacity-70',
          )}
        >
          <ChevronRightIcon size={12} className={cn('transition-transform duration-150', pointsLeft && 'rotate-180')} />
        </button>
      </div>
    </div>
  );
}
