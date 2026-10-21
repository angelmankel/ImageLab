/**
 * What a pick from the model picker does to a slot list (fix list 2, added item: "Change ADDS a
 * second model instead of replacing it"). Change ALWAYS replaces the target entry in place —
 * same position, its strength / switch kept — and never appends; only "+ Add" adds (and an Add of
 * a file the list already has just selects that entry). Pure (type imports only), so
 * `tests/pickPlan.test.cjs` loads it from source.
 */
import type { PickTarget } from './kindApi';

export type PickPlan =
  | { op: 'rename'; id: string; file: string }
  | { op: 'select'; id: string }
  | { op: 'add'; file: string }
  | { op: 'change-pending'; id: string }
  | { op: 'add-pending' }
  | { op: 'none' };

export function planPick(target: PickTarget, pick: { installed: boolean; file: string | null }, entries: readonly { id: string; name: string }[]): PickPlan {
  if (target.mode === 'change') {
    if (!entries.some((e) => e.id === target.id)) return { op: 'none' };
    if (pick.installed && pick.file) return { op: 'rename', id: target.id, file: pick.file };
    return { op: 'change-pending', id: target.id };
  }
  if (pick.installed && pick.file) {
    const have = entries.find((e) => e.name === pick.file);
    return have ? { op: 'select', id: have.id } : { op: 'add', file: pick.file };
  }
  return { op: 'add-pending' };
}

/** A rename applied to a list: the entry keeps its place and every other field. */
export function renameIn<T extends { id: string; name: string }>(list: readonly T[], id: string, name: string): T[] {
  return list.map((e) => (e.id === id ? { ...e, name } : e));
}
