/**
 * Pure helpers for the chain of steps (rule 2). No React, no stores: tested in
 * tests/steps.test.cjs. The store (`stepsStore.ts`) and the Rail/StepPanel use these.
 *
 * THE STEP I/O STANDARD (fix list 24): every step kind declares what it NEEDS and what it GIVES
 * (`STEP_IO`). By default a step takes the output of the step above it (`chained: true`, Auto);
 * after an add / move / remove `relinkSteps` wires the chain up again so the user never re-sets
 * inputs. A step whose needs are not met shows the item-17 error state (`stepProblem`) instead
 * of failing quietly; "Generate all" refuses a broken chain.
 */
import type { LoopbackSettings } from '@/lib/types';
import type { StyleRef } from '@/lib/styleRefs';

export type StepKind = 'image' | 'refine' | 'upscale' | 'remove-bg' | 'video' | 'workflow';

/** What flows between steps: a still (an image with or without alpha) or a clip. */
export type IoType = 'image' | 'video';

export interface StepIo {
  /** What the step must be given: 'none' (makes its own), 'optional' (works with or without), or a type it cannot run without. */
  needs: IoType | 'none' | 'optional';
  /** What the step produces. */
  gives: IoType;
  /** The output keeps transparency (Remove BG). */
  alpha?: boolean;
}

export const STEP_IO: Record<StepKind, StepIo> = {
  image: { needs: 'none', gives: 'image' },
  refine: { needs: 'image', gives: 'image' },
  upscale: { needs: 'image', gives: 'image' },
  'remove-bg': { needs: 'image', gives: 'image', alpha: true },
  video: { needs: 'optional', gives: 'video' },
  workflow: { needs: 'optional', gives: 'image' },
};

export interface StepInput { url: string; name: string }

/** A specific result of the previous step, chosen as this step's input (`key` = the result's key: history id or run url). */
export interface ChainPick extends StepInput { key: string }

/** Where a step 2+ takes its input from: Off = its own picture, Auto = the previous step's last result, Pick = one chosen result. */
export type ChainMode = 'off' | 'auto' | 'pick';

/** The Upscale step's own settings (fix list 22). */
export interface UpscaleParams {
  /** File in models/upscale_models; '' = none picked yet. */
  model: string;
  /** The size multiplier the step lands on (the model's native ×2 / ×4 is rescaled to it). */
  factor: number;
  /** "Refine after upscale": a light re-sample with the session's model and prompt. */
  refine: boolean;
  denoise: number;
  steps: number;
}

export interface RemoveBgParams {
  /** The background-removal model (core `LoadBackgroundRemovalModel` list, or a BiRefNet name); '' = the server's first. */
  model: string;
}

/** Per-kind settings kept on the step itself. */
export interface StepParams {
  refine?: LoopbackSettings;
  upscale?: UpscaleParams;
  removeBg?: RemoveBgParams;
  /** Style tab on a Refine step (and Upscale's "Refine after upscale"): its own references, applied in the refine pass. */
  styleRefs?: StyleRef[];
  /** "Use step 1's references" too (off by default; absent = off). */
  styleFromStep1?: boolean;
}

export const DEFAULT_UPSCALE: UpscaleParams = { model: '', factor: 2, refine: false, denoise: 0.3, steps: 12 };
export const DEFAULT_REMOVE_BG: RemoveBgParams = { model: '' };
/** The Refine step starts as the classic Loopback did, on: 2 rounds, ×1.5, denoise 0.5. */
export const DEFAULT_REFINE: LoopbackSettings = {
  enabled: true, iterations: 2, upscale: 1.5, denoise: 0.5, steps: 12, cfg: 7,
  autoDenoise: false, denoiseStart: 0.6, denoiseEnd: 0.3,
};

export interface Step {
  id: string;
  kind: StepKind;
  /** The step's own name ("Portrait · SDXL", "Refine"); the session's name lives on the store. */
  name: string;
  /** True once a parameter differs from the saved workflow ("edited"). */
  edited: boolean;
  /** Takes the previous step's output as its input (chained). */
  chained: boolean;
  /** An explicit input picked for this step (Send to step, drop); wins over `chained` when set. */
  input?: StepInput | null;
  /** How a chained step follows the previous step: its last result (`auto`, the default and what old saves mean) or `chainPick`. */
  chainMode?: 'auto' | 'pick';
  /** The chosen result in `pick` mode; kept when the mode changes so Pick comes back to it. */
  chainPick?: ChainPick | null;
  /** The step's own settings (Refine rounds, Upscale model + factor, …). */
  params?: StepParams;
}

/** The step's input mode as the Composition tab shows it: an explicit input or `chained: false` = Off. */
export const chainModeOf = (step: Pick<Step, 'chained' | 'input' | 'chainMode'>): ChainMode =>
  !step.chained || step.input ? 'off' : step.chainMode ?? 'auto';

