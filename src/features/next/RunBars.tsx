/**
 * The run bar of each step: one big Generate that becomes Stop while the run goes, its progress
 * along the bottom, the seed row, and the error if there is one. The same bar sits at the top of
 * the step panel on desktop and pinned at the bottom on the phone (`large`). Ctrl/⌘+Enter runs
 * the step on screen, inside a text box too.
 */
import { Text } from '@mantine/core';
import { IconDice } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { RunBar } from '@/components/blocks/RunBar';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { jobActivity } from '@/lib/jobActivity';
import { useStore } from '@/lib/store';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { fireFromStore } from '@/features/generate/GenerateButton';
import { GenerationProgress } from '@/features/generate/GenerationProgress';
import { SeedRow } from '@/features/workspace/imageScope';
import { VideoSeedRow, useVideoEstimateLine } from '@/features/video/videoControls';
import { startVideoRun, useVideoRun } from '@/features/video/videoRun';
import { startWorkflowRun, useWorkflowRun } from '@/features/studio/studioRun';
import { useStudio } from '@/features/studio/studioStore';

export function ImageRunBar({ large = false, onRun }: { large?: boolean; onRun?: () => void }) {
  const jobs = useStore(s => s.jobs);
  const submitting = useStore(s => s.isSubmitting);
  const online = useStore(s => Object.keys(s.serverInfo).length > 0);
  const cancelJob = useStore(s => s.cancelJob);
  const activity = jobActivity(jobs, submitting, online);
  const running = jobs.find(j => j.status === 'running') ?? jobs.find(j => j.status === 'queued');

  const run = async (newSeed = false) => {
    const before = useStore.getState().jobs.length;
    await fireFromStore(newSeed);
    const st = useStore.getState();
    if (st.jobs.length > before) onRun?.();
    else if (large && st.status.kind === 'error') notifications.show({ title: 'Could not generate', message: st.status.text, color: 'red', autoClose: 8000 });
  };
  useShortcut('cmd+Enter', (e) => { e.preventDefault(); void run(); }, { priority: ShortcutPriority.Global, skipTyping: false });

  return (
    <div className="flex flex-col gap-2">
      <RunBar
        size={large ? 'lg' : 'md'}
        busy={!!running || submitting}
        busyLabel={running?.status === 'queued' ? 'Queued' : 'Generating'}
        progress={activity.percent != null ? activity.percent / 100 : null}
        onRun={() => void run()}
        onStop={running ? () => cancelJob(running.id) : undefined}
        secondary={{ icon: <IconDice size={large ? 22 : 18} />, label: 'New seed and generate', onClick: () => void run(true) }}
      />
      <SeedRow />
      {!large && <GenerationProgress />}
    </div>
  );
}

export function VideoRunBar({ host, large = false, onRun }: { host: string; large?: boolean; onRun?: () => void }) {
  const busy = useVideoRun(s => s.busy);
  const status = useVideoRun(s => s.status);
  const error = useVideoRun(s => s.error);
  const progress = useVideoRun(s => s.progress);
  const line = useVideoEstimateLine(host, busy);
  const run = () => { void startVideoRun(host); onRun?.(); };
  useShortcut('cmd+Enter', (e) => { e.preventDefault(); if (!busy) run(); }, { priority: ShortcutPriority.Global + 1, skipTyping: false });
  return (
    <div className="flex flex-col gap-2">
      <RunBar size={large ? 'lg' : 'md'} label="Generate video" busy={busy} busyLabel={status ?? 'Rendering'} progress={progress} statusLine={busy ? status ?? 'Working…' : line}
        onRun={run} onStop={() => { void useVideoRun.getState().cancel(); }} />
      <VideoSeedRow />
      {error && <Text size="xs" c="red.4" lineClamp={2} onClick={() => useVideoRun.getState().clearError()}>{error}</Text>}
    </div>
  );
}

export function WorkflowRunBar({ host, info, large = false, onRun }: { host: string; info: ObjectInfo | null; large?: boolean; onRun?: () => void }) {
  const busy = useWorkflowRun(s => s.busy);
  const status = useWorkflowRun(s => s.status);
  const error = useWorkflowRun(s => s.error);
  const progress = useWorkflowRun(s => s.progress);
  const queue = useWorkflowRun(s => s.queueRemaining);
  const path = useStudio(s => s.path);
  const run = () => { void startWorkflowRun(host, info); onRun?.(); };
  useShortcut('cmd+Enter', (e) => { e.preventDefault(); if (!busy && path && info) run(); }, { priority: ShortcutPriority.Global + 1, skipTyping: false });
  return (
    <div className="flex flex-col gap-2">
      <RunBar size={large ? 'lg' : 'md'} label="Run workflow" busy={busy} busyLabel={status ?? 'Running'} progress={progress} disabled={!path || !info}
        disabledReason={!info ? 'Reading the server…' : 'Pick a workflow first'}
        statusLine={busy ? status ?? 'Working…' : !info ? 'Reading the server…' : path ? (queue ? `${queue} queued on the server` : undefined) : 'Open a workflow first'}
        onRun={run} onStop={() => { void useWorkflowRun.getState().cancel(); }} />
      {error && <Text size="xs" c="red.4" lineClamp={2} onClick={() => useWorkflowRun.getState().clearError()}>{error}</Text>}
    </div>
  );
}
