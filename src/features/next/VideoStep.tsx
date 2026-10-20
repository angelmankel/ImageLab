/**
 * The Video step's panel: the run bar on top (desktop; the phone pins it under the scroll), the
 * prompt hub with the motion prompt, every setting as a chip, then the recipe presets, the sweep
 * ("vary one setting across N runs") and the reset — the same rows the classic column has.
 */
import { useState } from 'react';
import { Collapse, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconFlask } from '@tabler/icons-react';
import { MissingFiles } from '@/features/video/sections';
import { VideoPresetRow, VideoResetRow, VideoSweepRow } from '@/features/video/videoControls';
import { useVideoSweep } from '@/features/video/videoSweep';
import { VideoRunBar } from './RunBars';
import { PromptHub } from './PromptHub';
import { VideoChips } from './VideoChips';

/** The scrolling part, shared by both shells. */
export function VideoStepBody({ host, large = false }: { host: string; large?: boolean }) {
  const sweeping = useVideoSweep(s => !!s.current);
  const [sweepOpen, setSweepOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="empty:hidden"><MissingFiles /></div>
      <PromptHub kind="video" large={large} />
      <VideoChips host={host} large={large} />
      <div className="rounded-lg border border-border-default bg-bg-panel px-3 py-2"><VideoPresetRow large={large} /></div>
      <div className="rounded-lg border border-border-default bg-bg-panel px-3 py-2">
        <UnstyledButton onClick={() => setSweepOpen(o => !o)} aria-expanded={sweepOpen || sweeping} className="flex min-h-9 w-full items-center gap-1.5">
          {sweepOpen || sweeping ? <IconChevronDown size={14} className="opacity-60" /> : <IconChevronRight size={14} className="opacity-60" />}
          <IconFlask size={14} className="opacity-70" />
          <Text size="sm" fw={500}>Experiment</Text>
          <Text size="xs" c="dimmed" truncate className="min-w-0 flex-1">{sweeping ? 'sweep running' : 'vary one setting across N runs'}</Text>
        </UnstyledButton>
        <Collapse in={sweepOpen || sweeping}><div className="pt-2"><VideoSweepRow host={host} /></div></Collapse>
      </div>
      <div className="rounded-lg border border-border-default bg-bg-panel px-3 py-2"><VideoResetRow /></div>
    </div>
  );
}

export function VideoStep({ host }: { host: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Video step" data-pad-start>
      <div className="shrink-0 border-b border-border-default p-2.5"><VideoRunBar host={host} /></div>
      <div className="scroll-y min-h-0 flex-1 p-2.5" style={{ touchAction: 'pan-y' }}><VideoStepBody host={host} /></div>
    </div>
  );
}
