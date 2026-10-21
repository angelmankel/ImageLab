/**
 * The drag preview (list 2, added after close: "dragging images shows a huge ghost"): every picture
 * drag in the app shows the SAME small card under the pointer — an 88 px rounded thumbnail (a count
 * badge for a multi-drag, a ▶ card for a video) — instead of the browser's full-size translucent
 * copy. `useImageDrag` primes it when the pointer reaches a source (the thumbnail decodes before
 * the drag starts, so the first frame already shows it) and hands it to `setDragImage`.
 *
 * The card lives on <html>, outside <body>: the UI scale is CSS `zoom` on the body (`uiScale`),
 * and a snapshot of a zoomed element is sized and offset inconsistently between browsers. Out
 * there it is plain window pixels, sized by `uiZoom()` so it matches the scaled UI.
 */
import { uiZoom } from '~/theme/uiScale';

const CARD = 88;
let root: HTMLDivElement | null = null;
let img: HTMLImageElement | null = null;
let play: HTMLDivElement | null = null;
let badge: HTMLDivElement | null = null;
let primed = '';

function build(): HTMLDivElement | null {
  if (root) return root;
  if (typeof document === 'undefined') return null;
  root = document.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  // Rendered (setDragImage needs a laid-out element) but off screen.
  root.style.cssText = 'position:fixed;left:-9999px;top:-9999px;padding:3px;pointer-events:none;z-index:-1;';
  const card = document.createElement('div');
  card.style.cssText = 'position:relative;border-radius:14px;overflow:hidden;background:var(--il-panel,#1A1A1E);'
    + 'box-shadow:0 0 0 2px var(--il-ember,#F0863A);';
  img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
  play = document.createElement('div');
  play.textContent = '▶';
  play.style.cssText = 'position:absolute;inset:0;display:none;place-items:center;font:800 26px system-ui,sans-serif;color:var(--il-fg,#EDEDF0);background:var(--il-elev,#1C1C21);';
  badge = document.createElement('div');
  badge.style.cssText = 'position:absolute;right:6px;top:6px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;display:none;'
    + 'align-items:center;justify-content:center;background:var(--il-ember,#F0863A);color:var(--il-bg,#141416);font:800 12px system-ui,sans-serif;';
  card.append(img, play, badge);
  root.append(card);
  document.documentElement.append(root);
  return root;
}

/** Start decoding a picture for the next drag (pointer over / down on a source). */
export function primeDragGhost(url: string, kind: 'image' | 'video' = 'image'): void {
  if (!build() || !img || kind === 'video' || primed === url) return;
  primed = url;
  img.src = url;
  img.decode?.().catch(() => { /* shown as the empty card */ });
}

/** Put the card on a drag: the cursor at its top-left corner, the card just below-right of it. */
export function setDragGhost(dt: DataTransfer, url: string, opts: { kind?: 'image' | 'video'; count?: number } = {}): void {
  const el = build();
  if (!el || !img || !play || !badge) return;
  const video = opts.kind === 'video';
  if (!video && primed !== url) { primed = url; img.src = url; }
  img.style.visibility = video ? 'hidden' : 'visible';
  play.style.display = video ? 'grid' : 'none';
  const n = opts.count ?? 1;
  badge.style.display = n > 1 ? 'flex' : 'none';
  badge.textContent = String(n);
  const size = Math.round(CARD * uiZoom());
  const card = el.firstElementChild as HTMLDivElement;
  card.style.width = `${size}px`;
  card.style.height = `${size}px`;
  try { dt.setDragImage(el, -14, -14); } catch { /* the browser's own ghost then */ }
}
