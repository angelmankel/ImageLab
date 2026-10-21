/**
 * The phone's frame (mobile pass, m-shell; Donny 10-21): STACKED CARDS. Depth is vertical.
 *
 *   Portrait                              Landscape
 *   ┌ parent, pushed back, peeking ──┐    ┌ parent ──────┬ card ─────────┬ band ┐
 *   ├╭ card (the top layer) ────────╮┤    │ (stays live: │╭─────────────╮│  ⋯   │
 *   ││ ▬ grabber · title            ││    │  tap another ││ ▬ title     ││  ◉   │
 *   ││ …scrolls up / down…          ││    │  item = swap ││ …           ││  ⚡  │
 *   ├┴ band: ‹ parent · ◉ · action ─┴┤    └──────────────┴┴─────────────┴┴──────┘
 *
 * - Going deeper (`push`): the new layer slides UP over the last like a card; the layer behind
 *   shrinks back a little and peeks out above it.
 * - Back out one layer: pull the card DOWN (only when it is scrolled to its top; otherwise the
 *   pull scrolls), tap the peeking layer behind, or "‹ parent" in the band.
 * - Sideways swipes are never ours: they stay free for in-layer moves (previous / next step …).
 * - Every layer in the stack stays mounted (scroll, inputs, tabs survive going in and out and a
 *   rotation); layers under the top two are skipped by the renderer (`content-visibility`).
 * - Landscape: a layer and its parent sit side by side when both allow it (`pair`), the card
 *   sliding up in the right pane; else full width.
 * - `position: fixed` inside a layer is held inside it (the band is never covered).
 * Motion follows Settings → Themes → Motion (`motionScale()`); off = no slide, gestures still work.
 */
import { useEffect, useLayoutEffect, useReducer, useRef, type CSSProperties } from 'react';
import { motionScale } from '~/theme/motion';
import { toCssPx } from '~/theme/uiScale';
import { usePhoneLandscape } from '~/app/useFormFactor';
import { haptic } from '../haptic';
import { closeDistance, pullAxis, pullCloses, pullOffset } from '../pullLogic';
import { PageCtx } from './band';
import { siblingForSwipe, transitionOf, visiblePages, type NavPage } from './navLogic';
import { kindPairs, onPhonePagesChange, pageTitle, phonePageDef, siblingsOf } from './pages';
import { swipeCommits } from '@/lib/swipe';
import { flashMap } from './MapDots';
import { phoneNav, setPopAnimator, startNavBridge, usePhoneNav } from './navStore';
import { PhoneBand } from './Band';
import { useNavFrame } from './frameFlag';
import './nav.css';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SLIDE_MS = 320;
/** How a layer looks when a card sits on it (kept in step with nav.css [data-role="under"]). */
const BACK = 'var(--il-pmap-back)';
export const PAIR_LEFT = 'clamp(280px, 40%, 420px)';

type Role = 'main' | 'left' | 'under' | 'hidden';

const SIB_GAP = 16;

/** True when a sideways scroller between the touch and the card can still move the finger's way (it keeps the swipe). */
function scrollsSideways(from: Element | null, card: Element, fingerDir: 1 | -1): boolean {
  for (let el = from; el && el !== card; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const o = getComputedStyle(el).overflowX;
      if (o !== 'auto' && o !== 'scroll') continue;
      const max = el.scrollWidth - el.clientWidth;
      // finger right shows what is left of it; past the end the page takes over
      if (fingerDir > 0 ? el.scrollLeft > 1 : el.scrollLeft < max - 1) return true;
    }
  }
  return false;
}

/** A touch that starts on one of these never pulls the card. */
const OWN = 'input, textarea, select, [contenteditable="true"], [role="slider"], .mantine-Slider-root, .mantine-RangeSlider-root, [data-no-pull], [data-no-swipe]';

/** True when something between the touch and the card can still scroll up (the pull scrolls it). */
function scrolledDown(from: Element | null, card: Element): boolean {
  for (let el = from; el && el !== card; el = el.parentElement) {
    if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight + 1) {
      const o = getComputedStyle(el).overflowY;
      if (o === 'auto' || o === 'scroll') return true;
    }
  }
  return false;
}

