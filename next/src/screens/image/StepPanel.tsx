/**
 * Rule 3: the step panel. A sticky dark block (edge to edge, #0F0F11) = the workflow row + the 4
 * tabs Prompt · Model · Settings · Input; one tab body at a time, scrolling; at the bottom the
 * Generate group (left out on the phone: the dock has Generate). Which tab bodies render is per
 * `step.kind` (`TABS_BY_KIND`): the Image step's own tabs, the Video step's (`./video`), the
 * Workflow step's through `./workflowBridge` (another owner's folder, loaded when it exists);
 * an Upscale step keeps the Image Input tab (its chain input) until its workflow comes.
 */
import { useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { IconAlignLeft, IconCube, IconAdjustmentsHorizontal, IconPhoto } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useVideo } from '@/features/video/videoStore';
import { useSteps, type Step, type StepKind } from '~/app/stepsStore';
import { Tabs } from '~/ui';
import { useLayout, type StepTab } from './layoutStore';
import { WorkflowRow } from './WorkflowRow';
import { GenerateBar } from './GenerateBar';
import { PromptTab } from './PromptTab';
import { InputTab } from './InputTab';
import { ModelTab } from './model';
import { SettingsTab } from './settings';
import { VideoPromptTab, VideoModelTab, VideoSettingsTab, VideoInputTab } from './video';
import { WorkflowTab } from './workflowBridge';

const TABS: Array<{ key: StepTab; label: ReactNode; title: string }> = [
  { key: 'prompt', label: <><IconAlignLeft size={15} stroke={2.2} />Prompt</>, title: 'Prompt' },
  { key: 'model', label: <><IconCube size={15} stroke={2.2} />Model</>, title: 'Model' },
  { key: 'settings', label: <><IconAdjustmentsHorizontal size={15} stroke={2.2} />Settings</>, title: 'Settings' },
  { key: 'input', label: <><IconPhoto size={15} stroke={2.2} />Input</>, title: 'Input' },
];

type TabProps = { step: Step; phone?: boolean };
type TabBodies = Partial<Record<StepTab, ComponentType<TabProps>>>;

/** Per step kind, the component of each tab; a missing tab shows `ComingSoon`. */
const TABS_BY_KIND: Record<StepKind, TabBodies> = {
  image: { prompt: ({ phone }) => <PromptTab large={phone} />, model: () => <ModelTab />, settings: () => <SettingsTab />, input: InputTab },
  video: { prompt: ({ step, phone }) => <VideoPromptTab step={step} large={phone} />, model: () => <VideoModelTab />, settings: () => <VideoSettingsTab />, input: VideoInputTab },
  workflow: {
    prompt: ({ step }) => <WorkflowTab tab="prompt" step={step} />, model: ({ step }) => <WorkflowTab tab="model" step={step} />,
    settings: ({ step }) => <WorkflowTab tab="settings" step={step} />, input: ({ step }) => <WorkflowTab tab="input" step={step} />,
  },
  upscale: { input: InputTab },
};

/** Marks the step "edited" once its parameters change after mount (the Image step's workflow + prompt, the Video step's store). */
function useEditedTracking(step: Step) {
  const workflow = useStore((s) => s.workflow);
  const layers = useStore((s) => s.layers);
  const video = useVideo((s) => (step.kind === 'video' ? s : null));
  const updateStep = useSteps((s) => s.updateStep);
  const seen = useRef<{ w: unknown; l: unknown; v: unknown } | null>(null);
  useEffect(() => {
    if (step.kind !== 'image' && step.kind !== 'video') return;
    if (!seen.current) { seen.current = { w: workflow, l: layers, v: video }; return; }
    const changed = step.kind === 'image' ? seen.current.w !== workflow || seen.current.l !== layers : seen.current.v !== video;
    if (changed) {
      seen.current = { w: workflow, l: layers, v: video };
      if (!step.edited) updateStep(step.id, { edited: true });
    }
  }, [workflow, layers, video, step.id, step.kind, step.edited, updateStep]);
}

function ComingSoon({ step }: { step: Step }) {
  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '28px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>This step's workflow is coming</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', marginTop: 6 }}>{step.kind === 'upscale' ? 'Chain it to the previous step in the Input tab.' : 'Generate runs this step with its saved settings.'}</div>
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
  const Body = TABS_BY_KIND[step.kind][tab];

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
        {Body ? <Body key={`${step.id}:${tab}`} step={step} phone={phone} /> : <ComingSoon step={step} />}
      </div>
      {!phone && <GenerateBar step={step} />}
    </section>
  );
}
