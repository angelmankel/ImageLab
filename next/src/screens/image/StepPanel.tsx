/**
 * Rule 3: the step panel. A sticky dark block (edge to edge, #0F0F11) = the workflow row + the 4
 * tabs Prompt · Model · Settings · Input; one tab body at a time, scrolling; at the bottom the
 * Generate group (left out on the phone: the dock has Generate). Steps 2+ share the chrome; their
 * Prompt / Model / Settings say the workflow is coming, Input is the chain input.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { IconAlignLeft, IconCube, IconAdjustmentsHorizontal, IconPhoto } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useSteps, type Step } from '~/app/stepsStore';
import { Tabs } from '~/ui';
import { useLayout, type StepTab } from './layoutStore';
import { WorkflowRow } from './WorkflowRow';
import { GenerateBar } from './GenerateBar';
import { PromptTab } from './PromptTab';
import { InputTab } from './InputTab';
import { ModelTab } from './model';
import { SettingsTab } from './settings';

const TABS: Array<{ key: StepTab; label: ReactNode; title: string }> = [
  { key: 'prompt', label: <><IconAlignLeft size={15} stroke={2.2} />Prompt</>, title: 'Prompt' },
  { key: 'model', label: <><IconCube size={15} stroke={2.2} />Model</>, title: 'Model' },
  { key: 'settings', label: <><IconAdjustmentsHorizontal size={15} stroke={2.2} />Settings</>, title: 'Settings' },
  { key: 'input', label: <><IconPhoto size={15} stroke={2.2} />Input</>, title: 'Input' },
];

/** Marks the Image step "edited" once its workflow or prompt changes after mount. */
function useEditedTracking(step: Step) {
  const workflow = useStore((s) => s.workflow);
  const layers = useStore((s) => s.layers);
  const updateStep = useSteps((s) => s.updateStep);
  const seen = useRef<{ w: unknown; l: unknown } | null>(null);
  useEffect(() => {
    if (step.kind !== 'image') return;
    if (!seen.current) { seen.current = { w: workflow, l: layers }; return; }
    if (seen.current.w !== workflow || seen.current.l !== layers) {
      seen.current = { w: workflow, l: layers };
      if (!step.edited) updateStep(step.id, { edited: true });
    }
  }, [workflow, layers, step.id, step.kind, step.edited, updateStep]);
}

function ComingSoon({ step }: { step: Step }) {
  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '28px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>This step's workflow is coming</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', marginTop: 6 }}>{step.kind === 'video' ? 'Generate runs the Video workflow with its saved settings.' : step.kind === 'workflow' ? 'Generate runs the saved ComfyUI workflow.' : 'Chain it to the previous step in the Input tab.'}</div>
    </div>
  );
}

export function StepPanel({ phone = false, stepId }: { phone?: boolean; stepId?: string }) {
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const step = steps.find((s) => s.id === (stepId ?? activeId)) ?? steps[0];
  const tab = useLayout((s) => s.tab);
  const setTab = useLayout((s) => s.setTab);
  useEditedTracking(step);
  const image = step.kind === 'image';

  return (
    <section aria-label={`${step.name} panel`} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-panel)' }}>
      <div style={{ background: 'var(--il-bg-deep)', borderBottom: '1px solid var(--il-line-soft)', boxShadow: '0 10px 18px rgba(0,0,0,.28)', position: 'relative', zIndex: 1, flex: 'none' }}>
        <WorkflowRow step={step} />
        <div style={{ height: 1, background: 'var(--il-line-soft)', margin: '0 10px' }} />
        <div style={{ padding: '6px 10px 10px' }}>
          <Tabs<StepTab> items={TABS} value={tab} onChange={setTab} />
        </div>
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8, touchAction: 'pan-y' }}>
        {tab === 'prompt' && (image ? <PromptTab large={phone} /> : <ComingSoon step={step} />)}
        {tab === 'model' && (image ? <ModelTab /> : <ComingSoon step={step} />)}
        {tab === 'settings' && (image ? <SettingsTab /> : <ComingSoon step={step} />)}
        {tab === 'input' && <InputTab step={step} phone={phone} />}
      </div>
      {!phone && <GenerateBar step={step} />}
    </section>
  );
}