function CardHead({ page }: { page: NavPage }) {
  return (
    <div className="il-pmap-head">
      <span aria-hidden className="il-pmap-grab" />
      <div className="il-pmap-title">{pageTitle(page)}</div>
    </div>
  );
}

function PageFrame({ page, index, role, paired, setEl }: {
  page: NavPage; index: number; role: Role; paired: boolean; setEl: (key: string, el: HTMLDivElement | null) => void;
}) {
  const def = phonePageDef(page.kind);
  const C = def?.Component;
  const style: CSSProperties = role === 'left' ? { left: 0, width: PAIR_LEFT } : paired ? { left: PAIR_LEFT, right: 0 } : { left: 0, right: 0 };
  const card = index > 0;
  return (
    <div ref={(el) => setEl(page.key, el)} className="il-pmap-page" data-role={role} data-kind={page.kind}
      data-card={card || undefined} data-paired={paired || undefined} style={style}
      aria-hidden={role === 'hidden' || role === 'under' ? true : undefined}>
      <div className="il-pmap-page-in">
        {card && (def?.header ?? true) && <CardHead page={page} />}
        <div className="il-pmap-page-body">
          <PageCtx.Provider value={{ page, index }}>
            {C ? <C params={(page.params ?? {}) as never} page={page} /> : <div style={{ padding: 16, color: 'var(--il-muted)' }}>{page.kind}</div>}
          </PageCtx.Provider>
        </div>
      </div>
    </div>
  );
}

