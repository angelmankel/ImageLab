/**
 * Settings → Hints (item 26): the global on / off (same as the footer's bulb and the H key) and
 * every parameter's hint text, one row per parameter under its group, editable in place. An
 * edited text is saved in this browser and wins over the stock one; ↺ puts the stock text back.
 * The list itself is `~/ui/hints.ts` (HINTS).
 */
import { Textarea } from '@mantine/core';
import { IconArrowBackUp } from '@tabler/icons-react';
import { HINTS, hintOf, useHints, IconBtn, Switch, Button } from '~/ui';
import type { SettingDef } from './categories';

function EnabledCtl() {
  const on = useHints((s) => s.enabled);
  const setEnabled = useHints((s) => s.setEnabled);
  return <Switch label="" checked={on} onChange={setEnabled} />;
}

function ResetAllCtl() {
  const n = useHints((s) => Object.keys(s.overrides).length);
  const resetAll = useHints((s) => s.resetAll);
  return <Button size="sm" tone="outline" disabled={!n} onClick={resetAll}>{n ? `Reset ${n} edited` : 'Nothing edited'}</Button>;
}

function hintEditor(id: string) {
  return function HintCtl() {
    const override = useHints((s) => s.overrides[id]);
    const setHint = useHints((s) => s.setHint);
    const resetHint = useHints((s) => s.resetHint);
    const meta = hintOf(id, {});
    if (!meta) return <></>;
    return (
      <div style={{ width: '100%', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <Textarea
          aria-label={`${meta.label} hint`}
          value={override ?? meta.hint}
          onChange={(e) => setHint(id, e.currentTarget.value)}
          autosize minRows={2} maxRows={6}
          style={{ flex: 1, minWidth: 0 }}
          styles={{ input: { background: 'var(--il-panel)', border: '1px solid var(--il-line-strong)', borderRadius: 10, fontSize: 12, fontWeight: 600, color: override != null ? 'var(--il-fg)' : 'var(--il-fg2)', lineHeight: 1.45 } }}
        />
        <IconBtn size={32} icon={<IconArrowBackUp size={15} />} label="Back to the stock text" disabled={override == null} onClick={() => resetHint(id)} />
      </div>
    );
  };
}

export const HINTS_ROWS: readonly SettingDef[] = [
  {
    id: 'hints.enabled', category: 'hints', label: 'Show hints', compact: true,
    hint: 'Help text in the tooltip of every parameter. Also the bulb in the footer, or the H key.',
    keywords: ['tooltip', 'help', 'tips', 'explain', 'on', 'off', 'h'], Control: EnabledCtl,
  },
  {
    id: 'hints.reset', category: 'hints', label: 'Edited hints', compact: true,
    hint: 'Put every hint back to the stock text.',
    keywords: ['reset', 'restore', 'default'], Control: ResetAllCtl,
  },
  ...HINTS.map((h): SettingDef => ({
    id: `hints.${h.id}`, category: 'hints', group: h.group, label: h.label, wide: true,
    keywords: ['hint', 'tooltip', 'help', h.id, h.group.toLowerCase()],
    Control: hintEditor(h.id),
  })),
];
