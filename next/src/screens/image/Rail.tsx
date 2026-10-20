/**
 * Rule 2: the left rail IS the chain of steps (1 · Image → 2 · Upscale → … → + Add), then at the
 * bottom: History & collections · Models · ComfyUI · Settings.
 */
import { IconPhoto, IconArrowsMaximize, IconMovie, IconGitBranch, IconPlus, IconHistory, IconCube, IconTopologyStar3, IconSettings, IconCheck } from '@tabler/icons-react';
import { useRoute, type Screen } from '~/app/routeStore';
import { useSteps, STEP_LABEL, type StepKind } from '~/app/stepsStore';
import { T } from '~/theme/tokens';

const KIND_ICON: Record<StepKind, typeof IconPhoto> = { image: IconPhoto, upscale: IconArrowsMaximize, video: IconMovie, workflow: IconGitBranch };

function RailButton({ label, icon, on, onClick, kind = 'place', done }: { label: string; icon: React.ReactNode; on: boolean; onClick: () => void; kind?: 'step' | 'place' | 'add'; done?: boolean }) {
  const size = kind === 'place' ? 38 : 46;
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} style={{ width: 72, border: 0, background: 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-fg2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: 0, cursor: 'pointer' }}>
      <span style={{
        position: 'relative', width: size, height: size, borderRadius: kind === 'place' ? 12 : '50%', display: 'grid', placeItems: 'center',
        background: on ? 'var(--il-ember)' : 'var(--il-panel)', color: on ? 'var(--il-bg)' : 'var(--il-fg2)',
        border: on ? 0 : kind === 'add' ? '1px dashed var(--il-ok)' : '1px solid var(--il-line-soft)',
        boxShadow: on ? '0 0 0 4px rgba(240,134,58,.18)' : undefined,
      }}>
        {icon}
        {done && <span style={{ position: 'absolute', right: -2, top: -2, width: 16, height: 16, borderRadius: '50%', background: 'var(--il-ok)', color: 'var(--il-bg)', display: 'grid', placeItems: 'center' }}><IconCheck size={10} stroke={3.5} /></span>}
      </span>
      <span style={{ fontSize: 10, fontWeight: on ? 800 : 700, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

const PLACES: Array<{ key: Screen; label: string; icon: typeof IconPhoto }> = [
  { key: 'library', label: 'History', icon: IconHistory },
  { key: 'models', label: 'Models', icon: IconCube },
  { key: 'comfy', label: 'ComfyUI', icon: IconTopologyStar3 },
  { key: 'settings', label: 'Settings', icon: IconSettings },
];

export function Rail() {
  const screen = useRoute((s) => s.screen);
  const go = useRoute((s) => s.go);
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const setActive = useSteps((s) => s.setActive);
  const addStep = useSteps((s) => s.addStep);
  return (
    <nav aria-label="Steps" style={{ width: T.size.rail, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 12px', borderRight: '1px solid var(--il-line)', zIndex: T.z.rail }}>
      <div className="il-eyebrow" style={{ marginBottom: 10 }}>Steps</div>
      {steps.map((st, i) => {
        const Icon = KIND_ICON[st.kind];
        return (
          <div key={st.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <RailButton kind="step" label={`${i + 1} · ${STEP_LABEL[st.kind]}`} icon={<Icon size={20} stroke={2.2} />} on={screen === 'step' && st.id === activeId} onClick={() => { setActive(st.id); go('step'); }} />
            <span aria-hidden style={{ width: 2, height: 18, background: st.chained || i === 0 ? 'var(--il-ok)' : 'var(--il-line-strong)', margin: '4px 0' }} />
          </div>
        );
      })}
      <RailButton kind="add" label="Add" icon={<IconPlus size={20} stroke={2.2} />} on={false} onClick={() => { addStep('upscale'); go('step'); }} />
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {PLACES.map((p) => <RailButton key={p.key} label={p.label} icon={<p.icon size={18} stroke={2} />} on={screen === p.key} onClick={() => go(p.key)} />)}
      </div>
    </nav>
  );
}
