/**
 * The controller's view of the page: which controls can take the highlight, which layer is on
 * top, and how a press reaches a control. Generic on purpose — it finds controls by role and tag,
 * so no control needs to know about controllers. Opt-ins: `data-pad-layer` (an overlay the
 * highlight stays inside; the viewers are found by `padViewer.ts`), `data-pad-back` (what B presses when
 * no overlay is open), `data-pad-start` (where the highlight first appears), `data-pad-skip`.
 *
 * Presses reach controls the way a keyboard would: a click, or the arrow key the control already
 * handles (Mantine's Slider and NumberInput). Nothing is focused except a text box on purpose, so
 * the phone's keyboard never opens by accident.
 */
import { firstBox, nearestBox, pickInDirection, scrollDelta, stepIndex, type Box, type Dir } from '@/lib/gamepad';
import { VIEWER } from './padViewer';

export type StopKind = 'button' | 'slider' | 'radio' | 'toggle' | 'number' | 'text' | 'select' | 'nativeSelect' | 'range';

/** One place the highlight can sit: the element acted on, and the one drawn around. */
export interface Stop { el: HTMLElement; visual: HTMLElement; kind: StopKind }

const LAYERS = `[role="dialog"], [role="alertdialog"], [role="menu"], .mantine-Popover-dropdown, [data-radix-popper-content-wrapper], [data-pad-layer], ${VIEWER}`;

const CONTROLS = [
  'button', 'a[href]', 'input', 'textarea', 'select', '[contenteditable="true"]',
  '[role="button"]', '[role="slider"]', '[role="switch"]', '[role="checkbox"]', '[role="radio"]',
  '[role="tab"]', '[role="option"]', '[role="menuitem"]', '[role="menuitemradio"]', '[role="menuitemcheckbox"]',
  '[role="combobox"]', '[data-pad-focus]',
].join(',');

const TEXT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password']);

const shown = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
// Toasts float over everything but are not part of the page to move through.
const away = (el: Element) => !!el.closest('[inert], [aria-hidden="true"], [data-pad-skip], .mantine-Notifications-root');

/** The overlay on top (last opened: portals append in order), or null for the page itself. */
export function topLayer(): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(LAYERS)].filter(el => shown(el) && !away(el));
  return all[all.length - 1] ?? null;
}

/** An overlay still open (it may have closed since it was seen). */
export const isOpen = (el: Element) => el.isConnected && shown(el) && !away(el);


/** A text box with focus: the controller keeps out of it except for Plus and B. */
export function typingElement(): HTMLElement | null {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return null;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return el;
  if (el.tagName === 'INPUT') {
    const input = el as HTMLInputElement;
    if ((TEXT_TYPES.has(input.type) || input.type === 'number') && !input.readOnly) return el;
  }
  return null;
}

function kindOf(el: HTMLElement): StopKind {
  const role = el.getAttribute('role');
  if (role === 'slider') return 'slider';
  if (role === 'switch' || role === 'checkbox') return 'toggle';
  if (role === 'radio') return 'radio';
  if (el.tagName === 'SELECT') return 'nativeSelect';
  if (el.tagName === 'TEXTAREA' || el.isContentEditable) return 'text';
  if (el.tagName === 'INPUT') {
    const input = el as HTMLInputElement;
    if (input.type === 'checkbox') return 'toggle';
    if (input.type === 'radio') return 'radio';
    if (input.type === 'range') return 'range';
    if (role === 'combobox' || input.getAttribute('aria-haspopup') === 'listbox') return 'select';
    if (input.type === 'number' || /numeric|decimal/.test(input.inputMode) || input.closest('.mantine-NumberInput-root')) return 'number';
    if (TEXT_TYPES.has(input.type)) return input.readOnly ? 'select' : 'text';
  }
  if (role === 'combobox') return 'select';
  return 'button';
}

/** What to draw around: a visually hidden input is drawn as its label or its control. */
function visualOf(el: HTMLElement, kind: StopKind): HTMLElement {
  if (kind === 'slider') {
    // The whole track, unless it has two thumbs (a range), where each thumb is its own stop.
    const track = el.closest<HTMLElement>('.mantine-Slider-root');
    return track && track.querySelectorAll('[role="slider"]').length === 1 ? track : el;
  }
  const r = el.getBoundingClientRect();
  if (r.width >= 4 && r.height >= 4 && getComputedStyle(el).opacity !== '0') return el;
  const input = el as HTMLInputElement;
  return (input.labels?.[0] as HTMLElement | undefined) ?? el.parentElement ?? el;
}

type Look = { clips: boolean; clear: boolean };

