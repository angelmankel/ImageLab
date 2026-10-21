/**
 * Item 42 follow-up: the Manage window's snippet selection — tick one, Shift-click a range, the
 * header checkbox (none / some / all of what is shown), and which snippets a drag carries. Pure,
 * tested in node (`tests/snippetModel.test.cjs`).
 */

/** Tick / untick one. */
export function toggleOne(sel: ReadonlySet<string>, id: string): Set<string> {
  const n = new Set(sel);
  if (n.has(id)) n.delete(id); else n.add(id);
  return n;
}

/**
 * Shift-click: every row from the anchor (the last row clicked without Shift) to `id`, in the shown
 * order, takes the clicked row's new state (ticked when it was not ticked). No anchor (or it is not
 * shown any more) = a plain toggle.
 */
export function selectRange(sel: ReadonlySet<string>, order: readonly string[], anchor: string | null, id: string): Set<string> {
  const a = anchor ? order.indexOf(anchor) : -1;
  const b = order.indexOf(id);
  if (a < 0 || b < 0) return toggleOne(sel, id);
  const on = !sel.has(id);
  const n = new Set(sel);
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) { if (on) n.add(order[i]); else n.delete(order[i]); }
  return n;
}

export type HeaderState = 'none' | 'some' | 'all';

/** The header checkbox: how many of the shown rows are ticked. */
export function headerState(sel: ReadonlySet<string>, shown: readonly string[]): HeaderState {
  if (!shown.length) return 'none';
  let n = 0;
  for (const id of shown) if (sel.has(id)) n++;
  return n === 0 ? 'none' : n === shown.length ? 'all' : 'some';
}

/** Click the header checkbox: all shown → none of them; otherwise → all of them. */
export function toggleAll(sel: ReadonlySet<string>, shown: readonly string[]): Set<string> {
  const n = new Set(sel);
  if (headerState(sel, shown) === 'all') for (const id of shown) n.delete(id);
  else for (const id of shown) n.add(id);
  return n;
}

/** What a drag that starts on `id` carries: every ticked row (shown order) when `id` is ticked, else just `id`. */
export function dragSet(sel: ReadonlySet<string>, order: readonly string[], id: string): string[] {
  if (!sel.has(id)) return [id];
  const out = order.filter((x) => sel.has(x));
  return out.length ? out : [id];
}
