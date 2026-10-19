/**
 * The bottom of the settings column: seed, Generate and the run's progress for the active mode.
 * Pinned, so starting a run never needs a scroll. Image keeps `GenerateButton` (it owns ⌘↵ and
 * the server routing); Video and Workflow run through their app-wide run stores, so a run started
 * here keeps going and reporting when the mode changes.
 */
import { Button, Text } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { RunBar } from '@/components/blocks/RunBar';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import type { ObjectInfo } from '@/lib/workflowGraph';
import type { WorkspaceMode } from '@/lib/workspace';
import { GenerateButton } from '@/features/generate/GenerateButton';
import { GenerationProgress } from '@/features/generate/GenerationProgress';
import { SeedRow } from '@/features/workspace/imageScope';
import { VideoSeedRow, useVideoEstimateLine } from '@/features/video/VideoView';
import { startVideoRun, useVideoRun } from '@/features/video/videoRun';
import { startWorkflowRun, useWorkflowRun } from '@/features/studio/studioRun';
import { useStudio } from '@/features/studio/studioStore';

export function ImageFooter() {
  return (
    <Footer>
      <GenerationProgress />
      <SeedRow />
      <GenerateButton />
    </Footer>
  );
}

export function VideoFooter({ host }: { host: string }) {
  const busy = useVideoRun(s => s.busy);
  const status = useVideoRun(s => s.status);
  const error = useVideoRun(s => s.error);
  const progress = useVideoRun(s => s.progress);
  const line = useVideoEstimateLine(host, busy);
  const run = () => { void startVideoRun(host); };
  // ⌘↵ queues from inside the prompt box too, as the image mode's button does.
  useShortcut('cmd+Enter', (e) => { e.preventDefault(); if (!busy) run(); }, { priority: ShortcutPriority.Global + 1, skipTyping: false });
  return (
    <Footer>
      <VideoSeedRow />
      <RunBar label="Generate video" busy={busy} progress={progress} statusLine={busy ? status ?? 'Working…' : line}
        onRun={run} onStop={() => { void useVideoRun.getState().cancel(); }} />
      {error && <Text size="xs" c="red.4">{error}</Text>}
    </Footer>
  );
}

export function WorkflowFooter({ host, info }: { host: string; info: ObjectInfo | null }) {
  const busy = useWorkflowRun(s => s.busy);
  const status = useWorkflowRun(s => s.status);
  const error = useWorkflowRun(s => s.error);
  const progress = useWorkflowRun(s => s.progress);
  const queue = useWorkflowRun(s => s.queueRemaining);
  const path = useStudio(s => s.path);
  const run = () => { void startWorkflowRun(host, info); };
  useShortcut('cmd+Enter', (e) => { e.preventDefault(); if (!busy && path) run(); }, { priority: ShortcutPriority.Global + 1, skipTyping: false });
  return (
    <Footer>
      <RunBar label="Generate" busy={busy} progress={progress} disabled={!path}
        statusLine={busy ? status ?? 'Working…' : path ? (queue ? `${queue} queued on the server` : undefined) : 'Open a workflow first'}
        onRun={run} onStop={() => { void useWorkflowRun.getState().cancel(); }} />
      {error && <Text size="xs" c="red.4">{error}</Text>}
    </Footer>
  );
}

/**
 * The top bar's Generate for video and workflow while the settings column is folded (image has
 * `GenerateWidget` there): a small button that becomes Stop while the run goes.
 */
export function CompactRun({ mode, videoHost, workflowHost, info }: {
  mode: WorkspaceMode; videoHost: string | null; workflowHost: string | null; info: ObjectInfo | null;
}) {
  const store = mode === 'video' ? useVideoRun : useWorkflowRun;
  const busy = store(s => s.busy);
  const path = useStudio(s => s.path);
  const host = mode === 'video' ? videoHost : workflowHost;
  const disabled = !host || (mode === 'workflow' && !path);
  const run = () => { if (mode === 'video' && videoHost) void startVideoRun(videoHost); else if (workflowHost) void startWorkflowRun(workflowHost, info); };
  return (
    <Button
      size="compact-sm" h={30} radius="sm"
      color={busy ? 'red' : undefined} variant={busy ? 'light' : 'filled'}
      leftSection={busy ? <IconPlayerStop size={14} /> : <IconPlayerPlay size={14} />}
      disabled={!busy && disabled}
      onClick={() => { if (busy) void store.getState().cancel(); else run(); }}
      aria-label={busy ? 'Stop' : mode === 'video' ? 'Generate video' : 'Generate'}
    >
      {busy ? 'Stop' : mode === 'video' ? 'Generate video' : 'Generate'}
    </Button>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <footer className="flex shrink-0 flex-col gap-2 border-t border-border-default p-2.5">{children}</footer>;
}
