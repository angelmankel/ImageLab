/**
 * The phone's step sheet (mobile pass, m-create): what the desktop rail's badge popover says, as a
 * bottom sheet in thumb reach — the step, then why it cannot run, or what changed since its last
 * run with Re-run / Revert to last run (`StepBadgeDetails`, the same component), then Open the
 * step and More (the step's context menu: add after, run, rename, duplicate, move, remove).
 */
import { BottomSheet } from '~/phone';
import { IconDots, IconArrowRight } from '@tabler/icons-react';
import { useSteps, STEP_LABEL } from '~/app/stepsStore';
import { KIND_ICON } from '~/app/stepKindPicker';
import { openMenu } from '~/app/contextMenu';
import { useChainFreshness } from '~/app/stepFingerprint';
import { useStepProblem } from '~/screens/image/useStepProblem';
import { StepBadgeDetails } from '~/screens/image/rail/StepBadge';
import { Button } from '~/ui/Button';
import { T } from '~/theme/tokens';
import { closeStepSheet, useStepSheet } from './stepSheetStore';
import { usePhone } from './phoneStore';
import type { Step } from '~/app/stepsStore';

function Body({ step, index }: { step: Step; index: number }) {
  const fresh = useChainFreshness().get(step.id);
  const problem = useStepProblem(step);
  const Icon = KIND_ICON[step.kind];
  const open = () => { closeStepSheet(); useSteps.getState().setActive(step.id); usePhone.getState().setPage('create'); };
  const details = <StepBadgeDetails step={step} problem={problem} fresh={fresh} close={closeStepSheet} large />;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--il-elev)', color: 'var(--il-fg2)' }}><Icon size={19} stroke={2.2} /></span>
        <span style={{ minWidth: 0 }}>
          <span className="il-eyebrow" style={{ display: 'block' }}>Step {index + 1} · {STEP_LABEL[step.kind]}</span>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.name || STEP_LABEL[step.kind]}</span>
        </span>
      </div>
      {details && <div style={{ background: 'var(--il-card)', borderRadius: T.radius.lg, padding: 12 }}>{details}</div>}
      {!details && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--il-muted)' }}>{fresh?.state === 'fresh' ? 'Up to date.' : 'No output yet.'}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <Button size="lg" tone="card" grow icon={<IconArrowRight size={15} />} onClick={open}>Open step</Button>
        <Button size="lg" tone="card" grow icon={<IconDots size={15} />} onClick={(e) => { const el = e.currentTarget; closeStepSheet(); requestAnimationFrame(() => openMenu('step', step, el)); }}>More</Button>
      </div>
    </>
  );
}

export function StepSheet() {
  const stepId = useStepSheet((s) => s.stepId);
  const steps = useSteps((s) => s.steps);
  const index = stepId ? steps.findIndex((s) => s.id === stepId) : -1;
  const step = index >= 0 ? steps[index] : null;
  return (
    <BottomSheet opened={!!step} onClose={closeStepSheet} aria-label="Step">
      {step && <Body step={step} index={index} />}
    </BottomSheet>
  );
}
