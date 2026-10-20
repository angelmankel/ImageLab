/**
 * The DOM side of the viewer's open and close: where a result is on the page (the hero, a strip
 * thumbnail, a gallery tile — anything marked `data-viewer-origin="<key>"`), so the fullscreen copy
 * can grow out of that spot and shrink back into it; and the one open viewer's next / previous /
 * close, for the controller (`features/gamepad/padViewer`) and anything else that wants the same
 * animated transitions a finger gets. The maths is `lib/flip.ts`.
 */
import { REDUCED_MS } from '@/lib/pager';
import { fitRect, flipFrom, flipTransform, visibleRect, type Rect, type Size } from '@/lib/flip';

export const OPEN_MS = 200;
export const CLOSE_MS = 200;
/** A decelerating ease: fast out of the gate, soft landing (like a spring without the overshoot). */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** How long the open waits for the picture's bitmap before growing it anyway. */
const DECODE_CAP_MS = 150;

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const rectOf = (el: Element): Rect => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
const viewport = (): Size => ({ w: window.innerWidth, h: window.innerHeight });

/** The natural size of the picture an element shows, if it has one loaded. */
function naturalSize(el: Element): Size | null {
  if (el instanceof HTMLImageElement && el.naturalWidth) return { w: el.naturalWidth, h: el.naturalHeight };
  if (el instanceof HTMLVideoElement && el.videoWidth) return { w: el.videoWidth, h: el.videoHeight };
  const inner = el.querySelector('img, video');
  return inner && inner !== el ? naturalSize(inner) : null;
}

export interface Origin { rect: Rect; natural: Size | null }

/**
 * Where the result with `key` is painted on the page right now: the largest visible element
 * marked with it (the hero beats its own thumbnail), as the picture's painted rect — letterboxed
 * for `object-fit: contain`, overflowing for `cover` — so the fullscreen copy keeps its aspect.
 */
export function findOrigin(key: string): Origin | null {
  if (typeof document === 'undefined') return null;
  const vp = viewport();
  let best: { el: Element; rect: Rect; area: number } | null = null;
  for (const el of document.querySelectorAll(`[data-viewer-origin="${CSS.escape(key)}"]`)) {
    const rect = rectOf(el);
    if (!visibleRect(rect, vp)) continue;
    const area = rect.w * rect.h;
    if (!best || area > best.area) best = { el, rect, area };
  }
  if (!best) return null;
  const media = best.el.matches('img, video') ? best.el : best.el.querySelector('img, video') ?? best.el;
  const natural = naturalSize(media);
  const fit = getComputedStyle(media).objectFit === 'cover' ? 'cover' : 'contain';
  return { rect: fitRect(natural, rectOf(media), fit), natural };
}

/** The transform that lays `slide` (a full-viewport box showing `natural` contained) over `origin`. */
export function transformToOrigin(slide: HTMLElement, origin: Origin, natural: Size | null): string {
  const painted = fitRect(natural ?? origin.natural, rectOf(slide), 'contain');
  return flipTransform(flipFrom(origin.rect, painted));
}

/**
 * Resolves once the picture inside `el` has a decoded bitmap, or after `capMs` so a slow decode
 * (a 2048px PNG on a phone) never holds the tap for long. A freshly mounted `<img>` of a cached
 * URL has its bytes but not necessarily its pixels: animating it before `decode()` grows a blank
 * box that pops in mid-flight. Videos and already-decoded images resolve within a frame.
 */
export function whenDecoded(el: Element, capMs = DECODE_CAP_MS): Promise<void> {
  const img = el instanceof HTMLImageElement ? el : el.querySelector('img');
  if (!img || typeof img.decode !== 'function') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, capMs);
    img.decode().catch(() => undefined).then(() => { clearTimeout(t); resolve(); });
  });
}

/**
 * Grow `slide` out of its origin while `backdrop` fades in; a plain fade when there is no origin
 * on screen or motion is reduced. Resolves when the picture is in place.
 *
 * `decode`: hold everything invisible until the slide's picture is decoded (`whenDecoded`), then
 * measure the origin and start — the picture is drawn from its first frame. `cancelled` is polled
 * after the hold so a viewer closed meanwhile never starts its open.
 */
