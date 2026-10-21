/**
 * Settings → Generate (fix list 2 #25): the values the Generate button's ×N steps through, ONE list
 * for every step (default 1 / 2 / 3). Tap a value to take it out, + to add one (1–16).
 * Store = `~/app/batchCycle`.
 */
import { useState } from 'react';
import { Popover } from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';
import { BATCH_MAX, DEFAULT_CYCLE, useBatchCycle, useCycleList } from '~/app/batchCycle';
import { Button, Tip } from '~/ui';
import { T } from '~/theme/tokens';
import type { SettingDef } from './categories';

function CycleCtl() {
  const list = useCycleList();
  const setList = useBatchCycle((s) => s.setList);
  const [adding, setAdding] = useState(false);
  const free = Array.from({ length: BATCH_MAX }, (_, i) => i + 1).filter((n) => !list.includes(n));
  const isDefault = list.join() === DEFAULT_CYCLE.join();
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {list.map((n) => (
        <Tip key={n} label={list.length > 1 ? `Remove ×${n}` : 'Keep one value'}>
          <button type="button" className="il-btn" disabled={list.length <= 1} aria-label={`Remove ×${n}`} onClick={() => setList(list.filter((v) => v !== n))}
            style={{ height: 40, minWidth: 40, padding: '0 8px 0 12px', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg)', fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
            ×{n}{list.length > 1 && <IconX size={12} stroke={2.4} style={{ opacity: 0.6 }} />}
          </button>
        </Tip>
      ))}
      {free.length > 0 && (
        <Popover opened={adding} onChange={setAdding} position="bottom-start" shadow="lg" withinPortal zIndex={T.z.popover}>
          <Popover.Target>
            <Button size="sm" tone="card" h={40} icon={<IconPlus size={14} />} tooltip="Add a value" onClick={() => setAdding((o) => !o)} on={adding} />
          </Popover.Target>
          <Popover.Dropdown style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.lg, padding: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 40px)', gap: 4 }}>
              {free.map((n) => (
                <Button key={n} size="sm" tone="card" h={40} onClick={() => { setList([...list, n]); setAdding(false); }} style={{ fontVariantNumeric: 'tabular-nums' }}>×{n}</Button>
              ))}
            </div>
          </Popover.Dropdown>
        </Popover>
      )}
      {!isDefault && <Button size="sm" tone="ghost" h={40} tooltip="Back to 1 / 2 / 3" onClick={() => setList(DEFAULT_CYCLE)}>Reset</Button>}
    </div>
  );
}

export const GENERATE_ROWS: readonly SettingDef[] = [
  {
    id: 'generate.batchCycle', category: 'generate', label: 'Images per run', wide: true,
    hint: 'The values the ×N on the Generate button steps through, for every step. Tap a value to remove it.',
    keywords: ['batch', 'cycle', 'count', 'images', 'x2', 'x3', 'times', 'multiple', 'generate'],
    Control: CycleCtl,
  },
];
