/**
 * Hover info for a grid tile. Unlike a HoverCard, it follows only the tile: it opens after a short
 * delay while the pointer is over the tile and closes the moment the pointer leaves it. The card
 * itself ignores the pointer, so it never holds itself open and never blocks the tile beside it.
 */
import { cloneElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Popover, type FloatingPosition } from '@mantine/core';
import { POPOVER_Z } from './popover';

interface TileHoverProps {
  /** The tile. Must accept mouse enter/leave handlers. */
  children: ReactElement<{ onMouseEnter?: (e: unknown) => void; onMouseLeave?: (e: unknown) => void }>;
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

  const own = children.props;
  const target = cloneElement(children, {
    onMouseEnter: (e: unknown) => {
      own.onMouseEnter?.(e);
      if (disabled) return;
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
