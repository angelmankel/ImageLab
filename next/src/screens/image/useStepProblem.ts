/**
 * Fix list 17 + 24: why a step cannot run, in one short line, or null when it is ready. The rail
 * draws a red ring + this line as the circle's tooltip; "Generate all" refuses while any step has
 * one. The rule itself is pure (`stepProblem` in `~/app/stepsLogic`); this file gathers what it
 * needs from the stores: the step's resolved input (one rule, `useStepInput`) and the first
 * required field the kind is missing.
 *
 * `chainRun` = judged for a Generate all: a step waiting on the step above is fine there (that
 * step runs first), and so is a step that would make its own picture.
 */
import { useStore } from '@/lib/store';
import { useVideo } from '@/features/video/videoStore';
import { useSteps, stepProblem, type Step, type StepReadiness } from '~/app/stepsStore';
import { stepWorkflowNow, useStepWorkflow } from '~/screens/comfy';
import { stepInputNow, useStepInput } from './useStepOutput';
import type { StepInputResolution } from './stepInputLogic';

interface Facts { checkpoint: string; videoPrompt: string; videoStart: string; videoTask: string; workflowPicked: boolean; upscaleModels: number }

/** The first required field a step is missing, by kind. */
function missingOf(step: Step, f: Facts): string | null {
  switch (step.kind) {
    case 'image': return f.checkpoint ? null : 'Pick a model';
    case 'refine': return f.checkpoint ? null : 'Pick a model in step 1 (Refine re-samples with it)';
    case 'upscale': return step.params?.upscale?.model || f.upscaleModels > 0 ? null : 'No upscale model on the server';
    case 'video': return f.videoPrompt.trim() ? null : 'Write a motion prompt';
    case 'workflow': return f.workflowPicked ? null : 'Pick a workflow';
    default: return null;
  }
}

function readiness(step: Step, res: StepInputResolution | null, f: Facts, chainRun: boolean): StepReadiness {
  const input = res?.kind ?? 'none';
  const steps = useSteps.getState().steps;
  return {
    input: chainRun && input === 'waiting' ? 'chained' : input,
    waitingOn: res && 'from' in res ? steps.indexOf(res.from) + 1 : undefined,
    ownPicture: step.kind === 'video' ? f.videoTask !== 'i2v' || !!f.videoStart : step.kind === 'workflow',
    missing: missingOf(step, f),
  };
}

const upscaleCount = (info: ReturnType<typeof useStore.getState>['serverInfo']) =>
  Object.values(info).reduce((n, i) => Math.max(n, i?.upscaleModels?.length ?? 0), 0);

export function useStepProblem(step: Step, chainRun = false): string | null {
  const res = useStepInput(step);
  const checkpoint = useStore((s) => s.workflow.checkpoints[0]?.name ?? '');
  const upscaleModels = useStore((s) => upscaleCount(s.serverInfo));
  const videoPrompt = useVideo((s) => s.positive);
  const videoStart = useVideo((s) => s.startImage);
  const videoTask = useVideo((s) => (s.engine === 'h3' ? s.h3.mode : s.mode));
  const workflowPicked = !!useStepWorkflow(step.kind === 'workflow' ? step.id : null);
  return stepProblem(step, readiness(step, res, { checkpoint, videoPrompt, videoStart, videoTask, workflowPicked, upscaleModels }, chainRun));
}

/** `useStepProblem` outside React, read now (Generate all). */
export function stepProblemNow(step: Step, chainRun = false): string | null {
  const st = useStore.getState();
  const v = useVideo.getState();
  const facts: Facts = {
    checkpoint: st.workflow.checkpoints[0]?.name ?? '',
    upscaleModels: upscaleCount(st.serverInfo),
    videoPrompt: v.positive, videoStart: v.startImage, videoTask: v.engine === 'h3' ? v.h3.mode : v.mode,
    workflowPicked: step.kind === 'workflow' && !!stepWorkflowNow(step.id),
  };
  return stepProblem(step, readiness(step, stepInputNow(step.id), facts, chainRun));
}