/** The step with its input mode set. Auto and Pick drop the explicit input (it is what Off means); `pick` given sets the chosen result. */
export function withChainMode<S extends Pick<Step, 'chained' | 'input' | 'chainMode' | 'chainPick'>>(step: S, mode: ChainMode, pick?: ChainPick | null): S {
  if (mode === 'off') return { ...step, chained: false };
  return { ...step, chained: true, chainMode: mode, input: null, chainPick: pick === undefined ? step.chainPick ?? null : pick };
}

export const STEP_LABEL: Record<StepKind, string> = { image: 'Image', refine: 'Refine', upscale: 'Upscale', 'remove-bg': 'Remove BG', video: 'Video', workflow: 'Workflow' };

/** One line per kind for the "+ Add" / step-kind popover. */
export const STEP_HINT: Record<StepKind, string> = {
  image: 'A new picture from the prompt',
  refine: 'Re-sample N times, growing each round',
  upscale: 'Bigger with an upscale model',
  'remove-bg': 'Cut the subject out (transparent PNG)',
  video: 'Animate the picture',
  workflow: 'Any saved ComfyUI workflow',
};

/** The kinds "+ Add" and the step-kind popover offer: everything but Image (the session's base picture is step 1). */
export const ADDABLE_KINDS: readonly StepKind[] = ['refine', 'upscale', 'remove-bg', 'video', 'workflow'];

/** Which result list a kind's output lands in: the image history, the video run store, or the workflow run store (Refine / Upscale / Remove BG run there). */
export const RESULT_SOURCE: Record<StepKind, 'image' | 'video' | 'workflow'> = {
  image: 'image', refine: 'workflow', upscale: 'workflow', 'remove-bg': 'workflow', video: 'video', workflow: 'workflow',
};

/** "1 · Image", "2 · Upscale": the rail's and the eyebrow's label. */
export const stepTitle = (steps: readonly Step[], id: string): string => {
  const i = steps.findIndex((s) => s.id === id);
  return i < 0 ? '' : `${i + 1} · ${STEP_LABEL[steps[i].kind]}`;
};

/** The step after `id`, or null at the end of the chain. */
export const nextStepId = (steps: readonly Step[], id: string): string | null => {
  const i = steps.findIndex((s) => s.id === id);
  return i >= 0 && i + 1 < steps.length ? steps[i + 1].id : null;
};

/** The step before `id`, or null for step 1. */
export const prevStepId = (steps: readonly Step[], id: string): string | null => {
  const i = steps.findIndex((s) => s.id === id);
  return i > 0 ? steps[i - 1].id : null;
};

/** A fresh step of a kind with its default settings (and an explicit input when one is given). */
export function newStep(id: string, kind: StepKind, name?: string, input?: StepInput | null): Omit<Step, 'chained'> {
  const step: Omit<Step, 'chained'> = { id, kind, name: name ?? STEP_LABEL[kind], edited: false };
  if (kind === 'refine') step.params = { refine: { ...DEFAULT_REFINE } };
  if (kind === 'upscale') step.params = { upscale: { ...DEFAULT_UPSCALE } };
  if (kind === 'remove-bg') step.params = { removeBg: { ...DEFAULT_REMOVE_BG } };
  if (input) step.input = input;
  return step;
}

/**
 * The I/O standard applied to the whole chain after a structural change (add / move / remove /
 * undo). `before` is the chain as it was. Auto steps need nothing: they resolve to whatever step
 * is above them now. What gets re-wired:
 *  - step 1 never chains (it makes the session's picture);
 *  - a step in Pick mode whose step above is now a different one goes back to Auto (its pick was
 *    one of the old neighbour's results).
 * Everything else is the user's choice and stays (an explicit picture, Off). A step that needs an
 * image and ends up with none shows the error state (`stepProblem`) instead of failing quietly.
 * An image-needing step after a Video step takes the clip's last frame (the runners do that).
 */
export function relinkSteps(steps: readonly Step[], before?: readonly Step[]): Step[] {
  return steps.map((s, i) => {
    if (i === 0) return s.chained ? { ...s, chained: false } : s;
    if (s.input || !s.chained || s.chainMode !== 'pick' || !before) return s;
    const was = before.findIndex((b) => b.id === s.id);
    if (was < 0) return s;
    return prevStepId(before, s.id) !== prevStepId(steps, s.id) ? { ...s, chainMode: 'auto' } : s;
  });
}

/** Clearing a step's explicit picture: a step that needs an image goes back to following the step above (Auto). */
export function clearStepInput(step: Step): Step {
  const needs = STEP_IO[step.kind].needs;
  return { ...step, input: null, ...(needs === 'image' || needs === 'video' ? { chained: true, chainMode: step.chainMode ?? 'auto' } : {}) };
}

/** Append a step; a new step chains to the one before it by default. */
export const appendStep = (steps: readonly Step[], step: Omit<Step, 'chained'> & { chained?: boolean }): Step[] =>
  relinkSteps([...steps, { chained: steps.length > 0 && !step.input, ...step }], steps);

