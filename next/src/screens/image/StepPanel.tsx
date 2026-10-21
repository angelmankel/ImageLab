/**
 * Rule 3: the step panel. A sticky dark block (edge to edge, #0F0F11) = the workflow row + the 4
 * tabs Prompt · Composition · Model · Parameters (fix list 25; icons only when narrow); one tab body at a time, scrolling; at the bottom the
 * Generate group (left out on the phone: the dock has Generate). Which tab bodies render is per
 * `step.kind` (`TABS_BY_KIND`): the Image step's own tabs, the Video step's (`./video`), the
 * Workflow step's through `./workflowBridge` (another owner's folder, loaded when it exists);
 * Refine / Upscale / Remove BG through `./kinds` (fix list 15, 22, 43).
 */
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { IconAlignLeft, IconCube, IconAdjustmentsHorizontal, IconPhoto } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useVideo } from '@/features/video/videoStore';
import { useSteps, type Step, type StepKind } from '~/app/stepsStore';
import { Tabs } from '~/ui';
import { Tip } from '~/ui/Tip';
import { useLayout, type StepTab } from './layoutStore';
import { WorkflowRow } from './WorkflowRow';
import { GenerateBar } from './GenerateBar';
import { PromptTab } from './PromptTab';
import { InputTab } from './InputTab';
import { ModelTab } from './model';
import { SettingsTab } from './settings';
import { VideoPromptTab, VideoModelTab, VideoSettingsTab, VideoInputTab } from './video';
import { WorkflowTab } from './workflowBridge';
import './stepMenuEntries';
import {
  RefinePromptTab, RefineModelTab, RefineSettingsTab, UpscalePromptTab, UpscaleModelTab, UpscaleSettingsTab,
  RemoveBgPromptTab, RemoveBgModelTab, RemoveBgSettingsTab,
} from './kinds/KindTabs';

/** Fix list 25: Prompt · Composition · Model · Parameters (keys stay 'input' / 'settings' so saved state and callers keep working). */
const TAB_DEFS: Array<{ key: StepTab; title: string; Icon: typeof IconAlignLeft }> = [
  { key: 'prompt', title: 'Prompt', Icon: IconAlignLeft },
  { key: 'input', title: 'Composition', Icon: IconPhoto },
  { key: 'model', title: 'Model', Icon: IconCube },
  { key: 'settings', title: 'Parameters', Icon: IconAdjustmentsHorizontal },
];

/** Below this width of the tab row the words go and each tab is its icon with a tooltip. */
const WORDS_MIN = 372;

/** The phone has no hover for tooltips: there the words stay and the icons go when it is narrow. */
function StepTabs({ tab, setTab, phone }: { tab: StepTab; setTab: (t: StepTab) => void; phone: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= WORDS_MIN));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const items = TAB_DEFS.map(({ key, title, Icon }) => ({
    key,
    label: wide ? <><Icon size={15} stroke={2.2} />{title}</> : phone ? title : <Tip label={title}><span style={{ display: 'grid', placeItems: 'center' }} aria-label={title}><Icon size={17} stroke={2.2} /></span></Tip>,
  }));
  return <div ref={ref}><Tabs<StepTab> items={items} value={tab} onChange={setTab} itemPad={wide || phone ? 9 : 12} hug={wide || phone} /></div>;
}

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
  refine: { prompt: RefinePromptTab, model: RefineModelTab, settings: RefineSettingsTab, input: InputTab },
  upscale: { prompt: UpscalePromptTab, model: UpscaleModelTab, settings: UpscaleSettingsTab, input: InputTab },
  'remove-bg': { prompt: RemoveBgPromptTab, model: RemoveBgModelTab, settings: RemoveBgSettingsTab, input: InputTab },
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
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', marginTop: 6 }}>{step.kind === 'upscale' ? 'Chain it to the previous step in Composition.' : 'Generate runs this step with its saved settings.'}</div>
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
          <StepTabs tab={tab} setTab={setTab} phone={phone} />
        </div>
      </div>
      {/* Phone: the page itself scrolls (CreatePage), so this is no scroll container there — a sticky
          section inside (the Prompt tab's pinned prompt, items 6 / 43) then sticks to the page. */}
      <div className={phone ? undefined : 'il-scroll'} style={{ flex: 1, minHeight: 0, padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8, touchAction: 'pan-y' }}>
        {Body ? <Body key={`${step.id}:${tab}`} step={step} phone={phone} /> : <ComingSoon step={step} />}
      </div>
      {!phone && <GenerateBar step={step} />}
    </section>
  );
}
