/**
 * Rule 2: the left rail IS the chain of steps (1 · Image → 2 · Upscale → … → + Add), a check badge
 * on a step that has output, then at the bottom: History & collections · Models · ComfyUI ·
 * Settings. "+ Add" opens a small picker: Upscale / Video / Workflow.
 */
import { Menu } from '@mantine/core';
import { IconPhoto, IconArrowsMaximize, IconMovie, IconGitBranch, IconPlus, IconHistory, IconCube, IconTopologyStar3, IconSettings, IconCheck } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useRoute, type Screen } from '~/app/routeStore';
import { useSteps, STEP_LABEL, type Step, type StepKind } from '~/app/stepsStore';
import { T } from '~/theme/tokens';

export const KIND_ICON: Record<StepKind, typeof IconPhoto> = { image: IconPhoto, upscale: IconArrowsMaximize, video: IconMovie, workflow: IconGitBranch };

/** Whether a step has produced output (the check badge). */
export function useStepHasOutput(step: Step): boolean {
  const images = useStore((s) => s.history.length > 0);
  const videos = useVideoRun((s) => s.results.length > 0);
  const runs = useWorkflowRun((s) => s.results.length > 0);
  if (step.kind === 'image') return images;
  if (step.kind === 'video') return videos;
  if (step.kind === 'workflow') return runs;
  return false;
}

function RailButton({ label, icon, on, onClick, kind = 'place', done }: { label: string; icon: React.ReactNode; on: boolean; onClick?: () => void; kind?: 'step' | 'place' | 'add'; done?: boolean }) {
  const size = kind === 'place' ? 40 : 46;
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} aria-label={label} style={{ width: 72, border: 0, background: 'transparent', color: on ? 'var(--il-fg)' : kind === 'add' ? 'var(--il-muted)' : 'var(--il-fg2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: 0, cursor: 'pointer' }}>
      <span style={{
        position: 'relative', width: size, height: size, borderRadius: kind === 'place' ? 12 : '50%', display: 'grid', placeItems: 'center',
        background: on ? 'var(--il-ember)' : kind === 'place' || kind === 'add' ? 'transparent' : 'var(--il-panel)', color: on ? 'var(--il-bg)' : kind === 'place' ? 'var(--il-muted)' : 'var(--il-fg2)',
        border: on || kind === 'place' ? 0 : kind === 'add' ? '2px dashed #3A3A44' : '1px solid var(--il-line-soft)',
        boxShadow: on && kind === 'step' ? '0 0 0 4px rgba(240,134,58,.18)' : undefined,
      }}>
        {icon}
        {done && <span style={{ position: 'absolute', right: -2, top: -2, width: 16, height: 16, borderRadius: '50%', background: 'var(--il-ok)', color: 'var(--il-bg)', display: 'grid', placeItems: 'center' }}><IconCheck size={10} stroke={3.5} /></span>}
      </span>
      {kind !== 'place' && <span style={{ fontSize: 10, fontWeight: on ? 800 : 700, whiteSpace: 'nowrap' }}>{label}</span>}
    </button>
  );
}

function StepButton({ step, index }: { step: Step; index: number }) {
  const screen = useRoute((s) => s.screen);
  const go = useRoute((s) => s.go);
  const activeId = useSteps((s) => s.activeId);
  const setActive = useSteps((s) => s.setActive);
  const done = useStepHasOutput(step);
  const Icon = KIND_ICON[step.kind];
  return (
    <RailButton kind="step" label={`${index + 1} · ${STEP_LABEL[step.kind]}`} icon={<Icon size={20} stroke={2.2} />} done={done}
      on={screen === 'step' && step.id === activeId} onClick={() => { setActive(step.id); go('step'); }} />
  );
}

const ADD: Array<{ kind: StepKind; label: string; hint: string }> = [
  { kind: 'upscale', label: 'Upscale', hint: 'Bigger, sharper' },
  { kind: 'video', label: 'Video', hint: 'Animate the picture' },
  { kind: 'workflow', label: 'Workflow', hint: 'Any saved ComfyUI workflow' },
];

const PLACES: Array<{ key: Screen; label: string; icon: typeof IconPhoto }> = [
  { key: 'library', label: 'History and collections', icon: IconHistory },
  { key: 'models', label: 'Models', icon: IconCube },
  { key: 'comfy', label: 'ComfyUI', icon: IconTopologyStar3 },
  { key: 'settings', label: 'Settings', icon: IconSettings },
];

export function Rail() {
  const screen = useRoute((s) => s.screen);
  const go = useRoute((s) => s.go);
  const steps = useSteps((s) => s.steps);
  const addStep = useSteps((s) => s.addStep);
  return (
    <nav aria-label="Steps" style={{ width: T.size.rail, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 12px', borderRight: '1px solid var(--il-line)', zIndex: T.z.rail, overflow: 'hidden' }}>
      <div className="il-eyebrow" style={{ marginBottom: 10 }}>Steps</div>
      <div className="il-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0, overflowX: 'hidden', flex: 'none', maxHeight: '60%' }}>
        {steps.map((st, i) => (
          <div key={st.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <StepButton step={st} index={i} />
            <span aria-hidden style={{ width: 2, height: 18, background: steps[i + 1]?.chained ? 'var(--il-ok)' : 'var(--il-line-strong)', margin: '4px 0' }} />
          </div>
        ))}
        <Menu position="right-start" shadow="lg" width={220} withinPortal zIndex={T.z.popover}>
          <Menu.Target>
            <div><RailButton kind="add" label="Add" icon={<IconPlus size={18} stroke={2.6} />} on={false} /></div>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Add a step</Menu.Label>
            {ADD.map((a) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <Menu.Item key={a.kind} leftSection={<Icon size={16} stroke={2} />} onClick={() => { addStep(a.kind); go('step'); }}>
                  <div style={{ fontWeight: 700 }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>{a.hint}</div>
                </Menu.Item>
              );
            })}
          </Menu.Dropdown>
        </Menu>
      </div>
      <div style={{ flex: 1 }} />
      <span aria-hidden style={{ width: 40, height: 1, background: 'var(--il-line)', margin: '8px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {PLACES.map((p) => <RailButton key={p.key} label={p.label} icon={<p.icon size={19} stroke={2} />} on={screen === p.key} onClick={() => go(p.key)} />)}
      </div>
    </nav>
  );
}
