/**
 * Long-press (mobile pass, m-shell). Two ways:
 *
 * 1. Things with a right-click menu need nothing new: `{...menuProps('type', target)}` from
 *    `~/app/contextMenu` already opens that menu on a phone long-press (the host listens app-wide),
 *    and now buzzes lightly.
 * 2. A hold that does something else (switch a mode, start a reorder, open a peek):
 *
 *      const hold = useLongPress({ onHold: (p) => …, onTap: () => … });
 *      <button {...hold}>…</button>
 *
 *    `menu: { type, target }` instead of `onHold` opens that registered menu at the finger
 *    (for an element that cannot carry `menuProps`). A finger that moves > 10px is a scroll: neither
 *    fires. After a hold, the click that follows is swallowed. The element gets `data-no-ctx` so the
 *    app-wide host leaves this hold to us, and `-webkit-touch-callout: none` / no text selection.
 */
import { useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { openMenu } from '~/app/contextMenu';
import { haptic } from './haptic';
import { HOLD_MS, holdBroken } from './pullLogic';

export interface LongPressOpts {
  onHold?: (at: { x: number; y: number; el: HTMLElement }) => void;
  onTap?: (e: ReactMouseEvent) => void;
  menu?: { type: string; target: unknown };
  ms?: number;
  /** Mouse holds too (default: touch and pen only). */
  mouse?: boolean;
  disabled?: boolean;
}

const STYLE: CSSProperties = { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' };

export function useLongPress(opts: LongPressOpts) {
  const latest = useRef(opts);
  latest.current = opts;
  const press = useRef<{ x: number; y: number; timer: number; id: number } | null>(null);
  const held = useRef(0);

  const cancel = () => { if (press.current) { clearTimeout(press.current.timer); press.current = null; } };
  useEffect(() => cancel, []);

  return {
    'data-no-ctx': '',
    style: STYLE,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      const o = latest.current;
      if (o.disabled || (e.pointerType === 'mouse' && !o.mouse) || e.button > 0) return;
      cancel();
      const el = e.currentTarget;
      const { clientX: x, clientY: y, pointerId: id } = e;
      press.current = {
        x, y, id,
        timer: window.setTimeout(() => {
          press.current = null;
          held.current = Date.now();
          haptic('hold');
          const cur = latest.current;
          if (cur.menu) openMenu(cur.menu.type, cur.menu.target, { x, y }, { el });
          else cur.onHold?.({ x, y, el });
        }, o.ms ?? HOLD_MS),
      };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const p = press.current;
      if (p && p.id === e.pointerId && holdBroken(e.clientX - p.x, e.clientY - p.y)) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: ReactMouseEvent) => { if (e.nativeEvent.isTrusted && (press.current || Date.now() - held.current < 800)) e.preventDefault(); },
    onClick: (e: ReactMouseEvent) => {
      if (Date.now() - held.current < 800) { e.preventDefault(); e.stopPropagation(); held.current = 0; return; }
      latest.current.onTap?.(e);
    },
  };
}
