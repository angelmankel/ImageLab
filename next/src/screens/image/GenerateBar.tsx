/**
 * Rule 3 + 15: the Generate button group at the bottom of the step panel. Generate (seed as set) |
 * dice (a new random seed each press); while this step's own job runs it is Stop, with a thin
 * progress along its bottom. Several presses while one runs = queued (ComfyUI queues; so does the
 * store). Image step → the main app's `fireFromStore`; video → `startVideoRun`; workflow →
 * `startWorkflowRun`. Ctrl/⌘+Enter generates, inside a text box too.
 */
import { Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDice5, IconSparkles, IconPlayerStop } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { jobActivity } from '@/lib/jobActivity';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { fireFromStore } from '@/features/generate/GenerateButton';
import { startVideoRun, useVideoRun } from '@/features/video/videoRun';
import { startWorkflowRun, useWorkflowRun } from '@/features/studio/studioRun';
import { useObjectInfo } from '@/features/studio/useStudioRun';
import { useModeHost } from '@/features/workspace/modeHost';
import type { Step } from '~/app/stepsStore';
import { cancelQueueRow } from '~/app/queue';

/** What the step's Generate does and whether it is running. Pure of look; the phone dock uses it too. */
export function useStepRun(step: Step): { run: (newSeed?: boolean) => void; stop: () => void; busy: boolean; busyLabel: string; progress: number | null; disabled: string | null } {
  const jobs = useStore((s) => s.jobs);
  const submitting = useStore((s) => s.isSubmitting);
  const online = useStore((s) => Object.keys(s.serverInfo).length > 0);
  const video = useVideoRun((s) => ({ busy: s.busy, progress: s.progress, status: s.status }));
  const workflow = useWorkflowRun((s) => ({ busy: s.busy, progress: s.progress, status: s.status }));
  const videoHost = useModeHost('video');
  const workflowHost = useModeHost('workflow');
  const { info } = useObjectInfo(step.kind === 'workflow' ? workflowHost : null);

  if (step.kind === 'image') {
    const activity = jobActivity(jobs, submitting, online);
    const running = jobs.find((j) => j.status === 'running') ?? jobs.find((j) => j.status === 'queued');
    return {
      run: (newSeed = false) => { void fireFromStore(newSeed).then(() => { const st = useStore.getState(); if (st.status.kind === 'error') notifications.show({ title: 'Could not generate', message: st.status.text, color: 'red', autoClose: 8000 }); }); },
      stop: () => { if (running) cancelQueueRow(running.id); },
      busy: !!running || submitting,
      busyLabel: submitting ? 'Queueing…' : running?.status === 'queued' ? 'Queued' : 'Generating',
      progress: activity.percent != null ? activity.percent / 100 : null,
      disabled: online ? null : 'No server online',
    };
  }
  if (step.kind === 'video') {
    return {
      run: () => { if (videoHost) void startVideoRun(videoHost); },
      stop: () => cancelQueueRow('video-run'),
      busy: video.busy, busyLabel: video.status ?? 'Rendering', progress: video.progress,
      disabled: videoHost ? null : 'No video server',
    };
  }
  if (step.kind === 'workflow') {
    return {
      run: () => { if (workflowHost) void startWorkflowRun(workflowHost, info); },
      stop: () => cancelQueueRow('workflow-run'),
      busy: workflow.busy, busyLabel: workflow.status ?? 'Running', progress: workflow.progress,
      disabled: !workflowHost ? 'No server' : !info ? 'Reading the server…' : null,
    };
  }
  return { run: () => notifications.show({ title: 'Coming soon', message: "This step's workflow is coming.", color: 'gray', autoClose: 2500 }), stop: () => {}, busy: false, busyLabel: '', progress: null, disabled: null };
}

export function GenerateBar({ step, large = false }: { step: Step; large?: boolean }) {
  const { run, stop, busy, busyLabel, progress, disabled } = useStepRun(step);
  useShortcut('cmd+Enter', (e) => { e.preventDefault(); if (!disabled) run(); }, { priority: ShortcutPriority.Global, skipTyping: false });
  const h = large ? 58 : 54;
  const pct = progress != null ? Math.max(2, Math.round(progress * 100)) : null;
  const mainStyle: React.CSSProperties = { flex: 1, height: h, border: 0, background: busy ? 'var(--il-card-on)' : 'var(--il-ember)', color: busy ? 'var(--il-ember-hi)' : 'var(--il-bg)', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: disabled ? 'default' : 'pointer', opacity: disabled && !busy ? 0.55 : 1 };
  return (
    <div style={{ padding: large ? '10px 12px 12px' : '12px 20px 18px', borderTop: '1px solid var(--il-line)', flex: 'none' }}>
      <div style={{ position: 'relative', display: 'flex', height: h, borderRadius: 999, overflow: 'hidden', background: busy ? 'var(--il-card-on)' : 'var(--il-ember)' }}>
        {busy ? (
          <button type="button" onClick={stop} style={mainStyle} aria-label="Stop">
            <IconPlayerStop size={18} stroke={2.4} />Stop<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)' }}>· {busyLabel}{pct != null ? ` ${pct}%` : ''}</span>
          </button>
        ) : (
          <Tooltip label={disabled ?? 'Generate (⌘/Ctrl + Enter)'}>
            <button type="button" onClick={() => { if (!disabled) run(false); }} style={mainStyle} aria-label="Generate">
              <IconSparkles size={18} stroke={2.4} />Generate
            </button>
          </Tooltip>
        )}
        <span aria-hidden style={{ width: 1, background: 'rgba(20,20,22,.25)', margin: '10px 0' }} />
        <Tooltip label={busy ? 'Queue another with a new seed' : 'Generate with a new random seed'}>
          <button type="button" onClick={() => { if (!disabled) run(true); }} aria-label="Generate with a random seed"
            style={{ width: 64, height: h, border: 0, background: busy ? 'var(--il-card-on)' : 'var(--il-ember)', color: busy ? 'var(--il-ember-hi)' : 'var(--il-bg)', display: 'grid', placeItems: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
            <IconDice5 size={22} stroke={2.2} />
          </button>
        </Tooltip>
        {busy && (
          <div aria-hidden style={{ position: 'absolute', left: 12, right: 12, bottom: 5, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            {pct != null
              ? <div style={{ height: '100%', width: `${pct}%`, background: 'var(--il-ember)', transition: 'width .2s' }} />
              : <div className="il-sweep" style={{ height: '100%', width: '33%', background: 'linear-gradient(90deg, transparent, var(--il-ember), transparent)' }} />}
          </div>
        )}
      </div>
    </div>
  );
}
