/**
 * Rule 3 + 15 + items 18 / 46: the Generate button group at the bottom of the step panel.
 * ×N (tap to cycle) | Generate (seed as set) | dice (a new random seed each press). It never turns
 * into Stop: every press queues one more job; a thin line along its bottom shows the running job. Image step → the main app's `fireFromStore`; video → `./video`'s `useVideoStepRun`
 * (chains the previous step's output, then `startVideoRun`); workflow → the step's `startWorkflowStepRun`.
 * Ctrl/⌘+Enter generates, inside a text box too.
 */
import { notifications } from '@mantine/notifications';
import { IconCheck, IconDice5, IconSparkles } from '@tabler/icons-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/lib/store';
import { jobActivity } from '@/lib/jobActivity';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { fireFromStore } from '@/features/generate/GenerateButton';
import { ownerNow, runAsOwner } from '~/app/outputs';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useObjectInfo } from '@/features/studio/useStudioRun';
import { useModeHost } from '@/features/workspace/modeHost';
import { useStepWorkflow } from '~/screens/comfy';
import type { Step } from '~/app/stepsStore';
import { cancelQueueRow, useQueue } from '~/app/queue';
import { enqueueRun } from '~/app/runQueue';
import { runTagged } from '~/app/runSteps';
import { nextInCycle, useCycleList } from '~/app/batchCycle';
import { Tip } from '~/ui';
import { useVideoStepRun } from './video';
import { startWorkflowStepRun } from './workflow';
import { IMAGE_STEP_ONLY } from './kinds/imageStepOnly';
import { OWN_KINDS, runKindStep } from './kinds/kindRun';
import { useStepProblem } from './useStepProblem';
import { skipIfUpToDate } from './upToDate';
import { useSkipFlash } from '~/app/stepFingerprint';

/** What the step's Generate does and whether it is running. Pure of look; the phone dock uses it too. */
export function useStepRun(step: Step): { run: (newSeed?: boolean) => void; stop: () => void; busy: boolean; busyLabel: string; progress: number | null; disabled: string | null } {
  const jobs = useStore((s) => s.jobs);
  const submitting = useStore((s) => s.isSubmitting);
  const online = useStore((s) => Object.keys(s.serverInfo).length > 0);
  // The Video step: chain the previous step's output, then the video run (`./video`).
  const video = useVideoStepRun(step);
  const workflow = useWorkflowRun(useShallow((s) => ({ busy: s.busy, progress: s.progress, status: s.status })));
  const workflowHost = useModeHost('workflow');
  // A workflow step runs the saved workflow the ComfyUI screen gave it ("Use as step"), on that host.
  const stepWf = useStepWorkflow(step.kind === 'workflow' ? step.id : null);
  const wfHost = stepWf?.host ?? workflowHost;
  const { info } = useObjectInfo(step.kind === 'workflow' ? wfHost : null);
  const problem = useStepProblem(step);

  if (step.kind === 'image') {
    const activity = jobActivity(jobs, submitting, online);
    const running = jobs.find((j) => j.status === 'running') ?? jobs.find((j) => j.status === 'queued');
    return {
      run: (newSeed = false) => { const owner = ownerNow('image'); void enqueueRun(() => (skipIfUpToDate(step, newSeed) ? undefined : runAsOwner(owner, () => fireFromStore(newSeed, IMAGE_STEP_ONLY)))).then(() => { const st = useStore.getState(); if (st.status.kind === 'error') notifications.show({ title: 'Could not generate', message: st.status.text, color: 'red', autoClose: 3000 }); }); },
      stop: () => { if (running) cancelQueueRow(running.id); },
      busy: !!running || submitting,
      busyLabel: submitting ? 'Queueing…' : running?.status === 'queued' ? 'Queued' : 'Generating',
      progress: activity.percent != null ? activity.percent / 100 : null,
      disabled: online ? null : 'No server online',
    };
  }
  if (OWN_KINDS.has(step.kind)) {
    // Refine / Upscale / Remove BG (`./kinds`): the step's input through its own graph on the workflow runner.
    return {
      run: (newSeed = false) => { void enqueueRun(() => (skipIfUpToDate(step, newSeed) ? undefined : runTagged(useWorkflowRun, step.id, () => runKindStep(step, newSeed)))); },
      stop: () => cancelQueueRow('workflow-run'),
      busy: workflow.busy, busyLabel: workflow.status ?? 'Running', progress: workflow.progress,
      disabled: problem,
    };
  }
  if (step.kind === 'video') return { ...video, run: (newSeed = false) => { if (!skipIfUpToDate(step, newSeed)) video.run(newSeed); } };
  if (step.kind === 'workflow') {
    // The step's own runner opens its workflow, uploads the chained picture, re-rolls the seeds
    // (dice = every seed; Generate = only the unlocked ones) and queues the run.
    return {
      run: (newSeed = false) => { if (wfHost) void enqueueRun(() => (skipIfUpToDate(step, newSeed) ? undefined : runTagged(useWorkflowRun, step.id, () => startWorkflowStepRun(step, wfHost, info, newSeed)))); },
      stop: () => cancelQueueRow('workflow-run'),
      busy: workflow.busy, busyLabel: workflow.status ?? 'Running', progress: workflow.progress,
      disabled: !wfHost ? 'No server' : !info ? 'Reading the server…' : !stepWf ? 'Pick a workflow in the step' : null,
    };
  }
  return { run: () => notifications.show({ title: 'Coming soon', message: "This step's workflow is coming.", color: 'gray', autoClose: 2500 }), stop: () => {}, busy: false, busyLabel: '', progress: null, disabled: null };
}

