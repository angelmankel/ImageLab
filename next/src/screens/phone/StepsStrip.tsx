/**
 * The phone's steps strip (mobile pass, m-create): the desktop rail laid sideways, in the dock.
 * Each step is a node pill — its kind icon in a circle + "1 · Image" — with the rail's own pieces:
 * the progress ring (`StepRing`: green arc = its job, dashed = queued, Generate all's turn), the ONE
 * badge (`StepBadge`: ✓ up to date · ↻ out of date · ! can't run; a tap on ↻ / ! opens the step
 * sheet, no hover anywhere), and a connector to the next step (lit green when an up-to-date output
 * flows down, amber dashed when the step above is out of date).
 *   tap a step = jump there (a page swipe slides there instead) · tap the open step = its sheet
 *   long-press = the step's context menu (add after, run, rename, duplicate, move, remove)
 *   + = THE step-kind picker (`addStepWithPicker`) · "All" (2+ steps) = Generate all, stale steps only
 * Scrolls sideways when the chain is long, keeping the open step in view.
 */
import { useEffect, useRef } from 'react';
import { IconPlayerPlay, IconPlayerStop, IconPlus } from '@tabler/icons-react';
import { useSteps, STEP_LABEL, type Step } from '~/app/stepsStore';
import { KIND_ICON, addStepWithPicker } from '~/app/stepKindPicker';
import { menuProps } from '~/app/contextMenu';
import { useChainFreshness, type StepFresh } from '~/app/stepFingerprint';
import { generateAll, useGenerateAll } from '~/screens/image/GenerateAll';
import { useRings, IDLE_RING } from '~/screens/image/Rail';
import { StepRing, type RingState } from '~/screens/image/rail/StepRing';
import { StepBadge } from '~/screens/image/rail/StepBadge';
import { useStepProblem } from '~/screens/image/useStepProblem';
import { T } from '~/theme/tokens';
import { stepChipLabel } from './phoneLogic';
import { openStepSheet } from './stepSheetStore';

const H = 40;
const CIRCLE = 32;

function Node({ step, index, on, fresh, ring, onJump }: { step: Step; index: number; on: boolean; fresh: StepFresh | undefined; ring: RingState; onJump: (id: string) => void }) {
  const problem = useStepProblem(step);
  const Icon = KIND_ICON[step.kind];
  const sheet = () => openStepSheet(step.id);
  return (
    <div {...menuProps('step', step)} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        data-step={step.id}
        aria-current={on ? 'step' : undefined}
        aria-label={`Step ${stepChipLabel(index, STEP_LABEL[step.kind])}${problem ? ", can't run" : fresh?.state === 'stale' ? ', out of date' : ''}`}
        onClick={() => (on ? sheet() : onJump(step.id))}
        style={{
          height: H, padding: '0 13px 0 4px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 7,
          border: on ? 0 : '1px solid var(--il-line-soft)', background: on ? 'var(--il-ember)' : 'var(--il-panel)',
          color: on ? 'var(--il-bg)' : problem ? 'var(--il-err)' : 'var(--il-fg2)', fontWeight: on ? 800 : 700, fontSize: 12,
          boxShadow: problem ? 'inset 0 0 0 2px var(--il-err)' : undefined, touchAction: 'manipulation',
          WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        <span aria-hidden style={{ width: CIRCLE, height: CIRCLE, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: on ? 'color-mix(in srgb, var(--il-bg) 18%, transparent)' : 'var(--il-elev)' }}>
          <Icon size={16} stroke={2.2} />
        </span>
        {stepChipLabel(index, STEP_LABEL[step.kind])}
      </button>
      {/* Ring + badge sit on the circle (4 px in from the pill's left, centred). */}
      <span style={{ position: 'absolute', left: on ? 4 : 5, top: (H - CIRCLE) / 2, width: CIRCLE, height: CIRCLE, pointerEvents: 'none' }}>
        <StepRing ring={problem ? IDLE_RING : ring} ok={fresh?.state === 'fresh'} circle={CIRCLE} />
        <span style={{ pointerEvents: 'auto' }}><StepBadge step={step} problem={problem} fresh={fresh} onTap={sheet} small /></span>
      </span>
    </div>
  );
}

/** The line to the next step, sideways (the rail's `StepConnector` turned 90°). */
function Link({ flows, state }: { flows: boolean; state: StepFresh['state'] }) {
  const lit = flows && state === 'fresh';
  const stale = flows && state === 'stale';
  return (
    <span aria-hidden style={{
      width: 12, height: 2, flex: 'none', borderRadius: 1,
      background: lit ? 'var(--il-ok)' : stale ? 'repeating-linear-gradient(to right, var(--il-warn) 0 4px, transparent 4px 7px)' : 'var(--il-line-strong)',
      transition: 'background calc(.3s * var(--il-motion)) ease',
    }} />
  );
}

export function StepsStrip({ onJump }: { onJump: (id: string) => void }) {
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const fresh = useChainFreshness();
  const ringOf = useRings(fresh);
  const allRunning = useGenerateAll();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-step="${CSS.escape(activeId)}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const round: React.CSSProperties = { height: H, flex: 'none', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', touchAction: 'manipulation' };

  return (
    <div ref={ref} className="il-scroll-x" data-no-swipe style={{ display: 'flex', alignItems: 'center', padding: '4px 4px', touchAction: 'pan-x pan-y', scrollbarWidth: 'none' }}>
      {steps.map((st, i) => (
        <div key={st.id} style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
          <Node step={st} index={i} on={st.id === activeId} fresh={fresh.get(st.id)} ring={ringOf(st.id, i)} onJump={onJump} />
          {i < steps.length - 1 && <Link flows={!!steps[i + 1].chained && !steps[i + 1].input} state={fresh.get(st.id)?.state ?? 'none'} />}
        </div>
      ))}
      <button type="button" aria-label="Add a step" onClick={(e) => addStepWithPicker(e.currentTarget, { after: activeId })}
        style={{ ...round, width: H, marginLeft: T.gap.sm, border: '2px dashed var(--il-line-strong)', background: 'transparent', color: 'var(--il-muted)' }}>
        <IconPlus size={16} stroke={2.6} />
      </button>
      {steps.length > 1 && (
        <button type="button" aria-label={allRunning ? 'Stop Generate all' : 'Generate all steps'} onClick={() => void generateAll()}
          style={{ ...round, padding: '0 13px', marginLeft: 6, border: 0, background: allRunning ? 'var(--il-card-on)' : 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', boxShadow: 'inset 0 0 0 1px var(--il-ember-line)', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
          {allRunning ? <IconPlayerStop size={14} stroke={2.6} /> : <IconPlayerPlay size={14} stroke={2.6} />}{allRunning ? 'Stop' : 'All'}
        </button>
      )}
    </div>
  );
}
