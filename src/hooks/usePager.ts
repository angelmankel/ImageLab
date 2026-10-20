import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createVelocityTracker } from '@/lib/momentum';
import { lastInputWasTouch } from '@/lib/inputModality';
import {
  REDUCED_MS, dragOffset, pageOnRelease, slideDistance, spring,
} from '@/lib/pager';

/**
 * The slide track behind the hero and the fullscreen viewer: three slides (previous, current,
 * next) on one element the finger moves 1:1, a spring that settles it, and the sleight of hand
 * that makes an index change — from a release, an arrow key, a tapped thumbnail, a controller —
 * look like one continuous slide.
 *
 * The component renders the slides at `translateX(side * (100% + gap))` inside `trackRef`; this
 * hook only ever writes the track's transform, never React state while a finger moves. When the
 * current key changes it renders the *outgoing* item as a `ghost` on the side it leaves by, jumps
 * the track so that item still sits where it was, and springs the new one into place — so a far
 * jump slides like a neighbour, and a drag release carries its velocity into the settle.
 *
 * Feed it a drag through `drag` (x offsets only; the caller locks the axis), or call `goTo`.
 */
export interface PagerDrag {
  /** The finger is down and this gesture is a page: the track stops any settle and follows. */
  begin: () => void;
  /** The finger has moved `dx` from where it went down. */
  update: (dx: number) => void;
  /** The finger let go; `cancel` snaps back without deciding (a pinch took over). */
  finish: (opts?: { cancel?: boolean }) => void;
}

export interface Pager {
  trackRef: RefObject<HTMLDivElement>;
  /** The item leaving, drawn at `side` instead of the natural neighbour while the slide runs. */
  ghost: { key: string; side: -1 | 1 } | null;
  drag: PagerDrag;
  /** Animate to any index; `dir` forces the way it slides (a wrap-around goes forward). */
  goTo: (i: number, dir?: 1 | -1) => void;
  /** One page over, clamped; true when it moved. */
  step: (dir: 1 | -1) => boolean;
  /** True while a finger or a settle is moving the track. */
  moving: () => boolean;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function usePager({ keys, index, onIndexChange, enabled = true, animate = true, slideOnlyOnDrag = false, onProgress }: {
  keys: readonly string[];
  index: number;
  onIndexChange: (i: number) => void;
  /** Drags move the track; off, only `goTo` / external changes do. */
  enabled?: boolean;
  /** Off, an index change is a plain cut (the slideshow runs its own crossfade). */
  animate?: boolean;
  /**
   * Only a finger's release slides; every other index change (a button, a key, a tapped
   * thumbnail, a new result arriving) is a cut, on touch too. The next UI (Donny, 10-20: no
   * seek animation except a phone swipe; a new image shows at once).
   */
  slideOnlyOnDrag?: boolean;
  /** -1..1: how far the track is towards the next (+) or previous (−) item; 0 when settled. */
  onProgress?: (fraction: number) => void;
}): Pager {
  const trackRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<Pager['ghost']>(null);

  // Everything the imperative handlers read, so they never see a stale render.
  const latest = useRef({ keys, index, onIndexChange, enabled, animate, slideOnlyOnDrag, onProgress });
  latest.current = { keys, index, onIndexChange, enabled, animate, slideOnlyOnDrag, onProgress };

  const offset = useRef(0);
  const raf = useRef(0);
  const dragging = useRef(false);
  const velocity = useRef(createVelocityTracker());
  /** Set by a release that paged, read by the layout effect when the new index renders. */
  const pending = useRef<{ dir: 1 | -1; v: number; drag?: boolean } | null>(null);
  const lastKey = useRef<string | undefined>(keys[index]);

  const width = () => trackRef.current?.clientWidth || window.innerWidth;

  const write = (x: number) => {
    offset.current = x;
    const el = trackRef.current;
    if (el) el.style.transform = x === 0 ? '' : `translate3d(${x}px, 0, 0)`;
    latest.current.onProgress?.(x === 0 ? 0 : -x / slideDistance(width()));
  };

  const stopSettle = () => { if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; } };

  const settled = () => {
    const el = trackRef.current;
    if (el) el.style.willChange = '';
    write(0);
    setGhost(null);
  };

