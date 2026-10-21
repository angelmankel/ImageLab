/**
 * The phone page registry (mobile pass, m-shell). Each owner registers its page kinds from its own
 * module; the nav host renders them.
 *
 *   registerPhonePage('section', {
 *     Component: SectionPage,                 // gets { params, page }
 *     title: (p) => SECTION_LABEL[p.tab],     // the crumb label
 *     screen: 'step',                         // the route screen it belongs to (hash, desktop)
 *   });
 *   phoneNav.push('section', { tab: 'model' });
 *
 * The 2D map: Y = depth (each push is a card sliding up), X = `siblings` (a sideways swipe).
 * Options: `header` (the host draws the card's grabber + title; default true — set false when the
 * page draws its own), `pair` (may sit beside its parent in landscape; default true).
 */
import type { ComponentType } from 'react';
import type { NavPage, Screen } from './navLogic';

export interface PhonePageProps<P = Record<string, unknown>> { params: P; page: NavPage }

/** One place in the map: a page kind + its params. */
export interface PageRef { kind: string; params?: Record<string, unknown> }

/**
 * The X axis (Donny 10-21, "the 2D map"): the layer's siblings — steps at the step level, tabs at
 * the tab level, results at the picture level. A sideways swipe on the card moves to `at(index ± 1)`
 * (the page follows the finger and snaps). Keep it cheap: it is called on every render of the host.
 */
export interface SiblingSet { count: number; index: number; at: (i: number) => PageRef }

export interface PhonePageDef<P = any> {
  Component: ComponentType<PhonePageProps<P>>;
  /** Shown beside the card while a sideways swipe drags it (cheap preview); default = the title on a blank card. */
  Peek?: ComponentType<PhonePageProps<P>>;
  siblings?: (params: P) => SiblingSet | null;
  title: (params: P) => string;
  screen: Screen;
  header?: boolean;
  pair?: boolean;
  /** A stand-in until the owner registers the kind: never replaces a real registration. */
  fallback?: boolean;
}

const defs = new Map<string, PhonePageDef>();
const listeners = new Set<() => void>();

export function registerPhonePage<P = Record<string, unknown>>(kind: string, def: PhonePageDef<P>): void {
  const had = defs.get(kind);
  if (def.fallback && had && !had.fallback) return;
  defs.set(kind, def as PhonePageDef);
  for (const l of listeners) l();
}
export function phonePageDef(kind: string): PhonePageDef | undefined { return defs.get(kind); }
export function onPhonePagesChange(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }

export const screenOfKind = (kind: string): Screen => defs.get(kind)?.screen ?? 'step';
export const kindPairs = (kind: string): boolean => defs.get(kind)?.pair ?? true;
export function siblingsOf(p: { kind: string; params?: Record<string, unknown> }): SiblingSet | null {
  const d = defs.get(p.kind);
  if (!d?.siblings) return null;
  try {
    const s = d.siblings((p.params ?? {}) as never);
    return s && s.count > 1 && s.index >= 0 && s.index < s.count ? s : null;
  } catch { return null; }
}
export function pageTitle(p: { kind: string; params?: Record<string, unknown> }): string {
  const d = defs.get(p.kind);
  try { return d ? d.title((p.params ?? {}) as never) : p.kind; } catch { return p.kind; }
}

/**
 * The full path from the root for a screen asked for from outside the map (old code's
 * `useRoute.go(...)`, a hash change). null = push the screen's own page kind on top of where you are.
 * The create flow sets 'step' (`setScreenPath('step', () => [{ kind: 'session' }, { kind: 'step' }])`).
 */
const screenPaths = new Map<Screen, { fn: () => PageRef[] | null; fallback: boolean }>([['home', { fn: () => [{ kind: 'home' }], fallback: false }]]);
export function setScreenPath(s: Screen, fn: () => PageRef[] | null, opts: { fallback?: boolean } = {}): void {
  const had = screenPaths.get(s);
  if (opts.fallback && had && !had.fallback) return;
  screenPaths.set(s, { fn, fallback: !!opts.fallback });
}
export function pathForScreen(s: Screen): PageRef[] | null {
  try { return screenPaths.get(s)?.fn() ?? null; } catch { return null; }
}
