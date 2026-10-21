/**
 * One step on the phone's Session page (mobile pass, m-create; Donny's 2D map: the session level
 * lists its steps top to bottom, like the desktop rail): the step's newest output (or an empty
 * frame), its kind icon in a circle with the rail's ring (`StepRing`) and badge (`StepBadge`: ✓ / ↻ /
 * !, a tap = the step sheet), "Step 2 · Upscale", one line of state (Up to date · Out of date: what
 * changed · Can't run: why · Running 46% · Queued · Not run yet) and one line of what it is set
 * to. Tap = open the step (`onOpen`); long-press = the step's menu; ▶ = run this step now.
 */
import { IconPlayerPlay } from '@tabler/icons-react';
import { STEP_LABEL, type Step } from '~/app/stepsStore';
import { KIND_ICON } from '~/app/stepKindPicker';
import { menuProps } from '~/app/contextMenu';
import type { StepFresh } from '~/app/stepFingerprint';
import { useStepOutput } from '~/screens/image/useStepOutput';
import { useStepProblem } from '~/screens/image/useStepProblem';
import { runStepNow } from '~/screens/image/GenerateAll';
import { IDLE_RING } from '~/screens/image/Rail';
import { StepRing, type RingState } from '~/screens/image/rail/StepRing';
import { StepBadge } from '~/screens/image/rail/StepBadge';
import { VideoThumb } from '~/ui/VideoThumb';
import { haptic } from '~/phone';
import { T } from '~/theme/tokens';
import { vw } from '~/theme/uiScale';
import { openStepSheet } from '../stepSheetStore';
import { progressFraction } from '../phoneLogic';
import { useSectionSummary } from './sectionSummary';

const CIRCLE = 40;
const isClip = (name: string) => /\.(mp4|webm|mov|mkv)$/i.test(name);

function stateLine(problem: string | null, fresh: StepFresh | undefined, ring: RingState, hasOut: boolean): { text: string; color: string } {
  if (problem) return { text: `Can't run · ${problem}`, color: 'var(--il-err)' };
  if (ring.kind === 'running') {
    const f = progressFraction(ring.progress);
    return { text: f != null ? `Running · ${Math.round(f * 100)}%` : 'Running', color: 'var(--il-ok)' };
  }
  if (ring.kind === 'queued') return { text: 'Queued', color: 'var(--il-muted)' };
  if (fresh?.state === 'stale') return { text: `Out of date · ${fresh.changes[0] ?? 'settings changed'}`, color: 'var(--il-warn)' };
  if (fresh?.state === 'fresh') return { text: 'Up to date', color: 'var(--il-ok)' };
  return { text: hasOut ? 'Done' : 'Not run yet', color: 'var(--il-muted)' };
}

export function StepCard({ step, index, on, fresh, ring, onOpen, big }: {
  step: Step; index: number; on: boolean; fresh: StepFresh | undefined; ring: RingState;
  onOpen: (id: string) => void;
  /** The open step: its picture full width. Others: a thumbnail at the left. */
  big: boolean;
}) {
  const out = useStepOutput(step);
  const problem = useStepProblem(step);
  const summary = useSectionSummary(step, step.kind === 'image' ? 'prompt' : 'settings');
  const Icon = KIND_ICON[step.kind];
  const state = stateLine(problem, fresh, problem ? IDLE_RING : ring, !!out);
  const pic = out ? (isClip(out.name)
    ? <VideoThumb src={out.url} style={{ width: '100%', height: '100%' }} />
    : <img src={out.url} alt="" loading="lazy" decoding="async" draggable={false} style={{ width: '100%', height: '100%', objectFit: big ? 'contain' : 'cover', display: 'block' }} />)
    : null;

  return (
    <div {...menuProps('step', step)} role="button" tabIndex={0} aria-label={`Open step ${index + 1} · ${STEP_LABEL[step.kind]}`} aria-current={on ? 'step' : undefined}
      onClick={() => { haptic(); onOpen(step.id); }}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(step.id); }}
      style={{ margin: `0 ${T.pad.panel}px`, borderRadius: 18, background: 'var(--il-card)', overflow: 'hidden', cursor: 'pointer',
        boxShadow: on ? 'inset 0 0 0 2px var(--il-ember-line)' : undefined, WebkitTouchCallout: 'none', userSelect: 'none' }}>
      {big && (
        <div style={{ width: '100%', height: `min(${vw(56)}, 260px)`, background: 'var(--il-bg-deep)', display: 'grid', placeItems: 'center', color: 'var(--il-muted)', fontSize: 12, fontWeight: 700 }}>
          {pic ?? 'No output yet'}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px 10px 12px', minHeight: 64 }}>
        {!big && (
          <span style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flex: 'none', background: 'var(--il-bg-deep)', opacity: pic ? 1 : 0.5 }}>{pic}</span>
        )}
        <span style={{ position: 'relative', width: CIRCLE, height: CIRCLE, flex: 'none' }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', background: on ? 'var(--il-ember)' : 'var(--il-elev)', color: on ? 'var(--il-bg)' : 'var(--il-fg2)', boxShadow: problem ? '0 0 0 2px var(--il-err)' : undefined }}>
            <Icon size={19} stroke={2.2} />
          </span>
          <StepRing ring={problem ? IDLE_RING : ring} ok={fresh?.state === 'fresh'} circle={CIRCLE} />
          <span onClick={(e) => e.stopPropagation()}><StepBadge step={step} problem={problem} fresh={fresh} onTap={() => openStepSheet(step.id)} small /></span>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="il-eyebrow" style={{ display: 'block', color: on ? 'var(--il-ember)' : undefined }}>Step {index + 1} · {step.name || STEP_LABEL[step.kind]}</span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: state.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.text}</span>
          {summary && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>}
        </span>
        <button type="button" aria-label={`Run step ${index + 1}`} onClick={(e) => { e.stopPropagation(); haptic(); void runStepNow(step); }}
          style={{ width: 44, height: 44, flex: 'none', border: 0, borderRadius: '50%', background: 'var(--il-elev)', color: 'var(--il-ember-hi)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <IconPlayerPlay size={18} stroke={2.4} />
        </button>
      </div>
    </div>
  );
}
