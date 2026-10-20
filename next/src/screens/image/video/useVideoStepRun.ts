/**
 * The Video step's Generate (rules 3 + 15): what it does, whether it is busy, why it is off.
 * `GenerateBar.useStepRun` returns this for a video step; the phone dock reads the same through
 * `useGenerate`. Stop cancels the video run row (`cancelQueueRow('video-run')`).
 */
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useShallow } from 'zustand/react/shallow';
import { useVideo } from '@/features/video/videoStore';
import { useVideoRun } from '@/features/video/videoRun';
import { useModeHost } from '@/features/workspace/modeHost';
import { useSteps, type Step } from '~/app/stepsStore';
import { cancelQueueRow } from '~/app/queue';
import { useStepInput } from '../useStepOutput';
import { blockReason } from './videoStepLogic';
import { runVideoStep } from './videoChain';

export interface StepRun { run: (newSeed?: boolean) => void; stop: () => void; busy: boolean; busyLabel: string; progress: number | null; disabled: string | null }

export function useVideoStepRun(step: Step): StepRun {
  const host = useModeHost('video');
  const run = useVideoRun(useShallow((s) => ({ busy: s.busy, progress: s.progress, status: s.status })));
  const steps = useSteps((s) => s.steps);
  // The step's input by the one rule (Off · Auto · Pick): chained = it follows the previous step, prevHasOutput = that resolves to a picture.
  const res = useStepInput(step);
  const chained = res.kind === 'chained' || res.kind === 'waiting';
  const task = useVideo((s) => (s.engine === 'h3' ? s.h3.mode : s.mode));
  const prompt = useVideo((s) => s.positive);
  const startImage = useVideo((s) => s.startImage);
  const refs = useVideo((s) => s.h3.refImages.filter(Boolean).length);
  const [preparing, setPreparing] = useState(false);

  const disabled = step.kind === 'video'
    ? blockReason({ host, task, chained, hasPrev: chained, prevIndex: 'from' in res ? steps.indexOf(res.from) : -1, prevHasOutput: res.kind === 'chained', prompt, startImage, refs })
    : null;

  return {
    run: (newSeed = false) => {
      // The desktop button is already off; the phone dock's orb is not, so say why here.
      if (!host || disabled) { notifications.show({ title: 'Cannot generate', message: disabled ?? 'No video server', color: 'yellow', autoClose: 3000 }); return; }
      if (run.busy || preparing) { notifications.show({ title: 'A video is rendering', message: 'The video runner takes one clip at a time — Stop it, or wait for it to finish.', color: 'gray', autoClose: 3000 }); return; }
      setPreparing(true);
      void runVideoStep(step, host, newSeed).finally(() => setPreparing(false));
    },
    stop: () => cancelQueueRow('video-run'),
    busy: run.busy || preparing,
    busyLabel: preparing && !run.busy ? 'Sending the picture…' : run.status ?? 'Rendering',
    progress: run.progress,
    disabled,
  };
}
