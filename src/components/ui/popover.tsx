/**
 * The one popover base for the whole app, built on Mantine's Popover (floating-ui underneath).
 *
 * Every popover gets the same guarantees for free: it renders in a portal above the panels and
 * the side rail, it flips to the other side when there is no room, it shifts along its edge to
 * stay inside the window, and it closes on Escape and on a click outside. The part names match
 * Radix's (`Root`, `Trigger`, `Portal`, `Content`, `Close`) so a feature file only swaps its import:
 *
 *   import * as Popover from '@/components/ui/popover';
 *
 * Position props are given on `Content`, as with Radix; they are lifted to the Mantine root.
 */
import { DROPDOWN_MIDDLEWARES } from '@/modules/theme/popoverMiddlewares';
import {
  cloneElement, createContext, useContext, useLayoutEffect, useState,
  type CSSProperties, type HTMLAttributes, type ReactElement, type ReactNode,
} from 'react';
import { Popover as MPopover, type FloatingPosition } from '@mantine/core';

/** Above modals' content (200) and the rail (70), below notifications. */
export const POPOVER_Z = 300;
/**
 * For a popover whose body opens modals (the chip editors' model pickers, the input image
 * browser): under the modals (200) so they show on top, still above every panel and the rail.
 */
export const POPOVER_UNDER_MODALS_Z = 190;

// Mantine closes a popover on any mousedown outside its target and dropdown — a click in a
// nested portal too (a Select's option list, a modal the dropdown opened), which would unmount
// that modal with the popover. The last pointer-down is remembered (capture phase, so before
// Mantine's listener) and a close that comes with a click inside another overlay is ignored.
let lastDown: { target: EventTarget | null; at: number } = { target: null, at: 0 };
if (typeof document !== 'undefined') {
  for (const ev of ['mousedown', 'touchstart'] as const) {
    document.addEventListener(ev, (e) => { lastDown = { target: e.target, at: performance.now() }; }, true);
  }
}
const NESTED_OVERLAY = '.mantine-Modal-root, .mantine-Drawer-root, .mantine-Combobox-dropdown, .mantine-Popover-dropdown, .mantine-Menu-dropdown, .mantine-Notifications-root, [data-nested-overlay]';
function closeCameFromNestedClick(): boolean {
  if (performance.now() - lastDown.at > 150) return false;
  const t = lastDown.target as Element | null;
  return !!(t && typeof t.closest === 'function' && t.closest(NESTED_OVERLAY));
}

type Side = 'top' | 'right' | 'bottom' | 'left';
type Align = 'start' | 'center' | 'end';

interface Placement { side?: Side; align?: Align; sideOffset?: number; alignOffset?: number; collisionPadding?: number; zIndex?: number }

interface Ctx {
  open: boolean;
  setOpen: (open: boolean) => void;
  setPlacement: (p: Placement) => void;
}
const PopoverCtx = createContext<Ctx | null>(null);
function usePopover(part: string): Ctx {
  const ctx = useContext(PopoverCtx);
  if (!ctx) throw new Error(`<Popover.${part}> must be inside <Popover.Root>`);
  return ctx;
}

function toPosition(side: Side = 'bottom', align: Align = 'center'): FloatingPosition {
  return (align === 'center' ? side : `${side}-${align}`) as FloatingPosition;
}

export interface RootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Root({ open: controlled, defaultOpen = false, onOpenChange, children }: RootProps) {
  const [inner, setInner] = useState(defaultOpen);
  const [placement, setPlacement] = useState<Placement>({});
  const open = controlled ?? inner;
  const setOpen = (next: boolean) => {
    if (!next && open && closeCameFromNestedClick()) return;
    if (controlled === undefined) setInner(next);
    onOpenChange?.(next);
  };
  return (
    <PopoverCtx.Provider value={{ open, setOpen, setPlacement }}>
      <MPopover
        opened={open}
        onChange={setOpen}
        position={toPosition(placement.side, placement.align)}
        offset={{ mainAxis: placement.sideOffset ?? 4, crossAxis: placement.alignOffset ?? 0 }}
        middlewares={{ ...DROPDOWN_MIDDLEWARES, shift: { padding: placement.collisionPadding ?? 8 }, inline: false }}
        withinPortal
        zIndex={placement.zIndex ?? POPOVER_Z}
        unstyled
        trapFocus={false}
        returnFocus
        closeOnEscape
        clickOutsideEvents={['mousedown', 'touchstart']}
      >
        {children}
      </MPopover>
    </PopoverCtx.Provider>
  );
}

/** The element the popover hangs from. Clicking it toggles the popover. */
export function Trigger({ children }: { children: ReactElement; asChild?: boolean }) {
  const { open, setOpen } = usePopover('Trigger');
  return (
    <MPopover.Target>
      {cloneWithToggle(children, () => setOpen(!open))}
    </MPopover.Target>
  );
}

function cloneWithToggle(child: ReactElement, toggle: () => void): ReactElement {
  const own = (child.props as { onClick?: (e: { defaultPrevented?: boolean }) => void }).onClick;
  return cloneElement(child as ReactElement<{ onClick?: unknown }>, {
    onClick: (e: { defaultPrevented?: boolean }) => { own?.(e); if (!e?.defaultPrevented) toggle(); },
  });
}

/** Mantine portals the dropdown itself; kept so Radix-shaped markup still reads the same. */
export function Portal({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export interface ContentProps extends Placement, Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'style'> {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Accepted for Radix parity. Focus is left where it is; autoFocus on an input still works. */
  onOpenAutoFocus?: (e: Event) => void;
  onCloseAutoFocus?: (e: Event) => void;
}

export function Content({
  side, align, sideOffset, alignOffset, collisionPadding, zIndex, className, style, children,
  onOpenAutoFocus: _open, onCloseAutoFocus: _close, ...rest
}: ContentProps) {
  const { setPlacement } = usePopover('Content');
  useLayoutEffect(() => {
    setPlacement({ side, align, sideOffset, alignOffset, collisionPadding, zIndex });
  }, [side, align, sideOffset, alignOffset, collisionPadding, zIndex, setPlacement]);
  return (
    // `unstyled` drops Mantine's own `position: absolute`, without which floating-ui's
    // top/left do nothing and the dropdown lands at the foot of <body>. The max width keeps a
    // fixed-width popover inside a phone screen, where shift alone cannot fit it.
    <MPopover.Dropdown className={className} style={{ position: 'absolute', maxWidth: 'calc(100vw - 16px)', ...style }} {...rest}>
      {children}
    </MPopover.Dropdown>
  );
}

/** Closes the popover when its child is clicked. */
export function Close({ children }: { children: ReactElement; asChild?: boolean }) {
  const { setOpen } = usePopover('Close');
  return cloneWithToggle(children, () => setOpen(false));
}
