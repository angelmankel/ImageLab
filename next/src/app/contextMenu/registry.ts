/**
 * The app's right-click menu registry (FIXLIST 45). ONE data-driven place: each owner registers
 * entries for an element type from its own module, and marks the element with `menuProps`.
 *
 *   import { registerMenu, menuProps } from '~/app/contextMenu';
 *   registerMenu<Step>('step', [
 *     { id: 'dup', label: 'Duplicate', icon: IconCopy, group: 'edit', action: (s) => duplicateStep(s.id) },
 *     { id: 'del', label: 'Remove', icon: IconTrash, danger: true, group: 'danger',
 *       enabled: (s) => steps.length > 1 || 'The last step stays', action: (s) => removeStep(s.id) },
 *   ]);
 *   <button {...menuProps('step', step)}>…</button>
 *
 * Several modules may register for the same type: the entries are merged (sorted by `order`,
 * grouped by `group`). Right-click opens it; a phone long-press opens it; Shift + right-click and
 * text fields keep the browser's own menu. `openMenu` opens one from code (a "⋯" button).
 */
import type { MouseEvent as ReactMouseEvent } from 'react';
import { create } from 'zustand';
import { isTextField, resolveRows, type MenuContext, type MenuEntry, type MenuRow } from './menuLogic';

export type { MenuEntry, MenuContext, MenuIcon, MenuRow } from './menuLogic';

const registry = new Map<string, MenuEntry[]>();

/** Add entries for an element type. Same id again = replaced. Returns a function that takes them out. */
export function registerMenu<T = any>(type: string, entries: MenuEntry<T>[]): () => void {
  const list = (registry.get(type) ?? []).filter((e) => !entries.some((n) => n.id === e.id));
  registry.set(type, [...list, ...(entries as MenuEntry[])]);
  return () => {
    const cur = registry.get(type);
    if (cur) registry.set(type, cur.filter((e) => !(entries as MenuEntry[]).includes(e)));
  };
}

/** The entries registered for a type (a copy). */
export function menuEntries(type: string): MenuEntry[] {
  return [...(registry.get(type) ?? [])];
}

export interface OpenMenu {
  seq: number;
  type: string;
  target: unknown;
  rows: MenuRow[];
  ctx: MenuContext;
  /** Focus goes back here on close. */
  returnFocus: Element | null;
  /** Opened from the keyboard: the first row is highlighted at once. */
  keyboard: boolean;
}

interface MenuState { menu: OpenMenu | null }
export const useContextMenu = create<MenuState>(() => ({ menu: null }));

let seq = 0;

/**
 * Open a type's menu for a target at a point or beside an element. Returns false (and opens
 * nothing) when the type has no visible entry for this target.
 */
export function openMenu(
  type: string, target: unknown,
  at: { x: number; y: number } | Element,
  opts: { el?: Element | null; keyboard?: boolean } = {},
): boolean {
  let x: number; let y: number; let el: Element | null = opts.el ?? null;
  if (at instanceof Element) {
    const r = at.getBoundingClientRect();
    x = r.left; y = r.bottom; el = el ?? at;
  } else ({ x, y } = at);
  const rows = resolveRows(registry.get(type) ?? [], target);
  if (!rows.some((r) => r.kind === 'item')) return false;
  useContextMenu.setState({
    menu: {
      seq: ++seq, type, target, rows, ctx: { type, x, y, el },
      returnFocus: document.activeElement, keyboard: !!opts.keyboard,
    },
  });
  return true;
}

export function closeMenu(): void {
  const m = useContextMenu.getState().menu;
  if (!m) return;
  useContextMenu.setState({ menu: null });
  const f = m.returnFocus as HTMLElement | null;
  if (f && typeof f.focus === 'function' && document.contains(f)) f.focus({ preventScroll: true });
}

/** Events our menu already took (the innermost marked element wins; the global fallback skips them). */
export const handledEvents = new WeakSet<Event>();

/** A right-click / long-press position, or the element's corner when it came from the keyboard. */
export function pointOf(e: MouseEvent, el: Element): { x: number; y: number; keyboard: boolean } {
  if (e.clientX === 0 && e.clientY === 0 && e.button !== 2) {
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(16, r.width / 2), y: r.top + Math.min(16, r.height / 2), keyboard: true };
  }
  return { x: e.clientX, y: e.clientY, keyboard: false };
}

/**
 * Props for an element that has a menu: `<div {...menuProps('history-image', entry)}>`.
 * Text fields inside it keep the browser's menu; an inner marked element wins over an outer one.
 */
export function menuProps<T>(type: string, target: T) {
  return {
    'data-ctx': type,
    onContextMenu: (e: ReactMouseEvent) => {
      const ne = e.nativeEvent;
      if (handledEvents.has(ne) || ne.shiftKey || isTextField(e.target as Element)) return;
      const el = e.currentTarget as Element;
      const p = pointOf(ne, el);
      if (openMenu(type, target, p, { el, keyboard: p.keyboard })) {
        e.preventDefault();
        handledEvents.add(ne);
      }
    },
  };
}
