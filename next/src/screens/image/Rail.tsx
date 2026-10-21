/**
 * Rule 2 + fix list 8 / 17 / 24: the left rail IS the chain of steps (1 · Image → 2 · Refine →
 * … → + Add → Generate all), then at the bottom: History & collections · Models · ComfyUI ·
 * Settings.
 *
 * A step circle: click = open the step; click the step that is already open = fold / unfold the
 * step panel (8). A small × at its top right removes it (not step 1), no confirm, 3 s Undo (24).
 * Drag it up / down to reorder (a 6 px move starts the drag, so a click stays a click and the ×
 * never starts one); the connecting lines follow the order live and the chain re-links itself by
 * the I/O standard. A step that cannot run gets a red ring and says why on hover (17). ONE badge
 * (list 2 #17, `rail/StepBadge`): ✓ up to date · ↻ amber out of date (hover: what changed) · red !
 * cannot run · none = no output; the line under a step shows what flows down (`rail/StepConnector`).
 * A ring around the circle (list 2 #16, `rail/StepRing`) fills with the step's job progress; queued
 * = faint dashed; Generate all fills each step in turn and the line below lights up when it is done. "+ Add" opens THE step-kind picker (`~/app/stepKindPicker`).
 */
import { useRef, useState } from 'react';
import { IconPlus, IconHistory, IconCube, IconTopologyStar3, IconSettings, IconX } from '@tabler/icons-react';
import { useRoute, type Screen } from '~/app/routeStore';
import { useSteps, STEP_LABEL, type Step } from '~/app/stepsStore';
import { KIND_ICON, addStepWithPicker } from '~/app/stepKindPicker';
import { menuProps } from '~/app/contextMenu';
import { useRailDrop } from '~/dnd';
import { Tip } from '~/ui/Tip';
import { T } from '~/theme/tokens';
import { useStepOutput } from './useStepOutput';
import { useStepProblem } from './useStepProblem';
import { useLayout } from './layoutStore';
import { moveStepTo, removeStepWithUndo } from './stepActions';
import './stepMenuEntries';
import { useChainFreshness, type StepFresh } from '~/app/stepFingerprint';
import { StepBadge } from './rail/StepBadge';
import { StepConnector } from './rail/StepConnector';
import { StepRing, type RingState } from './rail/StepRing';
import { useQueue } from '~/app/queue';
import { GenerateAllButton, useGenerateAllAt, useGenerateAllCurrent } from './GenerateAll';

export { KIND_ICON } from '~/app/stepKindPicker';

/** Whether a step has produced output of its own (the check badge) — the same rule the next step chains by (`useStepOutput`). */
export function useStepHasOutput(step: Step): boolean {
  return !!useStepOutput(step);
}

/** Height of one step slot (circle + label + the line under it): the drag maths counts in slots. */
const SLOT = 46 + 5 + 14 + 26;
const DRAG_START = 6;
/** When the last drag ended: the click that follows a drop is not an "open". */
let dragEndedAt = 0;