/** Insert a step right after `afterId` (unknown / null = at the end); it chains to the step above it unless it brings its own input. */
export function insertStepAfter(steps: readonly Step[], afterId: string | null, step: Omit<Step, 'chained'> & { chained?: boolean }): Step[] {
  const i = afterId ? steps.findIndex((s) => s.id === afterId) : -1;
  if (i < 0) return appendStep(steps, step);
  const next = [...steps];
  next.splice(i + 1, 0, { chained: !step.input, ...step });
  return relinkSteps(next, steps);
}

/** Move a step to `toIndex` (step 1 stays first; a move onto index 0 lands on 1). Re-links the chain. */
export function moveStep(steps: readonly Step[], id: string, toIndex: number): Step[] {
  const from = steps.findIndex((s) => s.id === id);
  if (from <= 0) return [...steps];
  const to = Math.max(1, Math.min(steps.length - 1, Math.trunc(toIndex)));
  if (to === from) return [...steps];
  const next = [...steps];
  const [s] = next.splice(from, 1);
  next.splice(to, 0, s);
  return relinkSteps(next, steps);
}

/** Remove a step; step 1 can never go. Returns the list and the id to make active if the removed one was. */
export const removeStepFrom = (steps: readonly Step[], id: string, activeId: string): { steps: Step[]; activeId: string } => {
  if (steps.length <= 1 || id === steps[0].id) return { steps: [...steps], activeId };
  const i = steps.findIndex((s) => s.id === id);
  const next = relinkSteps(steps.filter((s) => s.id !== id), steps);
  // The removed step's neighbour below takes its place as the active one (the step that now sits where it was).
  return { steps: next, activeId: activeId === id ? next[Math.min(i, next.length - 1)].id : activeId };
};

/** A copy of a step (new id, "<name> copy") right after it; step 1 (the session's picture) is not copied. */
export function duplicateStepIn(steps: readonly Step[], id: string, newId: string): Step[] {
  const i = steps.findIndex((s) => s.id === id);
  if (i <= 0) return [...steps];
  const src = steps[i];
  const copy: Step = { ...src, id: newId, name: `${src.name} copy`, ...(src.params ? { params: structuredCloneSafe(src.params) } : {}) };
  const next = [...steps];
  next.splice(i + 1, 0, copy);
  return relinkSteps(next, steps);
}

const structuredCloneSafe = <V>(v: V): V => JSON.parse(JSON.stringify(v)) as V;

/** Put a removed step back where it was (Undo). */
export function restoreStepAt(steps: readonly Step[], step: Step, index: number): Step[] {
  if (steps.some((s) => s.id === step.id)) return [...steps];
  const next = [...steps];
  next.splice(Math.max(1, Math.min(next.length, index)), 0, step);
  return relinkSteps(next, steps);
}

// ── error states (fix list 17 + 24) ─────────────────────────────────────────────────────────

/** What the rail and "Generate all" know about a step's readiness, gathered by `useStepProblem`. */
export interface StepReadiness {
  /** The step's input, by the one rule: 'none' (Off, nothing of its own), 'explicit', 'waiting' (previous step has no output yet), 'chained'. */
  input: 'none' | 'explicit' | 'waiting' | 'chained';
  /** The previous step's number (1-based) when waiting on it. */
  waitingOn?: number;
  /** The step's own picture outside the chain (the Image step's img2img image, the Video step's start frame). */
  ownPicture?: boolean;
  /** Per-kind required fields, already checked by the caller: the first missing one, or null. */
  missing?: string | null;
}

/**
 * Why a step cannot run, in one short line, or null when it is ready. Used on the rail circle
 * (red ring + the line as its tooltip) and by "Generate all" (refuses while any step says so).
 */
export function stepProblem(step: Pick<Step, 'kind'>, r: StepReadiness): string | null {
  if (r.missing) return r.missing;
  const io = STEP_IO[step.kind];
  if (io.needs === 'image' || io.needs === 'video') {
    if (r.input === 'waiting') return `Needs an image: step ${r.waitingOn ?? '?'} has no output yet`;
    if (r.input === 'none' && !r.ownPicture) return 'Needs an image: chain it or pick one in Composition';
  }
  return null;
}

/** The Generate-all refusal: every broken step on one line each, or null when the chain is whole. */
export function brokenChainMessage(problems: ReadonlyArray<{ index: number; kind: StepKind; problem: string | null }>): string | null {
  const broken = problems.filter((p) => p.problem);
  if (!broken.length) return null;
  return broken.map((p) => `Step ${p.index + 1} · ${STEP_LABEL[p.kind]}: ${p.problem}`).join('\n');
}

/** Clamp the Upscale step's factor (1–4, in 0.25 steps). */
export const clampFactor = (f: number): number => Math.min(4, Math.max(1, Math.round((Number.isFinite(f) ? f : 2) * 4) / 4));

/** The native scale of an upscale model from its file name ("4x-UltraSharp.pth" → 4, "RealESRGAN_x2plus" → 2); 4 when it does not say. */
export function modelScale(name: string): number {
  const m = /(?:^|[^a-z0-9])(\d)x/i.exec(name) ?? /(?:^|[^a-z0-9])x(\d)(?!\d)/i.exec(name);
  const n = Number(m?.[1]);
  return n >= 1 && n <= 8 ? n : 4;
}
