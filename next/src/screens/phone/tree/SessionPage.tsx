/**
 * The phone's Session page body (mobile pass, m-create; Donny's 2D map, depth 1): the session's
 * chain of steps, top to bottom like the desktop rail — the open step's card shows its picture big,
 * the others a thumbnail — joined by the rail's connector (green = an up-to-date output flows down,
 * amber dashed = the step above is out of date). Under them: + Add a step (THE kind picker) and
 * Generate all (stale steps only). Tap a card = go one layer deeper into that step (`onOpenStep`).
 * The frame (crumbs, HUD band, the stacked-card navigation) is m-shell's `usePhoneNav`.
 */
import { IconPlayerPlay, IconPlayerStop, IconPlus } from '@tabler/icons-react';
import { useSteps } from '~/app/stepsStore';
import { addStepWithPicker } from '~/app/stepKindPicker';
import { useChainFreshness } from '~/app/stepFingerprint';
import { generateAll, useGenerateAll } from '~/screens/image/GenerateAll';
import { useRings } from '~/screens/image/Rail';
import { Button } from '~/ui/Button';
import { T } from '~/theme/tokens';
import { StepCard } from './StepCard';

function Connector({ flows, state }: { flows: boolean; state: 'fresh' | 'stale' | 'none' }) {
  const lit = flows && state === 'fresh';
  const stale = flows && state === 'stale';
  return (
    <span aria-hidden style={{
      display: 'block', width: 2, height: 14, marginLeft: T.pad.panel + 12 + 19, borderRadius: 1,
      background: lit ? 'var(--il-ok)' : stale ? 'repeating-linear-gradient(to bottom, var(--il-warn) 0 4px, transparent 4px 7px)' : 'var(--il-line-strong)',
    }} />
  );
}

export function SessionPageBody({ onOpenStep }: { onOpenStep: (id: string) => void }) {
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const fresh = useChainFreshness();
  const ringOf = useRings(fresh);
  const allRunning = useGenerateAll();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 12 }}>
      {steps.map((st, i) => (
        <div key={st.id}>
          <StepCard step={st} index={i} on={st.id === activeId} big={st.id === activeId} fresh={fresh.get(st.id)} ring={ringOf(st.id, i)} onOpen={onOpenStep} />
          {i < steps.length - 1 && <Connector flows={!!steps[i + 1].chained && !steps[i + 1].input} state={(fresh.get(st.id)?.state ?? 'none') as 'fresh' | 'stale' | 'none'} />}
        </div>
      ))}
      <div style={{ display: 'flex', gap: T.gap.md, padding: `${T.gap.lg}px ${T.pad.panel}px 0` }}>
        <Button size="lg" tone="card" grow icon={<IconPlus size={16} />} onClick={(e) => addStepWithPicker(e.currentTarget, { after: steps[steps.length - 1]?.id })}>Add a step</Button>
        {steps.length > 1 && (
          <Button size="lg" tone="card" grow icon={allRunning ? <IconPlayerStop size={15} /> : <IconPlayerPlay size={15} />} onClick={() => void generateAll()}
            style={{ color: 'var(--il-ember-hi)' }}>{allRunning ? 'Stop' : 'Generate all'}</Button>
        )}
      </div>
    </div>
  );
}