function PlaceButton({ label, icon, on, onClick }: { label: string; icon: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <Tip label={label} position="right">
      <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} aria-label={label} className="il-btn"
        style={{ width: 40, height: 40, borderRadius: 12, border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', background: on ? 'var(--il-ember)' : 'transparent', color: on ? 'var(--il-bg)' : 'var(--il-muted)' }}>
        {icon}
      </button>
    </Tip>
  );
}

function StepNode({ step, index, lifted, onGrab, fresh, ring }: { step: Step; index: number; lifted: boolean; onGrab: (e: React.PointerEvent, id: string) => void; fresh: StepFresh | undefined; ring: RingState }) {
  const screen = useRoute((s) => s.screen);
  const on = useSteps((s) => s.activeId === step.id) && screen === 'step';
  const problem = useStepProblem(step);
  const [hover, setHover] = useState(false);
  const Icon = KIND_ICON[step.kind];
  const first = index === 0;
  const label = `${index + 1} · ${STEP_LABEL[step.kind]}`;
  const stale = fresh?.state === 'stale' ? ` — out of date: ${fresh.changes.join(' · ')}` : '';
  const tip = problem ? `${label} — ${problem}` : `${label} · ${step.name}${stale}${on && !stale ? ' (click to fold the panel)' : ''}`;

  const open = () => {
    const lay = useLayout.getState();
    if (on) { lay.toggleStep(); return; }
    useSteps.getState().setActive(step.id);
    useRoute.getState().go('step');
    if (!lay.stepOpen) lay.toggleStep();
  };

  return (
    <div onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} style={{ width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <span style={{ position: 'relative', width: 46, height: 46 }}>
        {/* Item 16: the job's progress around the circle; a step that cannot run keeps only its red ring. */}
        <StepRing ring={problem ? IDLE_RING : ring} ok={fresh?.state === 'fresh'} />
        <Tip label={tip} position="right">
          <button type="button" data-step-node={step.id} aria-current={on ? 'step' : undefined} aria-label={tip}
            onClick={() => { if (Date.now() - dragEndedAt < 250) return; open(); }}
            onPointerDown={first ? undefined : (e) => onGrab(e, step.id)}
            className="il-btn"
            style={{
              width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', padding: 0,
              cursor: first ? 'pointer' : lifted ? 'grabbing' : 'pointer',
              background: on ? 'var(--il-ember)' : 'var(--il-panel)', color: on ? 'var(--il-bg)' : 'var(--il-fg2)',
              border: on ? 0 : '1px solid var(--il-line-soft)',
              boxShadow: [
                problem ? '0 0 0 2px var(--il-err)' : on ? '0 0 0 4px color-mix(in srgb, var(--il-ember) 18%, transparent)' : '',
                lifted ? '0 10px 24px rgba(0,0,0,.45)' : '',
              ].filter(Boolean).join(', ') || undefined,
              transform: lifted ? 'scale(1.08)' : undefined, transition: 'transform .12s, box-shadow .12s',
            }}>
            <Icon size={20} stroke={2.2} />
          </button>
        </Tip>
        {!first && (hover || on) && !lifted && (
          <button type="button" aria-label={`Remove step ${index + 1}`} title="Remove this step (Undo in the note)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); removeStepWithUndo(step.id); }}
            style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', padding: 0, border: '1px solid var(--il-line-strong)', background: 'var(--il-elev)', color: 'var(--il-fg2)', display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 3 }}>
            <IconX size={11} stroke={3} />
          </button>
        )}
        <StepBadge stepId={step.id} problem={problem} fresh={fresh} />
      </span>
      <span style={{ fontSize: 10, fontWeight: on ? 800 : 700, whiteSpace: 'nowrap', color: problem ? 'var(--il-err)' : on ? 'var(--il-fg)' : 'var(--il-fg2)' }}>{label}</span>
    </div>
  );
}

const IDLE_RING: RingState = { kind: 'idle' };
const QUEUED_RING: RingState = { kind: 'queued' };

/**
 * Item 16: each step's ring from the job queue — its running job's progress, a faint dashed ring
 * while one of its jobs waits, and during Generate all the steps it will still re-run (not up to
 * date, below the one running now) wait dashed too; the step it is preparing turns.
 */
function useRings(fresh: ReadonlyMap<string, StepFresh>): (id: string, index: number) => RingState {
  const { rows } = useQueue();
  const allAt = useGenerateAllAt();
  const allCurrent = useGenerateAllCurrent();
  return (id, index) => {
    let queued = false;
    for (const r of rows) {
      if (r.stepId !== id) continue;
      if (r.status === 'running') return { kind: 'running', progress: r.progress ?? null };
      queued = true;
    }
    if (allCurrent === id) return { kind: 'running', progress: null };
    if (queued) return QUEUED_RING;
    if (allAt > 0 && index + 1 > allAt && fresh.get(id)?.state !== 'fresh') return QUEUED_RING;
    return IDLE_RING;
  };
}

/** The chain, with drag-to-reorder: the order shown follows the pointer live; the drop commits it. */
function StepChain() {
  const steps = useSteps((s) => s.steps);
  const fresh = useChainFreshness();
  const ringOf = useRings(fresh);
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null);
  const grab = useRef<{ id: string; y: number; top: number; from: number; el: HTMLElement; moved: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const order = (() => {
    if (!drag) return steps;
    const from = steps.findIndex((s) => s.id === drag.id);
    if (from < 0) return steps;
    const next = [...steps];
    const [s] = next.splice(from, 1);
    next.splice(drag.to, 0, s);
    return next;
  })();

  const onGrab = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    const from = steps.findIndex((s) => s.id === id);
    grab.current = { id, y: e.clientY, top: listRef.current?.getBoundingClientRect().top ?? 0, from, el: e.currentTarget as HTMLElement, moved: false };
    const move = (ev: PointerEvent) => {
      const g = grab.current;
      if (!g) return;
      if (!g.moved && Math.abs(ev.clientY - g.y) < DRAG_START) return;
      if (!g.moved) { g.moved = true; try { g.el.setPointerCapture(ev.pointerId); } catch { /* gone */ } }
      const scroll = listRef.current?.scrollTop ?? 0;
      const to = Math.max(1, Math.min(steps.length - 1, Math.floor((ev.clientY - g.top - 6 + scroll) / SLOT)));
      setDrag((d) => (d && d.to === to ? d : { id: g.id, to }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const g = grab.current;
      grab.current = null;
      if (g?.moved) {
        dragEndedAt = Date.now();
        setDrag((d) => { if (d && d.to !== g.from) moveStepTo(g.id, d.to); return null; });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div ref={listRef} className="il-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0, overflowX: 'hidden', flex: '0 1 auto', paddingTop: 6 }}>
      {order.map((st, i) => (
        <div key={st.id} style={{ height: SLOT, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div {...menuProps('step', st)}><StepNode step={st} index={i} lifted={drag?.id === st.id} onGrab={onGrab} fresh={fresh.get(st.id)} ring={ringOf(st.id, steps.findIndex((x) => x.id === st.id))} /></div>
          <StepConnector flows={!!order[i + 1]?.chained && !order[i + 1]?.input} state={fresh.get(st.id)?.state ?? 'none'} />
        </div>
      ))}
    </div>
  );
}

const PLACES: Array<{ key: Screen; label: string; icon: typeof IconHistory }> = [
  { key: 'library', label: 'History and collections', icon: IconHistory },
  { key: 'models', label: 'Models', icon: IconCube },
  { key: 'comfy', label: 'ComfyUI', icon: IconTopologyStar3 },
  { key: 'settings', label: 'Settings', icon: IconSettings },
];

export function Rail() {
  const screen = useRoute((s) => s.screen);
  const go = useRoute((s) => s.go);
  // Drop a picture on the rail → the step-kind picker → a new step with it as its input (fix list 42).
  const drop = useRailDrop();
  return (
    <nav aria-label="Steps" {...drop.props} style={{ boxShadow: drop.over ? 'inset 0 0 0 2px var(--il-ember)' : drop.active ? 'inset 0 0 0 2px var(--il-ember-line)' : undefined, background: drop.over ? 'var(--il-ember-soft)' : undefined, width: T.size.rail, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 12px', borderRight: '1px solid var(--il-line)', zIndex: T.z.rail, overflow: 'hidden' }}>
      <div className="il-eyebrow" style={{ marginBottom: 4 }}>Steps</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0, maxHeight: '64%' }}>
        <StepChain />
        <Tip label="Add a step after the open one" position="right">
          <button type="button" aria-label="Add a step" className="il-btn"
            onClick={(e) => addStepWithPicker(e.currentTarget, { after: useSteps.getState().activeId })}
            style={{ width: 72, border: 0, background: 'transparent', color: 'var(--il-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: 0, cursor: 'pointer', flex: 'none' }}>
            <span style={{ width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', border: '2px dashed var(--il-line-strong)' }}><IconPlus size={18} stroke={2.6} /></span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>Add</span>
          </button>
        </Tip>
        <GenerateAllButton />
      </div>
      <div style={{ flex: 1 }} />
      <span aria-hidden style={{ width: 40, height: 1, background: 'var(--il-line)', margin: '8px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {PLACES.map((p) => <PlaceButton key={p.key} label={p.label} icon={<p.icon size={19} stroke={2} />} on={screen === p.key} onClick={() => go(p.key)} />)}
      </div>
    </nav>
  );
}
