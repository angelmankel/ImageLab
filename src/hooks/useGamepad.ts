/**
 * Controller polling, for a desk or a phone clipped into a gamepad.
 *
 * The Gamepad API has no event for button presses — only a snapshot you poll — so this runs a
 * rAF loop while a pad is connected and turns edges into callbacks. It idles completely when no
 * pad is attached: the loop is not even started until a `gamepadconnected` event arrives, so a
 * phone with no controller pays nothing.
 *
 * Every connected pad is read at once and merged (`readPads` in `lib/gamepad.ts`), so whichever
 * pad is pressed works, and a Joy-Con pair that Android reports as two pads acts as one. The left
 * stick is a repeating d-pad rather than a cursor: nudging a value is what a stick is for here.
 */
import { useEffect, useRef, useState } from 'react';
import { isDir, padFamily, readPads, stickDirs, type PadFamily, type PadKey, type PadSnapshot, type Stick } from '@/lib/gamepad';

/** Hold-to-repeat, matching a key repeat: a long first gap, then quick ones. */
const REPEAT_FIRST_MS = 420, REPEAT_NEXT_MS = 90;

export interface PadPress {
  key: PadKey;
  /** A held direction firing again. */
  repeat: boolean;
  /** Everything held at the moment, this key included (for ZL / ZR as a modifier). */
  held: ReadonlySet<PadKey>;
}

export interface GamepadHandlers {
  /** A button went down. Repeats are delivered for directions only. */
  onPress?: (press: PadPress) => void;
  onRelease?: (key: PadKey) => void;
  /** Every frame while a pad is connected: the right stick, and the ms since the last frame. */
  onFrame?: (scroll: Stick, dt: number) => void;
}

export interface GamepadState {
  connected: boolean;
  /** The pad pressed last, or the first one connected: whose labels the help shows. */
  family: PadFamily | null;
  id: string | null;
}

const NONE: GamepadState = { connected: false, family: null, id: null };

function snapshot(): PadSnapshot[] {
  const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const out: PadSnapshot[] = [];
  for (const p of list) if (p && p.connected !== false) out.push(p);
  return out;
}

/** Handlers are read through a ref, so passing fresh closures every render is fine. */
export function useGamepad(handlers: GamepadHandlers, enabled = true): GamepadState {
  const [state, setState] = useState<GamepadState>(NONE);
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const android = /android/i.test(navigator.userAgent);

    let raf = 0;
    let running = false;
    let last = 0;
    let shown: GamepadState = NONE;
    const down = new Map<PadKey, number>();   // key → when it next repeats
    const show = (next: GamepadState) => {
      if (next.connected !== shown.connected || next.family !== shown.family || next.id !== shown.id) { shown = next; setState(next); }
    };

    const poll = () => {
      const pads = snapshot();
      const now = performance.now();
      const { keys, move, scroll, readings } = readPads(pads, android);
      for (const d of stickDirs(move)) keys.add(d);

      for (const key of keys) {
        const next = down.get(key);
        if (next === undefined) {
          const repeatable = isDir(key);
          down.set(key, repeatable ? now + REPEAT_FIRST_MS : Number.POSITIVE_INFINITY);
          ref.current.onPress?.({ key, repeat: false, held: keys });
        } else if (now >= next) {
          down.set(key, now + REPEAT_NEXT_MS);
          ref.current.onPress?.({ key, repeat: true, held: keys });
        }
      }
      for (const key of [...down.keys()]) {
        if (!keys.has(key)) { down.delete(key); ref.current.onRelease?.(key); }
      }

      // The labels follow the pad that was pressed last.
      const active = readings.findIndex(r => r.keys.size > 0);
      if (active >= 0) show({ connected: true, family: readings[active].family, id: pads[active].id });
      else if (!shown.connected && pads.length) show({ connected: true, family: readings[0].family, id: pads[0].id });

      ref.current.onFrame?.(scroll, last ? now - last : 16);
      last = now;
      raf = requestAnimationFrame(poll);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      const first = snapshot()[0];
      show({ connected: true, family: first ? padFamily(first.id) : null, id: first?.id ?? null });
      raf = requestAnimationFrame(poll);
    };
    const stop = () => {
      if (snapshot().length) return;
      running = false;
      cancelAnimationFrame(raf);
      for (const key of down.keys()) ref.current.onRelease?.(key);
      down.clear();
      show(NONE);
    };

    window.addEventListener('gamepadconnected', start);
    window.addEventListener('gamepaddisconnected', stop);
    // A pad paired before the page loaded reports nothing until it is touched, but Chrome does
    // list it — so check once rather than waiting for an event that already happened.
    if (snapshot().length) start();

    return () => {
      window.removeEventListener('gamepadconnected', start);
      window.removeEventListener('gamepaddisconnected', stop);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  return state;
}
