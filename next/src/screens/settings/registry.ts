/**
 * Every setting row, in page order, for the search and the panes. Add a setting by adding a
 * record to its category's file; the search, the phone and the desktop pick it up from here.
 */
import { ABOUT_ROWS } from './aboutRows';
import { AI_ROWS } from './aiRows';
import { APPEARANCE_ROWS } from './appearanceRows';
import type { CategoryId, SettingDef } from './categories';
import { MODELS_ROWS } from './modelsRows';
import { COMPOSITION_ROWS } from '~/compose/settingsRows';
import { SERVERS_ROWS } from './serversRows';
import { SOUNDS_ROWS } from './soundsRows';
import { HINTS_ROWS } from './hintsRows';
import { GENERATE_ROWS } from './generateRows';
import { CURSOR_ROWS } from './cursorRows';
import { THEMES_ROWS } from './themesRows';

export const ALL_ROWS: readonly SettingDef[] = [...SERVERS_ROWS, ...GENERATE_ROWS, ...AI_ROWS, ...MODELS_ROWS, ...COMPOSITION_ROWS, ...APPEARANCE_ROWS, ...THEMES_ROWS, ...CURSOR_ROWS, ...SOUNDS_ROWS, ...HINTS_ROWS, ...ABOUT_ROWS];

export const rowsOf = (category: CategoryId): SettingDef[] => ALL_ROWS.filter((r) => r.category === category);

/** A category's rows under their group titles (ungrouped rows first), in first-seen order. */
export function groupedRows(rows: readonly SettingDef[]): Array<{ title?: string; rows: SettingDef[] }> {
  const out: Array<{ title?: string; rows: SettingDef[] }> = [];
  for (const r of rows) {
    const g = out.find((x) => x.title === r.group);
    if (g) g.rows.push(r);
    else out.push({ title: r.group, rows: [r] });
  }
  return out.sort((a, b) => Number(!!a.title) - Number(!!b.title));
}
