/**
 * Bridge to the Workflow step's tabs (`~/screens/image/workflow`, another owner, may not exist
 * yet). Expected exports, each `({ step }: { step: Step }) => JSX.Element`:
 *   WorkflowPromptTab · WorkflowModelTab (may be missing → "no model slot" line) ·
 *   WorkflowSettingsTab · WorkflowInputTab
 * A glob that matches nothing is an empty object, so typecheck and build pass either way; when
 * the folder lands its tabs render in the step panel without touching this file.
 */
import { useEffect, useState, type ComponentType } from 'react';
import type { Step } from '~/app/stepsStore';
import type { StepTab } from './layoutStore';

type TabComponent = ComponentType<{ step: Step }>;
interface WorkflowTabs { WorkflowPromptTab?: TabComponent; WorkflowModelTab?: TabComponent; WorkflowSettingsTab?: TabComponent; WorkflowInputTab?: TabComponent }

const mods = import.meta.glob('./workflow/index.ts');
let loaded: WorkflowTabs | null = null;

export const hasWorkflowTabs = () => Object.keys(mods).length > 0;

async function loadWorkflowTabs(): Promise<WorkflowTabs | null> {
  if (loaded) return loaded;
  const load = Object.values(mods)[0];
  if (!load) return null;
  loaded = (await load()) as WorkflowTabs;
  return loaded;
}

const NAME: Record<StepTab, keyof WorkflowTabs> = { prompt: 'WorkflowPromptTab', model: 'WorkflowModelTab', settings: 'WorkflowSettingsTab', input: 'WorkflowInputTab' };

function Line({ children }: { children: string }) {
  return <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '28px 14px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>{children}</div>;
}

/** One tab of a Workflow step, from the workflow folder once it exists. */
export function WorkflowTab({ tab, step }: { tab: StepTab; step: Step }) {
  const [tabs, setTabs] = useState<WorkflowTabs | null>(loaded);
  useEffect(() => { let on = true; void loadWorkflowTabs().then((m) => { if (on) setTabs(m); }); return () => { on = false; }; }, []);
  if (!hasWorkflowTabs()) return <Line>{tab === 'input' ? 'This step takes the previous step\'s output into the workflow\'s first image input.' : 'Generate runs the saved ComfyUI workflow; its own tabs are coming.'}</Line>;
  if (!tabs) return <Line>Loading…</Line>;
  const C = tabs[NAME[tab]];
  if (!C) return <Line>{tab === 'model' ? 'This workflow has no model slot.' : 'Nothing to set here.'}</Line>;
  return <C step={step} />;
}