export function animateOpen(slide: HTMLElement, backdrop: HTMLElement | null, chrome: HTMLElement[], key: string, natural: Size | null, opts: { decode?: boolean; cancelled?: () => boolean } = {}): Promise<void> {
  const start = (): Promise<void> => {
    const origin = reducedMotion() ? null : findOrigin(key);
    const ms = reducedMotion() ? REDUCED_MS : OPEN_MS;
    const anims: Animation[] = [];
    if (backdrop) anims.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease-out' }));
    for (const c of chrome) anims.push(c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms * 0.6, delay: ms * 0.4, easing: 'ease-out', fill: 'backwards' }));
    if (origin) {
      slide.style.transformOrigin = '0 0';
      anims.push(slide.animate([{ transform: transformToOrigin(slide, origin, natural) }, { transform: 'none' }], { duration: ms, easing: EASE_OUT }));
    } else {
      anims.push(slide.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: ms, easing: EASE_OUT }));
    }
    return Promise.all(anims.map(a => a.finished.catch(() => undefined))).then(() => undefined);
  };
  if (!opts.decode) return start();
  const held = [slide, backdrop, ...chrome].filter((el): el is HTMLElement => !!el);
  for (const el of held) el.style.opacity = '0';
  return whenDecoded(slide).then(() => {
    if (opts.cancelled?.()) return;
    for (const el of held) el.style.opacity = '';
    return start();
  });
}

/**
 * Shrink `slide` back into its origin (or drop it away when there is none) from wherever it is
 * now (`fromTransform`, e.g. mid pull-down) while the backdrop and chrome fade. Resolves when done.
 */
export function animateClose(slide: HTMLElement, backdrop: HTMLElement | null, chrome: HTMLElement[], key: string, natural: Size | null, fromTransform = 'none', fromBackdrop = 1): Promise<void> {
  const origin = reducedMotion() ? null : findOrigin(key);
  const ms = reducedMotion() ? REDUCED_MS : CLOSE_MS;
  const anims: Animation[] = [];
  if (backdrop) anims.push(backdrop.animate([{ opacity: fromBackdrop }, { opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' }));
  for (const c of chrome) anims.push(c.animate([{ opacity: getComputedStyle(c).opacity }, { opacity: 0 }], { duration: ms / 2, easing: 'ease-out', fill: 'forwards' }));
  slide.style.transformOrigin = '0 0';
  if (origin) {
    // The ease-out drives the motion only; the hand-over fade at the end runs linear, so the
    // picture never sits on its thumbnail in the ease's slow tail.
    const to = transformToOrigin(slide, origin, natural);
    anims.push(slide.animate(
      [{ transform: fromTransform, opacity: 1, easing: EASE_OUT }, { transform: to, opacity: 1, offset: 0.85, easing: 'linear' }, { transform: to, opacity: 0 }],
      { duration: ms, fill: 'forwards' },
    ));
  } else {
    anims.push(slide.animate(
      [{ transform: fromTransform, opacity: 1 }, { transform: `${fromTransform === 'none' ? '' : fromTransform} translateY(40px) scale(0.9)`, opacity: 0 }],
      { duration: ms, easing: EASE_OUT, fill: 'forwards' },
    ));
  }
  return Promise.all(anims.map(a => a.finished.catch(() => undefined))).then(() => undefined);
}

// ── The open viewer, for the controller ─────────────────────────────────────

export interface ViewerHandle {
  /** Previous (-1) / next (+1), animated; false when there is nowhere to go. */
  step: (dir: 1 | -1) => boolean;
  /** Animated close; the owner's `onClose` runs when it is done. */
  close: () => void;
}

const handles: ViewerHandle[] = [];

/** The topmost open viewer's actions, or null when none is open. */
export const activeViewer = (): ViewerHandle | null => handles[handles.length - 1] ?? null;

/** `<html data-viewer-open>` while any viewer is up: stylesheets can drop costly effects under it. */
const markOpen = () => { if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-viewer-open', handles.length > 0); };

/** A viewer registers while mounted; the newest is the active one. */
export function registerViewer(h: ViewerHandle): () => void {
  handles.push(h);
  markOpen();
  return () => { const i = handles.indexOf(h); if (i >= 0) handles.splice(i, 1); markOpen(); };
}