/**
 * Item 18 + fix list 2 #25: ×N is one tap-to-cycle button (the app's list from Settings → Generate,
 * default 1 / 2 / 3): how many images one press makes (the main workflow's `batch`).
 */
function BatchCycle({ h }: { h: number }) {
  const batch = useStore((s) => s.workflow.batch);
  const set = useStore((s) => s.setWorkflow);
  const list = useCycleList();
  return (
    <>
      <Tip label="Images per run">
        <button type="button" className="il-btn" aria-label={`Batch ×${batch}, tap to change`} onClick={() => set({ batch: nextInCycle(list, batch) })}
          style={{ minWidth: 54, height: h, border: 0, padding: '0 6px 0 14px', background: 'transparent', color: 'var(--il-bg)', fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', display: 'grid', placeItems: 'center', flex: 'none' }}>
          ×{batch}
        </button>
      </Tip>
      <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'color-mix(in srgb, var(--il-bg) 25%, transparent)', margin: '10px 0' }} />
    </>
  );
}

/**
 * Item 46: Generate never becomes Stop. Every press queues one more job with the parameters as they
 * are now (presses during a submit wait their turn, `enqueueRun`); stopping is the × on a job chip
 * (the stage's job row) or in the Job queue. The count is this step's jobs still to finish; the thin
 * line along the bottom is its running job's progress.
 */
export function GenerateBar({ step, large = false }: { step: Step; large?: boolean }) {
  const { run, busy, progress, disabled } = useStepRun(step);
  // Item 17: a press that would only repeat the current output was skipped — say so on the button for a moment.
  const upToDate = useSkipFlash((s) => s.stepId === step.id);
  const pending = useQueue().rows.filter((r) => r.stepId === step.id).length;
  useShortcut('cmd+Enter', (e) => { e.preventDefault(); if (!disabled) run(); }, { priority: ShortcutPriority.Global, skipTyping: false });
  const h = large ? 58 : 54;
  const pct = progress != null ? Math.max(2, Math.round(progress * 100)) : null;
  const off = !!disabled;
  const seg: React.CSSProperties = { height: h, border: 0, background: 'transparent', color: 'var(--il-bg)', cursor: off ? 'default' : 'pointer', opacity: off ? 0.55 : 1 };
  return (
    <div style={{ padding: large ? '10px 12px 12px' : '12px 20px 18px', borderTop: '1px solid var(--il-line)', flex: 'none' }}>
      <div className="il-btn-primary" style={{ position: 'relative', display: 'flex', height: h, borderRadius: 999, overflow: 'hidden', background: 'var(--il-ember)' }}>
        {step.kind === 'image' && <BatchCycle h={h} />}
        <Tip label={disabled ?? (pending ? `Queue one more (${pending} on the way) · ⌘/Ctrl + Enter` : 'Generate · ⌘/Ctrl + Enter')}>
          <button type="button" className="il-btn" onClick={() => { if (!off) run(false); }} aria-label="Generate"
            style={{ ...seg, flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {upToDate ? <><IconCheck size={18} stroke={2.6} />Up to date</> : <><IconSparkles size={18} stroke={2.4} />Generate</>}
            {pending > 0 && (
              <span aria-label={`${pending} on the way`} style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999, background: 'color-mix(in srgb, var(--il-bg) 82%, transparent)', color: 'var(--il-ember-hi)', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{pending}</span>
            )}
          </button>
        </Tip>
        <span aria-hidden style={{ width: 1, background: 'color-mix(in srgb, var(--il-bg) 25%, transparent)', margin: '10px 0' }} />
        <Tip label={pending ? 'Queue one more with a new random seed' : 'Generate with a new random seed'}>
          <button type="button" className="il-btn" onClick={() => { if (!off) run(true); }} aria-label="Generate with a random seed"
            style={{ ...seg, width: 64, display: 'grid', placeItems: 'center', flex: 'none' }}>
            <IconDice5 size={22} stroke={2.2} />
          </button>
        </Tip>
        {busy && (
          <div aria-hidden style={{ position: 'absolute', left: 18, right: 18, bottom: 5, height: 3, borderRadius: 2, background: 'color-mix(in srgb, var(--il-bg) 22%, transparent)', overflow: 'hidden', pointerEvents: 'none' }}>
            {pct != null
              ? <div style={{ height: '100%', width: `${pct}%`, background: 'color-mix(in srgb, var(--il-bg) 75%, transparent)', transition: 'width .2s' }} />
              : <div className="il-sweep" style={{ height: '100%', width: '33%', background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--il-bg) 75%, transparent), transparent)' }} />}
          </div>
        )}
      </div>
    </div>
  );
}
