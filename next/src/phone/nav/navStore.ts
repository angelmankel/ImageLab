/**
 * The phone's navigation stack (mobile pass, m-shell). One store; the host (./NavHost) renders it.
 *
 *   import { phoneNav, usePhoneNav } from '~/phone';
 *   phoneNav.push('section', { tab: 'model' });   // in one level
 *   phoneNav.pop();                                // out one level
 *   phoneNav.root();                               // the top of the tree (Home)
 *   const depth = usePhoneNav((s) => s.stack.length);
 *
 * Kept in step with the hash route both ways: `useRoute.go('library')` from any old code pushes
 * (or goes back to) the History page; a nav change writes the route screen + hash. The phone's
 * Back button / gesture pops one level (one guard history entry while not at the root).
 * The stack survives a reload (sessionStorage) and, being one store, a rotation.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useRoute, hashOfScreen } from '~/app/routeStore';
import { ROOT_PAGE, addressOf, makePage, popPages, popToKey, pushPage, replaceAt, stackForScreen, stackFromPath, transitionOf, type NavPage } from './navLogic';
import { pathForScreen, screenOfKind, siblingsOf, type PageRef } from './pages';

export interface NavState {
  stack: NavPage[];
  /** How the last change should animate ('none' = it already slid, e.g. a finished swipe). */
  motion: 'auto' | 'none';
}

const ROOT = ROOT_PAGE;

function initialStack(): NavPage[] {
  const screen = useRoute.getState().screen;
  return stackForScreen([ROOT], screen, screenOfKind, pathForScreen);
}

export const usePhoneNav = create<NavState>()(persist(
  (): NavState => ({ stack: [ROOT], motion: 'auto' }),
  {
    name: 'imagelab.next.phoneNav.v1',
    storage: createJSONStorage(() => sessionStorage),
    partialize: (s) => ({ stack: s.stack }),
    merge: (saved, cur) => {
      const st = (saved as Partial<NavState> | undefined)?.stack;
      const ok = Array.isArray(st) && st.length > 0 && st.every((p) => p && typeof p.key === 'string' && typeof p.kind === 'string');
      return { ...cur, stack: ok ? st! : cur.stack };
    },
  },
));

/** The host slides the top page out before a pop lands; returns false when it cannot (busy, no motion). */
export type PopAnimator = (prev: NavPage[], next: NavPage[], commit: () => void) => boolean;
let popAnimator: PopAnimator | null = null;
export function setPopAnimator(a: PopAnimator): () => void {
  popAnimator = a;
  return () => { if (popAnimator === a) popAnimator = null; };
}

function set(stack: NavPage[], motion: NavState['motion'] = 'auto') {
  const prev = usePhoneNav.getState().stack;
  if (stack === prev) return;
  syncRoute(stack); // the address moves at once, so a hash change during the slide agrees
  const commit = (m: NavState['motion']) => {
    if (usePhoneNav.getState().stack !== prev) return; // something newer landed meanwhile
    usePhoneNav.setState({ stack, motion: m });
  };
  if (motion === 'auto' && popAnimator && transitionOf(prev, stack) === 'pop' && popAnimator(prev, stack, () => commit('none'))) return;
  commit(motion);
}