export function NavHost() {
  const stack = usePhoneNav((s) => s.stack);
  const motion = usePhoneNav((s) => s.motion);
  const land = usePhoneLandscape();
  const [, force] = useReducer((x: number) => x + 1, 0);
  const area = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const setEl = (key: string, el: HTMLDivElement | null) => { if (el) els.current.set(key, el); else els.current.delete(key); };
  const busy = useRef(false);
  const latest = useRef({ stack, land });
  latest.current = { stack, land };

  useEffect(() => onPhonePagesChange(force), []);
  useLayoutEffect(() => startNavBridge(), []);
  useLayoutEffect(() => { useNavFrame.setState({ on: true }); return () => useNavFrame.setState({ on: false }); }, []);

  const vis = visiblePages(stack, land, kindPairs);
  const paired = vis.left != null;
  const roleOf = (p: NavPage, i: number): Role => {
    if (p.key === vis.main.key) return 'main';
    if (vis.left && p.key === vis.left.key) return 'left';
    if (i === stack.length - 2) return 'under';
    return 'hidden';
  };
  const parent = stack.length > 1 ? stack[stack.length - 2] : null;

  const clear = (...list: Array<HTMLElement | undefined>) => {
    for (const el of list) {
      if (!el) continue;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.transform = ''; el.style.opacity = ''; el.style.transition = ''; el.style.filter = '';
    }
  };

  // Push: the new card slides up; the layer it covers steps back.
  const prevStack = useRef(stack);
  useLayoutEffect(() => {
    const prev = prevStack.current;
    prevStack.current = stack;
    const t = transitionOf(prev, stack);
    const k = motionScale();
    if (t !== 'push' || motion !== 'auto' || k <= 0) return;
    const top = els.current.get(stack[stack.length - 1].key);
    const was = els.current.get(prev[prev.length - 1].key);
    if (!top) return;
    const ms = SLIDE_MS * k;
    top.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: ms, easing: EASE });
    if (was && !paired) was.animate([{ transform: 'none', filter: 'none' }, { transform: BACK, filter: 'brightness(.6)' }], { duration: ms, easing: EASE });
  }, [stack]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pop: the card slides down first, then the stack changes.
  useEffect(() => setPopAnimator((prev, next, commit) => {
    const k = motionScale();
    if (busy.current || k <= 0) return false;
    const top = els.current.get(prev[prev.length - 1].key);
    const to = els.current.get(next[next.length - 1].key);
    if (!top || !to) return false;
    busy.current = true;
    const ms = SLIDE_MS * k * 0.85;
    const wasPaired = latest.current.land && visiblePages(prev, true, kindPairs).left != null;
    const done = () => { busy.current = false; commit(); requestAnimationFrame(() => clear(top, to)); };
    const a = top.animate([{ transform: getComputedStyle(top).transform === 'none' ? 'none' : getComputedStyle(top).transform }, { transform: 'translateY(100%)' }], { duration: ms, easing: EASE, fill: 'forwards' });
    if (!wasPaired) to.animate([{ transform: BACK, filter: 'brightness(.6)', visibility: 'visible' }, { transform: 'none', filter: 'none', visibility: 'visible' }], { duration: ms, easing: EASE, fill: 'forwards' });
    a.onfinish = done; a.oncancel = done;
    return true;
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // One gesture, two axes (locked by the first ~10 px): pull the card DOWN from its top = out one
  // layer; swipe it SIDEWAYS = the previous / next sibling (the page follows the finger and snaps).
  useEffect(() => {
    const root = area.current;
    if (!root) return;
    type G = {
      id: number; x: number; y: number; t: number; card: HTMLDivElement; target: Element;
      lock: 'pull' | 'x' | null; snapped: boolean; h: number; w: number; canPull: boolean; canSide: boolean;
      sib: { index: number; count: number } | null;
    };
    let g: G | null = null;

    const onStart = (e: TouchEvent) => {
      g = null;
      const s = latest.current.stack;
      if (busy.current || e.touches.length !== 1) return;
      const top = s[s.length - 1];
      const card = els.current.get(top.key);
      const target = e.target as Element;
      if (!card || !card.contains(target) || target.closest?.(OWN)) return;
      const sib = siblingsOf(top);
      const canPull = s.length > 1 && !scrolledDown(target, card);
      if (!canPull && !sib) return;
      const t = e.touches[0];
      const r = card.getBoundingClientRect();
      g = { id: t.identifier, x: t.clientX, y: t.clientY, t: performance.now(), card, target, lock: null, snapped: false,
        h: toCssPx(r.height), w: toCssPx(r.width), canPull, canSide: !!sib, sib: sib ? { index: sib.index, count: sib.count } : null };
    };
    const neighbour = (dir: 1 | -1) => root.querySelector<HTMLElement>(`[data-sib="${dir > 0 ? 'next' : 'prev'}"]`);
    const sideOffset = (dx: number) => {
      const cur = g!;
      const target = siblingForSwipe(cur.sib!.index, cur.sib!.count, dx > 0 ? 1 : -1);
      return target == null ? dx * 0.25 : dx;
    };
    const onMove = (e: TouchEvent) => {
      if (!g) return;
      const t = Array.from(e.changedTouches).find((x) => x.identifier === g!.id);
      if (!t) return;
      const dx = toCssPx(t.clientX - g.x); const dy = toCssPx(t.clientY - g.y);
      if (!g.lock) {
        if (Math.hypot(dx, dy) < 10) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.2) {
          // an inner sideways scroller that can still move this way keeps the swipe
          if (!g.canSide || scrollsSideways(g.target, g.card, dx > 0 ? 1 : -1)) { g = null; return; }
          g.lock = 'x';
          for (const d of [1, -1] as const) { const n = neighbour(d); if (n) n.dataset.reveal = ''; }
          flashMap();
        } else if (dy > 0 && g.canPull && pullAxis(dy, dx) === 'pull') {
          g.lock = 'pull';
        } else { g = null; return; }
      }
      if (e.cancelable) e.preventDefault();
      if (g.lock === 'pull') {
        g.card.style.transition = 'none';
        g.card.style.transform = `translate3d(0, ${pullOffset(dy)}px, 0)`;
        const far = dy >= closeDistance(g.h);
        if (far !== g.snapped) { g.snapped = far; if (far) haptic('snap'); }
      } else {
        const off = sideOffset(dx);
        g.card.style.transition = 'none';
        g.card.style.transform = `translate3d(${off}px, 0, 0)`;
        for (const d of [1, -1] as const) {
          const n = neighbour(d);
          if (n) { n.style.transition = 'none'; n.style.transform = `translate3d(${d * (g.w + SIB_GAP) + off}px, 0, 0)`; }
        }
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (!g) return;
      const t = Array.from(e.changedTouches).find((x) => x.identifier === g!.id);
      if (!t) return;
      const cur = g; g = null;
      const ms = Math.max(140, 240 * motionScale());
      if (cur.lock === 'pull') {
        const dy = toCssPx(t.clientY - cur.y);
        if (e.type === 'touchend' && pullCloses(dy, performance.now() - cur.t, cur.h)) {
          cur.card.style.transition = '';
          phoneNav.pop(); // the pop animator slides it the rest of the way from where it is
          if (motionScale() <= 0) requestAnimationFrame(() => clear(cur.card));
        } else {
          cur.card.style.transition = `transform ${ms}ms ${EASE}`;
          cur.card.style.transform = '';
          window.setTimeout(() => clear(cur.card), ms);
        }
        return;
      }
      if (cur.lock !== 'x' || !cur.sib) return;
      const dx = toCssPx(t.clientX - cur.x);
      const dir: 1 | -1 = dx > 0 ? 1 : -1;
      const target = siblingForSwipe(cur.sib.index, cur.sib.count, dir);
      const go = e.type === 'touchend' && target != null && swipeCommits(dx, performance.now() - cur.t, cur.w, dir);
      const n = neighbour(dir === 1 ? -1 : 1); // finger right → the previous one comes in from the left
      const other = neighbour(dir);
      const ease = `transform ${ms}ms ${EASE}`;
      cur.card.style.transition = ease;
      if (n) n.style.transition = ease;
      if (go) {
        cur.card.style.transform = `translate3d(${dir * (cur.w + SIB_GAP)}px, 0, 0)`;
        if (n) n.style.transform = 'translate3d(0, 0, 0)';
        busy.current = true;
        haptic('tick');
        window.setTimeout(() => {
          busy.current = false;
          phoneNav.sibling(target!);
          requestAnimationFrame(() => { clear(cur.card, n ?? undefined, other ?? undefined); for (const d of [1, -1] as const) delete neighbour(d)?.dataset.reveal; });
        }, ms);
      } else {
        cur.card.style.transform = '';
        if (n) n.style.transform = '';
        window.setTimeout(() => { clear(cur.card, n ?? undefined, other ?? undefined); for (const d of [1, -1] as const) delete neighbour(d)?.dataset.reveal; }, ms);
      }
    };
    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The neighbours a sideways swipe drags in (cheap previews; the real page mounts when it lands).
  const topPage = stack[stack.length - 1];
  const sib = siblingsOf(topPage);
  const sibRefs = sib ? { prev: sib.index > 0 ? sib.at(sib.index - 1) : null, next: sib.index < sib.count - 1 ? sib.at(sib.index + 1) : null } : null;
  const mainStyle: CSSProperties = paired ? { left: PAIR_LEFT, right: 0 } : { left: 0, right: 0 };

  return (
    <div className="il-pmap" data-land={land || undefined}>
      <div ref={area} className="il-pmap-area">
        {stack.map((p, i) => <PageFrame key={p.key} page={p} index={i} role={roleOf(p, i)} paired={paired && p.key === vis.main.key} setEl={setEl} />)}
        {sibRefs && (['prev', 'next'] as const).map((k) => {
          const r = sibRefs[k];
          if (!r) return null;
          const P = phonePageDef(r.kind)?.Peek;
          return (
            <div key={k} data-sib={k} className="il-pmap-page il-pmap-sib" data-card={stack.length > 1 || undefined} data-paired={paired || undefined}
              style={{ ...mainStyle, transform: `translateX(calc(${k === 'next' ? 1 : -1} * (100% + ${SIB_GAP}px)))` }} aria-hidden>
              <div className="il-pmap-page-in">
                {stack.length > 1 && <CardHead page={{ key: k, ...r }} />}
                <div className="il-pmap-page-body">
                  {P ? <P params={(r.params ?? {}) as never} page={{ key: k, ...r }} /> : <div className="il-pmap-sib-blank">{pageTitle(r)}</div>}
                </div>
              </div>
            </div>
          );
        })}
        {parent && !paired && (
          <button type="button" className="il-pmap-peek" aria-label={`Back to ${pageTitle(parent)}`} onClick={() => phoneNav.pop()}>
            <span className="il-pmap-peek-label">‹ {pageTitle(parent)}</span>
          </button>
        )}
      </div>
      <PhoneBand landscape={land} />
    </div>
  );
}