/**
 * Not really there: outside the viewport sideways, cut off by a box that does not scroll, or
 * transparent (a tile's buttons that only fade in on hover).
 */
function hiddenAway(el: HTMLElement, r: DOMRect, root: Element, cache: Map<Element, Look>): boolean {
  if (r.right <= 0 || r.left >= window.innerWidth) return true;
  for (let p: HTMLElement | null = el; p && p !== root.parentElement; p = p.parentElement) {
    let look = cache.get(p);
    if (!look) {
      const s = getComputedStyle(p);
      look = { clips: /hidden|clip/.test(s.overflowX) && /hidden|clip/.test(s.overflowY), clear: s.opacity === '0' };
      cache.set(p, look);
    }
    if (look.clear) return true;
    if (!look.clips || p === el) continue;
    const pr = p.getBoundingClientRect();
    if (r.bottom <= pr.top || r.top >= pr.bottom || r.right <= pr.left || r.left >= pr.right) return true;
  }
  return false;
}

/** Every control the highlight can reach inside `root`, a radio group counted once. */
export function collectStops(root: Element): Stop[] {
  const out: Stop[] = [];
  const groups = new Set<Element | string>();
  const cache = new Map<Element, Look>();
  for (const el of root.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') continue;
    if (away(el)) continue;
    // The +/- inside a number box: the box itself is the stop and left/right step it.
    if (el.closest('.mantine-Input-section')) continue;
    // A layer's own controls belong to it, not to the page under it.
    const layer = el.closest(LAYERS);
    if (layer && layer !== root && root.contains(layer)) continue;
    const kind = kindOf(el);
    let target = el;
    if (kind === 'radio') {
      const group = el.closest<HTMLElement>('[role="radiogroup"]');
      const key: Element | string = group ?? `name:${(el as HTMLInputElement).name || Math.random()}`;
      if (groups.has(key)) continue;
      groups.add(key);
      if (group) target = group;
    }
    const visual = kind === 'radio' && target !== el ? target : visualOf(el, kind);
    if (!shown(visual)) continue;
    const r = visual.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || hiddenAway(visual, r, root, cache)) continue;
    out.push({ el: target, visual, kind });
  }
  return out;
}

