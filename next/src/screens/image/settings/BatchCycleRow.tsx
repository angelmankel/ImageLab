/**
 * Item 18: the step's ×N cycle, edited in the Parameters tab. The values the Generate button's ×N
 * steps through (default 1 / 2 / 3): tap a value to take it out, + to add one (1–16). The ×N at the
 * left is the current batch, tap to cycle (the phone's way to set it; desktop has it on Generate too).
 */
import { useState } from 'react';
import { Popover } from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useActiveStep } from '~/app/stepsStore';
import { BATCH_MAX, nextInCycle, useBatchCycle, useCycleOf } from '~/app/batchCycle';
import { Button, Tip } from '~/ui';
import { T } from '~/theme/tokens';

export function BatchCycleRow() {
  const step = useActiveStep();
  const list = useCycleOf(step.id);
  const setList = useBatchCycle((s) => s.setList);
  const batch = useStore((s) => s.workflow.batch);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const [adding, setAdding] = useState(false);
  const free = Array.from({ length: BATCH_MAX }, (_, i) => i + 1).filter((n) => !list.includes(n));
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '6px 8px 6px 12px', borderRadius: T.radius.lg, background: 'var(--il-card)', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)', flex: 'none' }}>Batch</span>
      <Button size="sm" tone="primary" tooltip={`Images per Generate · tap for ×${nextInCycle(list, batch)}`} onClick={() => setWorkflow({ batch: nextInCycle(list, batch) })} style={{ minWidth: 44, fontVariantNumeric: 'tabular-nums' }}>×{batch}</Button>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', marginLeft: 4 }}>Cycle</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
        {list.map((n) => (
          <Tip key={n} label={list.length > 1 ? `Take ×${n} out of the cycle` : 'The cycle needs one value'}>
            <button type="button" className="il-btn" disabled={list.length <= 1} onClick={() => setList(step.id, list.filter((v) => v !== n))}
              style={{ height: 30, padding: '0 6px 0 10px', border: 0, borderRadius: 999, background: n === batch ? 'var(--il-ember-soft)' : 'var(--il-card-on)', color: n === batch ? 'var(--il-ember-hi)' : 'var(--il-fg)', boxShadow: n === batch ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
              ×{n}{list.length > 1 && <IconX size={12} stroke={2.4} style={{ opacity: 0.6 }} />}
            </button>
          </Tip>
        ))}
        {free.length > 0 && (
          <Popover opened={adding} onChange={setAdding} position="bottom-end" shadow="lg" withinPortal zIndex={T.z.popover}>
            <Popover.Target>
              <Button size="sm" tone="card" icon={<IconPlus size={14} />} tooltip="Add a value to the cycle" onClick={() => setAdding((o) => !o)} on={adding} />
            </Popover.Target>
            <Popover.Dropdown style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.lg, padding: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 40px)', gap: 4 }}>
                {free.map((n) => (
                  <Button key={n} size="sm" tone="card" h={40} onClick={() => { setList(step.id, [...list, n]); setAdding(false); }} style={{ fontVariantNumeric: 'tabular-nums' }}>×{n}</Button>
                ))}
              </div>
            </Popover.Dropdown>
          </Popover>
        )}
      </div>
    </div>
  );
}
