/**
 * Library (rule 12): "Send to step ▾" — the chain of steps (rule 2); a tap makes the item that
 * step's input and goes to the step. The target must be a ref-able element.
 */
import type { ReactElement } from 'react';
import { Menu } from '@mantine/core';
import { useSteps, STEP_LABEL } from '~/app/stepsStore';
import { T } from '~/theme/tokens';
import type { LibItem } from './libraryLogic';
import { sendItemToStep } from './libraryActions';

export function SendToStepMenu({ item, children, position = 'bottom' }: { item: LibItem; children: ReactElement; position?: 'bottom' | 'top' }) {
  const steps = useSteps((s) => s.steps);
  return (
    <Menu position={position} zIndex={T.z.popover} width={220} radius={T.radius.md} shadow="lg">
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Use as the input of</Menu.Label>
        {steps.map((s, i) => (
          <Menu.Item key={s.id} onClick={() => sendItemToStep(item, s.id)} style={{ fontWeight: 700 }}
            rightSection={<span style={{ color: 'var(--il-muted)', fontSize: 11, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>}>
            {i + 1} · {STEP_LABEL[s.kind]}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
