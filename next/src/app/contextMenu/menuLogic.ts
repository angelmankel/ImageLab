/**
 * The app's right-click menu, the pure part (FIXLIST 45; tested in tests/contextMenu.test.cjs).
 * Entries are data: each owner registers its own for an element type (`registerMenu` in
 * ./registry). This file turns the registered entries + the clicked thing into the rows the menu
 * shows (visible rules, enabled rules, groups → separators, submenus), walks them with the
 * keyboard, and places the panel inside the window. Imports nothing at run time.
 */
import type { ComponentType } from 'react';

/** A tabler-style icon component (`IconTrash`), drawn at 15px. */
export type MenuIcon = ComponentType<{ size?: number | string; stroke?: number | string }>;

/** Where / how the menu was opened, handed to every action. */
export interface MenuContext {
  type: string;
  x: number;
  y: number;
  /** The element that was right-clicked / long-pressed (null when opened from code). */
  el: Element | null;
}

export interface MenuEntry<T = any> {
  /** Unique within its type; registering the same id again replaces the old entry. */
  id: string;
  label: string | ((target: T) => string);
  icon?: MenuIcon;
  /** Shown on the right, e.g. "Del", "Ctrl+D". A hint only: the owner binds the key itself. */
  shortcut?: string;
  action?: (target: T, ctx: MenuContext) => unknown;
  /** false (or a string = the reason, shown as the row's tooltip) greys the row out. */
  enabled?: (target: T) => boolean | string;
  /** false hides the row. */
  visible?: (target: T) => boolean;
  /** true draws a check mark (toggles). */
  checked?: (target: T) => boolean;
  /** Red label (delete, remove). */
  danger?: boolean;
  /** Rows of one group stay together; a separator is drawn between groups. */
  group?: string;
  /** Lower first; ties keep registration order. Default 0. */
  order?: number;
  submenu?: MenuEntry<T>[] | ((target: T) => MenuEntry<T>[]);
}

export type MenuRow<T = any> =
  | { kind: 'sep'; key: string }
  | {
      kind: 'item';
      key: string;
      entry: MenuEntry<T>;
      label: string;
      disabled: boolean;
      reason?: string;
      checked: boolean;
      children?: MenuRow<T>[];
    };

function safe<R>(fn: (() => R) | undefined, fallback: R): R {
  if (!fn) return fallback;
  try { return fn(); } catch { return fallback; }
}

/** The rows for one target: hidden ones dropped, sorted, grouped, separators between groups. */
export function resolveRows<T>(entries: readonly MenuEntry<T>[], target: T, depth = 0): MenuRow<T>[] {
  const visible = entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => safe(() => (e.visible ? e.visible(target) : true), false))
    .sort((a, b) => (a.e.order ?? 0) - (b.e.order ?? 0) || a.i - b.i);
  const groups = new Map<string, MenuRow<T>[]>();
  for (const { e } of visible) {
    let children: MenuRow<T>[] | undefined;
    if (e.submenu) {
      if (depth >= 4) continue;
      const subs = safe(() => (typeof e.submenu === 'function' ? e.submenu(target) : e.submenu!), []);
      children = resolveRows(subs, target, depth + 1);
      if (!children.some((r) => r.kind === 'item')) continue; // an empty submenu is not shown
    }
    const en = safe(() => (e.enabled ? e.enabled(target) : true), false);
    const label = safe(() => (typeof e.label === 'function' ? e.label(target) : e.label), e.id);
    const row: MenuRow<T> = {
      kind: 'item', key: e.id, entry: e, label,
      disabled: en !== true, reason: typeof en === 'string' ? en : undefined,
      checked: safe(() => !!e.checked?.(target), false), children,
    };
    const g = e.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(row);
  }
  const out: MenuRow<T>[] = [];
  for (const [g, rows] of groups) {
    if (out.length) out.push({ kind: 'sep', key: `sep:${g}` });
    out.push(...rows);
  }
  return out;
}

const usable = (r: MenuRow | undefined) => !!r && r.kind === 'item' && !r.disabled;

/** The next usable row from `from` going `dir` (+1 / -1), wrapping; -1 when there is none. */
export function stepIndex(rows: readonly MenuRow[], from: number, dir: 1 | -1): number {
  const n = rows.length;
  if (!n) return -1;
  let i = from;
  for (let k = 0; k < n; k++) {
    i = i < 0 ? (dir > 0 ? 0 : n - 1) : (i + dir + n) % n;
    if (usable(rows[i])) return i;
  }
  return -1;
}

export const firstIndex = (rows: readonly MenuRow[]) => stepIndex(rows, -1, 1);
export const lastIndex = (rows: readonly MenuRow[]) => stepIndex(rows, -1, -1);

/** Type-ahead: the next usable row after `from` whose label starts with `ch`; -1 when none. */
export function letterIndex(rows: readonly MenuRow[], from: number, ch: string): number {
  const c = ch.toLowerCase();
  const n = rows.length;
  for (let k = 1; k <= n; k++) {
    const i = (Math.max(from, -1) + k + n) % n;
    const r = rows[i];
    if (usable(r) && r.kind === 'item' && r.label.trim().toLowerCase().startsWith(c)) return i;
  }
  return -1;
}

const M = 8; // keep this far from the window edge

/** The root panel at a point: below-right of it, flipped left / up when it would leave the window. */
export function placeAtPoint(x: number, y: number, w: number, h: number, vw: number, vh: number) {
  let left = x + 2;
  let top = y + 2;
  if (left + w > vw - M) left = Math.max(M, x - w - 2);
  if (top + h > vh - M) top = Math.max(M, Math.min(y - h - 2, vh - M - h));
  return { left: Math.max(M, left), top: Math.max(M, top) };
}

/** A submenu beside its row: to the right, or to the left when the right has no room. */
export function placeBeside(
  r: { left: number; right: number; top: number }, w: number, h: number, vw: number, vh: number,
) {
  let left = r.right - 2;
  if (left + w > vw - M) left = Math.max(M, r.left - w + 2);
  let top = r.top - 5;
  if (top + h > vh - M) top = Math.max(M, vh - M - h);
  return { left, top: Math.max(M, top) };
}

/** Text fields keep the browser's own menu (copy / paste / spell-check). */
export function isTextField(el: Element | null): boolean {
  if (!el) return false;
  const f = el.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-native-menu]');
  if (!f) return false;
  if (f.tagName === 'INPUT') {
    const t = ((f as HTMLInputElement).type || 'text').toLowerCase();
    return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'reset', 'submit'].includes(t);
  }
  return true;
}
