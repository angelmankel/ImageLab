/**
 * ONE rule for what a step 2+ takes as its input (rule 2), pure and tested in
 * tests/stepInput.test.cjs. The Input tabs, the rail badge, the video chain runner and the
 * workflow step's run all resolve through `resolveStepInput`, so they always agree:
 *
 *   Off  — the step's own picture (`step.input`, or whatever its own store holds);
 *   Auto — the newest result made BY the previous step (`inStep` with the result tags, so a
 *          step's own output, not just the newest of its kind);
 *   Pick — the result chosen on the step (`step.chainPick`); gone (deleted) → Auto, flagged.
 *
 * Results come in as one flat list (`StepResult`: image history + video / workflow runs, with
 * the source kind each came from); `mergeResults` builds it from the main app's result lists.
 */
import { inStep, type ResultSource } from './historyLogic';
import { chainModeOf, prevStepId, type ChainMode, type ChainPick, type Step, type StepInput } from '~/app/stepsLogic';

export interface StepResult extends StepInput { key: string; kind: 'image' | 'video'; source: ResultSource; createdAt: number }

interface ResultLike { key: string; url: string; kind: 'image' | 'video'; filename: string; createdAt: number }

/** Every result as one list, newest first, each tagged with the kind of step that makes it. */
export function mergeResults(images: readonly ResultLike[], videos: readonly ResultLike[], runs: readonly ResultLike[]): StepResult[] {
  const out: StepResult[] = [];
  const add = (list: readonly ResultLike[], source: ResultSource) => { for (const r of list) out.push({ key: r.key, url: r.url, name: r.filename, kind: r.kind, source, createdAt: r.createdAt }); };
  add(images, 'image'); add(videos, 'video'); add(runs, 'workflow');
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** The results `step` made, newest first. */
export function resultsOfStep(step: Step, steps: readonly Step[], tags: Readonly<Record<string, string>>, results: readonly StepResult[]): StepResult[] {
  return results.filter((r) => inStep(r, step, steps, tags)).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * A step's newest output: the newest result it made; an Upscale step (no runner yet) passes its
 * explicit input through, as before.
 */
export function newestResultOf(step: Step | null, steps: readonly Step[], tags: Readonly<Record<string, string>>, results: readonly StepResult[]): StepInput | null {
  if (!step) return null;
  const own = resultsOfStep(step, steps, tags, results)[0];
  if (own) return { url: own.url, name: own.name };
  return step.kind === 'upscale' ? step.input ?? null : null;
}

export interface ChainCandidate {
  /** The previous step, or null for step 1. */
  from: Step | null;
  /** What this step chains to: the pick while it still exists, else the previous step's newest result. */
  src: StepInput | null;
  /** The step is in Pick mode but its chosen result is gone: `src` is the Auto fallback. */
  pickLost: boolean;
}

/** What the previous step offers this one, whatever the mode is on (the Input tab's "Step N's output" button uses it in Off mode too). */
export function chainCandidate(step: Step, steps: readonly Step[], tags: Readonly<Record<string, string>>, results: readonly StepResult[]): ChainCandidate {
  const from = steps.find((s) => s.id === prevStepId(steps, step.id)) ?? null;
  if (!from) return { from: null, src: null, pickLost: false };
  const pick = step.chainMode === 'pick' ? step.chainPick ?? null : null;
  if (pick) {
    const live = results.find((r) => r.key === pick.key);
    if (live) return { from, src: { url: live.url, name: live.name }, pickLost: false };
  }
  return { from, src: newestResultOf(from, steps, tags, results), pickLost: !!pick };
}

export type StepInputResolution =
  /** Step 1, or Off with nothing of its own on the step (its own store may still hold a picture). */
  | { kind: 'none'; mode: 'off' }
  /** Off: the explicit picture on the step (Send to step, an upload). */
  | { kind: 'explicit'; mode: 'off'; src: StepInput }
  /** Chained, but the previous step has made nothing yet. */
  | { kind: 'waiting'; mode: 'auto' | 'pick'; from: Step; pickLost: boolean }
  /** Chained: this is the picture. `pickLost` = Pick mode fell back to the last result. */
  | { kind: 'chained'; mode: 'auto' | 'pick'; src: StepInput; from: Step; pickLost: boolean };

export function resolveStepInput(step: Step, steps: readonly Step[], tags: Readonly<Record<string, string>>, results: readonly StepResult[]): StepInputResolution {
  const mode: ChainMode = chainModeOf(step);
  const isFirst = steps[0]?.id === step.id;
  if (mode === 'off' || isFirst) return step.input && !isFirst ? { kind: 'explicit', mode: 'off', src: step.input } : { kind: 'none', mode: 'off' };
  const c = chainCandidate(step, steps, tags, results);
  if (!c.from) return { kind: 'none', mode: 'off' };
  return c.src ? { kind: 'chained', mode, src: c.src, from: c.from, pickLost: c.pickLost } : { kind: 'waiting', mode, from: c.from, pickLost: c.pickLost };
}

/** A result as a `ChainPick` saved on the step. */
export const toChainPick = (r: StepResult): ChainPick => ({ key: r.key, url: r.url, name: r.name });
