/**
 * The phone's navigation tree, the pure part (mobile pass, m-shell; Donny 10-21: "push themselves
 * around … swiping in and out of things … a way back to the top of the tree"). Tested in
 * tests/phoneNav.test.cjs. Imports nothing at run time.
 *
 * The app on a phone is a stack of pages, root first: Home → Session → Step → Section → Item, and
 * the places (History, Models, ComfyUI, Settings) pushed on top of wherever you are. A page is
 * data: a `kind` (registered by its owner, ./pages) and serialisable `params`.
 */

export type Screen = 'step' | 'home' | 'library' | 'models' | 'comfy' | 'settings';

export interface NavPage {
  /** Stable id for React keys and per-page state (scroll, band). */
  key: string;
  kind: string;
  params?: Record<string, unknown>;
}

let seq = 0;
export function makePage(kind: string, params?: Record<string, unknown>): NavPage {
  seq += 1;
  return { key: `${kind}-${Date.now().toString(36)}-${seq}`, kind, params };
}

/** The same page (kind + params): pushing it again goes back to it instead of stacking a copy. */
export function samePage(a: { kind: string; params?: Record<string, unknown> }, b: { kind: string; params?: Record<string, unknown> }): boolean {
  return a.kind === b.kind && JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});
}

/** Push: if the same page is already in the stack, pop back to it; else add on top. */
export function pushPage(stack: NavPage[], page: NavPage): NavPage[] {
  const at = stack.findIndex((p) => samePage(p, page));
  if (at >= 0) return stack.slice(0, at + 1);
  return [...stack, page];
}

/** Pop n levels; the root never goes. */
export function popPages(stack: NavPage[], n = 1): NavPage[] {
  return stack.slice(0, Math.max(1, stack.length - Math.max(1, n)));
}

/** Pop back to a page (by key); unknown key = unchanged. */
export function popToKey(stack: NavPage[], key: string): NavPage[] {
  const at = stack.findIndex((p) => p.key === key);
  return at < 0 ? stack : stack.slice(0, at + 1);
}

/** The route screen a kind belongs to (set by the page registry); unknown kinds count as 'step'. */
export type ScreenOf = (kind: string) => Screen;

/** The last page in the stack showing this screen, or -1. */
export function lastIndexOfScreen(stack: NavPage[], screen: Screen, screenOf: ScreenOf): number {
  for (let i = stack.length - 1; i >= 0; i--) if (screenOf(stack[i].kind) === screen) return i;
  return -1;
}

/** A place in the map: a kind + params (no key yet). */
export interface Ref { kind: string; params?: Record<string, unknown> }

/** The root page (Home, the map's origin) always has this key. */
export const ROOT_PAGE: NavPage = { key: 'home-root', kind: 'home' };

/** Turn refs into pages, keeping the existing pages (and their state) where the path agrees. */
export function stackFromPath(stack: NavPage[], path: Ref[]): NavPage[] {
  const out: NavPage[] = [];
  let same = true;
  path.forEach((r, i) => {
    const cur = stack[i];
    if (same && cur && samePage(cur, r)) out.push(cur);
    else { same = false; out.push(r.kind === 'home' && i === 0 ? ROOT_PAGE : makePage(r.kind, r.params)); }
  });
  return out.length ? out : [ROOT_PAGE];
}

/**
 * The stack after something outside the map asked for a screen (`useRoute.go('library')`, a hash
 * change): stay if the top already shows it; go back to the last layer of that screen if there is
 * one; else `pathFor(screen)` = the full path from the root, or null = push `screen`'s own kind on top.
 */
export function stackForScreen(stack: NavPage[], screen: Screen, screenOf: ScreenOf, pathFor: (s: Screen) => Ref[] | null): NavPage[] {
  if (screenOf(stack[stack.length - 1].kind) === screen) return stack;
  const at = lastIndexOfScreen(stack, screen, screenOf);
  if (at >= 0) return stack.slice(0, at + 1);
  const path = pathFor(screen);
  if (path) return stackFromPath(stack, path);
  return [...stack, makePage(screen)];
}

/**
 * What changed between two stacks, for the page transition: 'push' (a new top on the old one),
 * 'pop' (the top went back down), 'replace' (anything else: no slide), 'none'.
 */
export function transitionOf(prev: NavPage[], next: NavPage[]): 'push' | 'pop' | 'replace' | 'none' {
  const a = prev[prev.length - 1]?.key; const b = next[next.length - 1]?.key;
  if (a === b) return 'none';
  if (next.length > prev.length && next[prev.length - 1]?.key === a) return 'push';
  if (next.length < prev.length && prev[next.length - 1]?.key === b) return 'pop';
  return 'replace';
}

/**
 * Landscape: which pages show. A page and its parent sit side by side when both allow it
 * (`pairs(kind)`); otherwise the top page alone, full width.
 */
export function visiblePages(stack: NavPage[], landscape: boolean, pairs: (kind: string) => boolean): { left: NavPage | null; main: NavPage } {
  const main = stack[stack.length - 1];
  const parent = stack[stack.length - 2];
  if (landscape && parent && pairs(main.kind) && pairs(parent.kind)) return { left: parent, main };
  return { left: null, main };
}

/** The crumb trail's labels, root first; long trails keep the root, an ellipsis and the last two. */
export function crumbTrail<T>(items: T[], max = 4): Array<T | null> {
  if (items.length <= max) return items;
  return [items[0], null, ...items.slice(items.length - (max - 2))];
}

/** The map address: each layer's index among its siblings (0 when it has none), root first. */
export function addressOf(stack: NavPage[], indexOf: (p: NavPage) => number): number[] {
  return stack.map(indexOf);
}

/** Replace one layer (and drop everything above it): a sideways move, or a pick on a parent in landscape. */
export function replaceAt(stack: NavPage[], depth: number, page: NavPage): NavPage[] {
  if (depth < 0 || depth >= stack.length) return stack;
  return [...stack.slice(0, depth), page];
}

/** The sibling a sideways swipe lands on: finger left (-1) = next, right (+1) = previous; null at an end. */
export function siblingForSwipe(index: number, count: number, fingerDir: 1 | -1): number | null {
  const i = index - fingerDir;
  return i >= 0 && i < count ? i : null;
}