export const boxOf = (s: Stop): Box => {
  const r = s.visual.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

/** Still on screen and reachable: a stop can go stale when a page slides away or a list redraws. */
export function stillThere(s: Stop | null): boolean {
  return !!s && s.el.isConnected && s.visual.isConnected && !away(s.el) && shown(s.visual);
}

/** Where the highlight lands when it first shows in `root`. */
export function initialStop(stops: Stop[], root: Element): number {
  if (!stops.length) return -1;
  // In a list or menu, the chosen entry.
  const chosen = stops.findIndex(s => s.el.matches('[aria-selected="true"], [data-combobox-selected], [aria-checked="true"], [data-checked]') && s.kind === 'button');
  if (chosen >= 0 && root !== document.body) return chosen;
  const start = root.querySelector('[data-pad-start]');
  const pool = stops.map((s, i) => ({ s, i })).filter(({ s }) => !start || start.contains(s.el));
  const list = pool.length ? pool : stops.map((s, i) => ({ s, i }));
  const inView = list.filter(({ s }) => { const b = boxOf(s); return b.bottom > 0 && b.top < window.innerHeight; });
  const use = inView.length ? inView : list;
  const at = firstBox(use.map(({ s }) => boxOf(s)));
  return at >= 0 ? use[at].i : 0;
}

export function nearestStop(stops: Stop[], at: Box): number {
  return nearestBox(stops.map(boxOf), (at.left + at.right) / 2, (at.top + at.bottom) / 2);
}

export function moveFrom(stops: Stop[], from: number, dir: Dir): number {
  return pickInDirection(stops.map(boxOf), boxOf(stops[from]), dir, from);
}

// ── Pressing ────────────────────────────────────────────────────────────────

/** Synthetic keys a control handles itself, kept from the app's own shortcuts (←/→ step results). */
const contained = new WeakSet<Event>();
let containing = false;
function containKeys() {
  if (containing) return;
  containing = true;
  // React handles keys at its root, inside the document; the shortcuts listen on window, after it.
  document.addEventListener('keydown', e => { if (contained.has(e)) e.stopPropagation(); });
}

function key(el: EventTarget, k: string, keep = true) {
  const e = new KeyboardEvent('keydown', { key: k, code: k, bubbles: true, cancelable: true });
  if (keep) { containKeys(); contained.add(e); }
  el.dispatchEvent(e);
}


/** A: what a click or Enter would do. Text boxes take focus, so the keyboard opens on purpose. */
export function activate(s: Stop) {
  switch (s.kind) {
    case 'text': case 'number': s.el.focus(); return;
    case 'slider': case 'range': return;
    case 'radio': nudge(s, 1, false, true); return;
    default:
      if (s.el.getAttribute('role') === 'option' && s.el.closest('[data-radix-popper-content-wrapper]')) { key(s.el, 'Enter'); return; }
      s.el.click();
  }
}

function radios(s: Stop): HTMLElement[] {
  if (s.el.getAttribute('role') === 'radiogroup') {
    return [...s.el.querySelectorAll<HTMLElement>('input[type="radio"], [role="radio"]')].filter(r => !(r as HTMLInputElement).disabled);
  }
  const name = (s.el as HTMLInputElement).name;
  return name ? [...document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`)] : [s.el];
}
const isOn = (el: HTMLElement) => (el instanceof HTMLInputElement ? el.checked : el.getAttribute('aria-checked') === 'true');

function setNative(el: HTMLInputElement | HTMLSelectElement, value: string, event: 'input' | 'change') {
  // React tracks the value it last set; going through the prototype's setter makes it see a change.
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event(event, { bubbles: true }));
}

/** Left / right on a control that has a value. False when it has none, so the highlight moves instead. */
export function nudge(s: Stop, dir: 1 | -1, big: boolean, wrap = false): boolean {
  const times = big ? 10 : 1;
  switch (s.kind) {
    case 'slider':
      for (let i = 0; i < times; i++) key(s.el, dir > 0 ? 'ArrowRight' : 'ArrowLeft');
      return true;
    case 'number':
      for (let i = 0; i < times; i++) key(s.el, dir > 0 ? 'ArrowUp' : 'ArrowDown');
      return true;
    case 'radio': {
      const list = radios(s);
      const at = list.findIndex(isOn);
      const next = list[stepIndex(at, list.length, dir, wrap)];
      if (next && next !== list[at]) next.click();
      return true;
    }
    case 'toggle':
      if (isOn(s.el) !== dir > 0) s.el.click();
      return true;
    case 'range': {
      const input = s.el as HTMLInputElement;
      const step = Number(input.step) || 1;
      const v = Math.min(Number(input.max || 100), Math.max(Number(input.min || 0), Number(input.value) + dir * step * times));
      setNative(input, String(v), 'input');
      return true;
    }
    case 'nativeSelect': {
      const sel = s.el as HTMLSelectElement;
      const i = stepIndex(sel.selectedIndex, sel.options.length, dir);
      if (i >= 0 && i !== sel.selectedIndex) setNative(sel, sel.options[i].value, 'change');
      return true;
    }
    default:
      return false;
  }
}

/** B on an overlay: Escape where it listens — the dropdown, an open list's box, and the window. */
export function closeLayer(layer: HTMLElement) {
  const opener = document.querySelector<HTMLElement>('[aria-expanded="true"][aria-controls]');
  if (opener && layer.matches('.mantine-Popover-dropdown')) key(opener, 'Escape');
  key(layer, 'Escape', false);
}

/** The page's own Back (a phone settings page), when one is showing. */
export function backButton(): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>('[data-pad-back]')].filter(el => shown(el) && !away(el));
  return all[all.length - 1] ?? null;
}

// ── Scrolling ───────────────────────────────────────────────────────────────

const scrolls = (el: Element, axis: 'x' | 'y') => {
  const s = getComputedStyle(el);
  const o = axis === 'y' ? s.overflowY : s.overflowX;
  return /auto|scroll|overlay/.test(o) && (axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1);
};

/** Scroll every scroller around it just enough to show it. Never touches a hidden overflow. */
export function reveal(el: HTMLElement) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    for (const axis of ['y', 'x'] as const) {
      if (!scrolls(p, axis)) continue;
      const r = el.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      const d = axis === 'y' ? scrollDelta(r.top, r.bottom, pr.top, pr.bottom) : scrollDelta(r.left, r.right, pr.left, pr.right, 12);
      if (d) p.scrollBy(axis === 'y' ? { top: d } : { left: d });
    }
  }
}

/** The right stick: scroll whatever holds the highlight, else whatever is in the middle. */
export function scrollFrom(from: Element | null, layer: Element | null, dy: number) {
  let el: Element | null = from;
  if (!el) {
    const r = (layer ?? document.body).getBoundingClientRect();
    el = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
  }
  for (let p = el; p && p !== document.body; p = p.parentElement) {
    if (scrolls(p, 'y')) { p.scrollBy({ top: dy }); return; }
  }
}
