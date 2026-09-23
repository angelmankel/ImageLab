import type { CSSProperties, ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { ChevronRightIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { usePanelLayout } from './panelLayout';

export interface SidePanelProps {
  /** Which edge of the viewport the panel docks to. */
  side: 'left' | 'right';
  /** Whether the panel is currently visible. */
  open: boolean;
  /** Whether to use desktop (in-flow absolute) or mobile (viewport-fixed) geometry. */
  isDesktop: boolean;
  /** Panel width on desktop, in px. Set by the resize handle. */
  width: number;
  /**
   * Px the always-visible left rail reserves on mobile. The left drawer starts past it;
   * the right drawer keeps its edge but gives up the same width, so it stops at the rail
   * instead of sliding underneath it and hiding its own header controls.
   */
  mobileLeftOffset?: number;
  /** Optional override for the mobile width. Defaults to the viewport minus `mobileLeftOffset`, capped at 420px. */
  mobileWidth?: string;
  /** Extra classes for the outer <aside>. */
  className?: string;
  /**
   * Optional sticky header strip rendered at the top of the panel. Use for
   * panel-scoped chrome (collapse triggers, status indicators) so it stays
   * visually attached to the panel surface as the body scrolls.
   */
  header?: ReactNode;
  children: ReactNode;
}

/**
 * Generic side-panel shell. Owns the chrome (border, blurred surface,
 * z-index) and the slide-in/out transform — but knows nothing about its
 * contents, so the same shell can host different feature panels per view.
 *
 * Geometry differs by `isDesktop`: desktop panels are docked to their edge of
 * the parent and resized by a handle; mobile panels
 * are viewport-fixed drawers with an optional left offset to clear a side
 * rail.
 *
 * The open/close trigger is intentionally NOT bundled here — render
 * `<SidePanelTrigger>` somewhere visible (typically inside a `<TopNav>` slot)
 * so the affordance lives next to the user's other tools rather than as a
 * protruding tab on the panel edge.
 */
export function SidePanel({
  side,
  open,
  isDesktop,
  width,
  mobileLeftOffset = 0,
  mobileWidth,
  className,
  header,
  children,
}: SidePanelProps) {
  // Desktop: docked flush to its edge, the full height of the view, the way v1's resizable
  // panels sat — the canvas fills what is left. The width comes from the resize handle, and it
  // snaps rather than animates while that handle is being dragged.
  const dragging = usePanelLayout(st => st.dragging);
  const desktopClosed = side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
  const desktopStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: 0,
    width,
    zIndex: 30,
    transform: open ? 'translateX(0)' : desktopClosed,
    transition: dragging ? 'none' : 'transform 200ms ease-out',
    // A closed panel is off-screen, but the left one is offset past the rail, so its last 52px
    // stay under it — close enough to the surface to win a hit test and eat taps aimed at the
    // rail. `inert` stops interaction; this stops hit-testing as well.
    pointerEvents: open ? undefined : 'none',
  };

  // Mobile: edge-flush drawer (the conventional pattern). No gutter so the
  // drawer reads as overlay chrome, not a card.
  //
  // The width subtracts the rail it is offset past. `min(88vw, 420px)` plus a
  // 52px offset came to 415px on a 412px phone, so the drawer hung off the far
  // edge and its own header controls sat outside the viewport.
  const mobileClosed = side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
  const mobileStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    bottom: 0,
    [side]: side === 'left' ? mobileLeftOffset : 0,
    // Both sides subtract the rail. The left drawer is pushed past it; the right drawer is
    // shortened by it. Letting the right one run the full width put its collapse chevron and
    // the start of its header under the rail, where they could not be read or tapped.
    width: mobileWidth ?? `min(calc(100vw - ${mobileLeftOffset}px), 420px)`,
    zIndex: 30,
    transform: open ? 'translateX(0)' : mobileClosed,
    transition: 'transform 200ms ease-out',
    // A closed panel overshoots the edge, but the left one is offset past the rail, so its
    // last 52px stay under it — close enough to the surface to win a hit test and eat taps
    // aimed at the rail. `inert` stops interaction; this stops hit-testing as well.
    pointerEvents: open ? undefined : 'none',
  };

  // Both are flush now: a single border on the canvas side, no rounding.
  const edgeBorder = side === 'left' ? 'border-r border-border-default' : 'border-l border-border-default';
  const desktopShell = `${edgeBorder} overflow-hidden`;
  const mobileShell = edgeBorder;

  return (
    <aside
      style={isDesktop ? desktopStyle : mobileStyle}
      aria-hidden={!open}
      // A closed panel is translated off-screen but still rendered. Without this it keeps
      // its tab stops and its header's collapse button — which reads as a second "Expand
      // left panel" control that does nothing, sitting under the rail where the real one
      // should be. `inert` takes the whole subtree out of hit-testing and focus at once.
      {...(!open ? { inert: '' as unknown as boolean } : {})}
      className={cn(
        'flex flex-col bg-bg-panel',
        isDesktop ? desktopShell : mobileShell,
        className,
      )}
    >
      {header && (
        <div className="shrink-0 border-b border-border-subtle bg-bg-panel/60 px-2 py-2">
          {header}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </aside>
  );
}

export interface SidePanelTriggerProps {
  side: 'left' | 'right';
  open: boolean;
  onClick: () => void;
}

/**
 * Companion trigger for `<SidePanel>`. Renders as a small IconButton so it
 * drops into a `<TopNav>` slot without ceremony. Chevron always points in
 * the direction the click will move the panel edge — into the canvas to open,
 * back toward the viewport edge to close.
 */
export function SidePanelTrigger({ side, open, onClick }: SidePanelTriggerProps) {
  const pointsRight = (side === 'left' && !open) || (side === 'right' && open);
  return (
    <IconButton
      aria-label={open ? `Collapse ${side} panel` : `Expand ${side} panel`}
      title={open ? 'Collapse panel' : 'Expand panel'}
      onClick={onClick}
    >
      <ChevronRightIcon size={14} className={cn('transition-transform', !pointsRight && 'rotate-180')} />
    </IconButton>
  );
}

export interface BothPanelsTriggerProps {
  leftOpen: boolean;
  rightOpen: boolean;
  onChange: (open: boolean) => void;
}

/**
 * Convenience toggle that collapses or expands both side panels in one
 * click. "Any open → close both" is the rule (so the button is a quick
 * "give me a clean canvas"), and "both closed → open both" restores them.
 */
export function BothPanelsTrigger({ leftOpen, rightOpen, onChange }: BothPanelsTriggerProps) {
  const anyOpen = leftOpen || rightOpen;
  return (
    <IconButton
      aria-label={anyOpen ? 'Collapse both panels' : 'Expand both panels'}
      title={anyOpen ? 'Collapse both panels' : 'Expand both panels'}
      onClick={() => onChange(!anyOpen)}
    >
      <span className="inline-flex items-center gap-px">
        <ChevronRightIcon size={12} className={cn('transition-transform', anyOpen ? 'rotate-180' : '')} />
        <ChevronRightIcon size={12} className={cn('transition-transform', anyOpen ? '' : 'rotate-180')} />
      </span>
    </IconButton>
  );
}
