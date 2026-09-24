/**
 * Hover info for a grid tile. Unlike a HoverCard, it follows only the tile: it opens after a short
 * delay while the pointer is over the tile and closes the moment the pointer leaves it. The card
 * itself ignores the pointer, so it never holds itself open and never blocks the tile beside it.
 *
 * Touch never opens it: a tap sends a fake mouseenter with no mouseleave after it, so the card
 * would stick until the next tap somewhere else. The tile's own tap does the real work.
 */
import { cloneElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Popover, type FloatingPosition } from '@mantine/core';
import { POPOVER_Z } from './popover';

interface TileHoverProps {
  /** The tile. Must accept mouse enter/leave handlers. */
  children: ReactElement<{ onMouseEnter?: (e: unknown) => void; onMouseLeave?: (e: unknown) => void; onTouchStart?: (e: unknown) => void }>;
  content: ReactNode;
  width?: number;
  position?: FloatingPosition;
  openDelay?: number;
  /** Hide the card (e.g. while the tile is being dragged). */
  disabled?: boolean;
}

export function TileHover({ children, content, width = 300, position = 'right', openDelay = 400, disabled }: TileHoverProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  useEffect(() => { if (disabled) { clear(); setOpen(false); } }, [disabled]);
  // The compatibility mouseenter a tap fires lands well inside this window after touchstart.
  const lastTouch = useRef(0);

  const own = children.props;
  const target = cloneElement(children, {
    onTouchStart: (e: unknown) => {
      own.onTouchStart?.(e);
      lastTouch.current = Date.now();
      clear();
      setOpen(false);
    },
    onMouseEnter: (e: unknown) => {
      own.onMouseEnter?.(e);
      if (disabled || Date.now() - lastTouch.current < 1500) return;
      clear();
      timer.current = setTimeout(() => setOpen(true), openDelay);
    },
    onMouseLeave: (e: unknown) => {
      own.onMouseLeave?.(e);
      clear();
      setOpen(false);
    },
  });

  return (
    <Popover opened={open && !disabled} position={position} width={width} shadow="lg" withinPortal zIndex={POPOVER_Z} offset={8}
      middlewares={{ flip: true, shift: { padding: 8 } }}>
      <Popover.Target>{target}</Popover.Target>
      <Popover.Dropdown style={{ pointerEvents: 'none' }}>{content}</Popover.Dropdown>
    </Popover>
  );
}