  /** Spring the track from where it is to 0 with velocity `v` (px/ms). */
  const settle = (v: number) => {
    stopSettle();
    if (offset.current === 0) { settled(); return; }
    const el = trackRef.current;
    if (el) el.style.willChange = 'transform';
    const s = spring(offset.current, v);
    const t0 = performance.now();
    const tick = (now: number) => {
      const st = s(now - t0);
      write(st.x);
      if (st.done) { raf.current = 0; settled(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  // The current key changed: show the change as a slide (unless a drag is still in progress, or
  // the item simply disappeared from the list).
  const curKey = keys[index];
  useLayoutEffect(() => {
    const prev = lastKey.current;
    lastKey.current = curKey;
    if (prev === undefined || curKey === undefined || prev === curKey) { pending.current = null; return; }
    const el = trackRef.current;
    const was = pending.current;
    pending.current = null;
    let dir: 1 | -1;
    let v = 0;
    if (was) { dir = was.dir; v = was.v; }
    else {
      const oldIdx = keys.indexOf(prev);
      if (oldIdx === -1 || oldIdx === index) { stopSettle(); settled(); return; } // deleted: just show the new one
      dir = index > oldIdx ? 1 : -1;
    }
    if (!el) return;
    // A drag always lands smoothly; any other change (keys, wheel, a click, the controller) slides
    // only for touch and cuts on a desktop.
    if (!latest.current.animate || (!was?.drag && (latest.current.slideOnlyOnDrag || !lastInputWasTouch()))) { stopSettle(); settled(); return; }
    if (reducedMotion()) {
      stopSettle();
      settled();
      el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: REDUCED_MS, easing: 'ease-out' });
      return;
    }
    // The new current renders at 0; the old one is now the ghost one slide over. Shift the track so
    // the old one has not moved yet, then let the spring bring the new one in.
    setGhost({ key: prev, side: (-dir) as -1 | 1 });
    stopSettle();
    write(offset.current + dir * slideDistance(width()));
    settle(v);
  }, [curKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // A forced direction (wrap-around) rides along with the index change.
  const goTo = useCallback((i: number, dir?: 1 | -1) => {
    const { keys: ks, index: cur, onIndexChange: change } = latest.current;
    if (i === cur || !ks[i]) return;
    pending.current = { dir: dir ?? (i > cur ? 1 : -1), v: 0 };
    change(i);
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    const { keys: ks, index: cur } = latest.current;
    const i = cur + dir;
    if (!ks[i]) return false;
    goTo(i, dir);
    return true;
  }, [goTo]);

  const drag = useRef<PagerDrag>({
    begin: () => {
      if (!latest.current.enabled) return;
      stopSettle();
      dragging.current = true;
      velocity.current.reset(offset.current, 0);
      const el = trackRef.current;
      if (el) el.style.willChange = 'transform';
    },
    update: (dx) => {
      if (!dragging.current) return;
      const { keys: ks, index: cur } = latest.current;
      const x = dragOffset(dx, cur, ks.length, width());
      write(x);
      velocity.current.sample(x, 0);
    },
    finish: (opts) => {
      if (!dragging.current) return;
      dragging.current = false;
      const { keys: ks, index: cur, onIndexChange: change } = latest.current;
      const v = velocity.current.release().x;
      const target = opts?.cancel ? cur : pageOnRelease(offset.current, v, width(), cur, ks.length);
      if (target === cur) { settle(v); return; }
      pending.current = { dir: target > cur ? 1 : -1, v, drag: true };
      change(target);
      // The owner did not take the change (nothing re-rendered): settle back where we were.
      requestAnimationFrame(() => { if (pending.current) { pending.current = null; settle(v); } });
    },
  }).current;

  const moving = useCallback(() => dragging.current || raf.current !== 0, []);

  return { trackRef, ghost, drag, goTo, step, moving };
}

/**
 * Pointer plumbing for a pager on an element the user can swipe directly (the hero): a touch, or
 * a mouse drag, that moves mostly sideways past the lock distance drives `pager.drag`. A drag that
 * ends on the element swallows the click so a swipe never also opens the result. Nothing starts on
 * a button, a text box or anything marked `data-no-swipe`.
 */
export function bindPagerPointer(root: HTMLElement, drag: PagerDrag, lock: (dx: number, dy: number) => 'x' | 'y' | null): () => void {
  let start: { id: number; x: number; y: number } | null = null;
  let axis: 'x' | 'y' | null = null;
  let swallow = false;
  const OWN = 'button, a, input, textarea, select, [role="slider"], [data-no-swipe]';

  const down = (e: PointerEvent) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const target = e.target as Element | null;
    if (target?.closest(OWN)) return;
    // A mouse on a video is for its controls.
    if (e.pointerType === 'mouse' && target?.tagName === 'VIDEO') return;
    start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    axis = null;
  };
  const move = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id || axis === 'y') return;
    const dx = e.clientX - start.x;
    if (!axis) {
      axis = lock(dx, e.clientY - start.y);
      if (axis !== 'x') return;
      try { root.setPointerCapture(e.pointerId); } catch { /* the pointer may be gone */ }
      drag.begin();
    }
    e.preventDefault();
    drag.update(dx);
  };
  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    if (axis === 'x') {
      drag.finish({ cancel: e.type === 'pointercancel' });
      swallow = true;
      setTimeout(() => { swallow = false; }, 0);
    }
    start = null;
    axis = null;
  };
  const click = (e: MouseEvent) => {
    if (swallow) { e.preventDefault(); e.stopPropagation(); }
  };
  // A native image drag would steal the gesture from a mouse.
  const dragstart = (e: Event) => e.preventDefault();

  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('click', click, true);
  root.addEventListener('dragstart', dragstart);
  return () => {
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', up);
    root.removeEventListener('click', click, true);
    root.removeEventListener('dragstart', dragstart);
  };
}
