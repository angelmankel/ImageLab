/**
 * Dock row 1 (rule 11): the chain of steps as pills — "1 · Image · 2 · Upscale · +". The active
 * step is ember; a tap jumps to it (a page swipe slides there instead); "+" adds a step. Scrolls
 * sideways when the chain is long, keeping the active pill in view.
 */
import { useEffect, useRef } from 'react';
import { Menu } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useSteps, STEP_LABEL, type StepKind } from '~/app/stepsStore';
import { T } from '~/theme/tokens';
import { stepChipLabel } from './phoneLogic';

const ADDABLE: StepKind[] = ['upscale', 'video', 'image', 'workflow'];

export function StepsStrip({ onJump }: { onJump: (id: string) => void }) {
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const addStep = useSteps((s) => s.addStep);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-step="${CSS.escape(activeId)}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  return (
    <div ref={ref} className="il-scroll-x" data-no-swipe style={{ display: 'flex', alignItems: 'center', gap: T.gap.sm, padding: '0 4px', touchAction: 'pan-x pan-y' }}>
      {steps.map((st, i) => {
        const on = st.id === activeId;
        return (
          <button
            key={st.id}
            type="button"
            data-step={st.id}
            aria-current={on ? 'step' : undefined}
            onClick={() => onJump(st.id)}
            style={{
              height: 40, padding: on ? '0 14px' : '0 12px', flex: 'none', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              border: on ? 0 : '1px solid var(--il-line-soft)', background: on ? 'var(--il-ember)' : 'var(--il-panel)',
              color: on ? 'var(--il-bg)' : 'var(--il-fg2)', fontWeight: on ? 800 : 700, fontSize: 12,
            }}
          >
            {stepChipLabel(i, STEP_LABEL[st.kind])}
          </button>
        );
      })}
      <Menu position="top" offset={10} withinPortal zIndex={T.z.popover} radius={14}>
        <Menu.Target>
          <button type="button" aria-label="Add a step"
            style={{ width: 40, height: 40, flex: 'none', borderRadius: '50%', border: '2px dashed var(--il-line-strong)', background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <IconPlus size={16} stroke={2.6} />
          </button>
        </Menu.Target>
        <Menu.Dropdown style={{ background: 'var(--il-elev)', border: '1px solid var(--il-line-soft)' }}>
          <Menu.Label>Add a step</Menu.Label>
          {ADDABLE.map((k) => (
            <Menu.Item key={k} onClick={() => addStep(k)} style={{ fontWeight: 700 }}>{STEP_LABEL[k]}</Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