export const phoneNav = {
  /** One layer deeper (a card slides up). `from` = the page key it is opened from: layers above it go first. */
  push(kind: string, params?: Record<string, unknown>, opts: { motion?: NavState['motion']; from?: string } = {}) {
    let s = usePhoneNav.getState().stack;
    if (opts.from) s = popToKey(s, opts.from);
    set(pushPage(s, makePage(kind, params)), opts.motion);
  },
  /** Swap the top layer for another at the same depth (a sibling): no slide up. */
  replace(kind: string, params?: Record<string, unknown>, opts: { motion?: NavState['motion'] } = {}) {
    const s = usePhoneNav.getState().stack;
    if (s.length < 2) return;
    set(replaceAt(s, s.length - 1, makePage(kind, params)), opts.motion ?? 'none');
  },
  /** Move the top layer sideways to sibling `i` of its set (the X axis). */
  sibling(i: number) {
    const s = usePhoneNav.getState().stack;
    const top = s[s.length - 1];
    const sib = siblingsOf(top);
    if (!sib || i < 0 || i >= sib.count || i === sib.index) return;
    const ref = sib.at(i);
    set(replaceAt(s, s.length - 1, ref.kind === 'home' && s.length === 1 ? ROOT : makePage(ref.kind, ref.params)), 'none');
  },
  /** Back out n layers (the card slides down). */
  pop(n = 1, opts: { motion?: NavState['motion'] } = {}) {
    const s = usePhoneNav.getState().stack;
    if (s.length > 1) set(popPages(s, n), opts.motion);
  },
  popTo(key: string) { set(popToKey(usePhoneNav.getState().stack, key)); },
  /** The top of the map (Home, the origin). */
  root() { set([ROOT]); },
  /** Jump anywhere: the whole path from the root, root first (the HUD ring, links). Layers that agree keep their state. */
  open(path: PageRef[], opts: { motion?: NavState['motion'] } = {}) {
    set(stackFromPath(usePhoneNav.getState().stack, path), opts.motion);
  },
  depth(): number { return usePhoneNav.getState().stack.length - 1; },
  top(): NavPage { const s = usePhoneNav.getState().stack; return s[s.length - 1]; },
  /** Where you are in the map: each layer's sibling index, root first. */
  address(): number[] { return addressOf(usePhoneNav.getState().stack, (p) => siblingsOf(p)?.index ?? 0); },
};

/* ---------- the route + history bridge (only while the phone frame is mounted) ---------- */

let bridged = false;
/** The current history entry is ours to drop (a guard, or one old code's `go()` made). */
let guarded = false;
let writing = false;

function syncRoute(stack: NavPage[] = usePhoneNav.getState().stack) {
  if (!bridged) return;
  const top = stack[stack.length - 1];
  const screen = screenOfKind(top.kind);
  writing = true;
  try {
    if (useRoute.getState().screen !== screen) useRoute.setState({ screen });
    const hash = hashOfScreen(screen);
    const url = `${location.pathname}${location.search}${hash}`;
    if (location.hash !== hash && !(hash === '#/' && !location.hash)) history.replaceState(history.state, '', url);
    if (stack.length > 1 && !guarded) { history.pushState({ ilNav: 1 }, '', url); guarded = true; }
  } finally { writing = false; }
}

/** Start the bridge (NavHost mounts it). Returns the stop function. */
export function startNavBridge(): () => void {
  if (bridged) return () => {};
  bridged = true;
  // The stack restored from the session may disagree with the address: the address wins.
  const want = useRoute.getState().screen;
  const cur = usePhoneNav.getState().stack;
  const fixed = stackForScreen(cur, want, screenOfKind, pathForScreen);
  if (fixed !== cur) usePhoneNav.setState({ stack: fixed, motion: 'none' });
  else if (cur.length === 1 && want !== 'home') usePhoneNav.setState({ stack: initialStack(), motion: 'none' });
  syncRoute();

  const unRoute = useRoute.subscribe((r, prev) => {
    if (writing || r.screen === prev.screen) return;
    const s = usePhoneNav.getState().stack;
    if (screenOfKind(s[s.length - 1].kind) === r.screen) return;
    // old code called go(): its hash change made a new entry, so the current one is droppable
    guarded = true;
    set(stackForScreen(s, r.screen, screenOfKind, pathForScreen));
  });
  const onPop = () => {
    guarded = false;
    if (phoneNav.depth() > 0) phoneNav.pop();
    else syncRoute();
  };
  window.addEventListener('popstate', onPop);
  return () => { bridged = false; unRoute(); window.removeEventListener('popstate', onPop); };
}
