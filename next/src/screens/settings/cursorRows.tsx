/** Settings → Themes → Motion & feel: "App cursors" on / off (fix list 2 #21, `~/app/cursors`). */
import { useCursors } from '~/app/cursors';
import { Switch } from '~/ui';
import type { SettingDef } from './categories';

function CursorsCtl() {
  const on = useCursors((s) => s.on);
  const setOn = useCursors((s) => s.setOn);
  return <Switch label="" checked={on} onChange={setOn} />;
}

export const CURSOR_ROWS: readonly SettingDef[] = [
  {
    id: 'themes.cursors', category: 'themes', group: 'Shape & depth', label: 'App cursors', compact: true,
    hint: "The app's own pointer, zoom, hand, move and resize cursors: a light outline round a dark core, clear on any picture. Off = the browser's.",
    keywords: ['cursor', 'mouse', 'pointer', 'zoom', 'hand', 'grab', 'crosshair'], Control: CursorsCtl,
  },
];
