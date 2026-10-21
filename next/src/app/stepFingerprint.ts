/**
 * Item 17: stale steps — OUR OWN fingerprint cache (works for any provider, not only ComfyUI's).
 *
 * Every output a step makes stores the fingerprint (+ readable snap) of the settings and input that
 * made it: the snap is taken when the job reaches the queue (after a seed re-roll was written
 * back), keyed by its prompt id, and filed under the output's key when the output is credited to
 * the step (`resultSteps.ts` tags). The rail compares it with the settings as they are now.
 *
 * Contract (others import from `~/app/stepFingerprint`):
 *   stepFingerprint(stepId)   the fingerprint of the step's settings + input now (null: no such step)
 *   isStale(stepId)           the step has an output but it is out of date (own change, or a step above it)
 *   stepFreshnessNow(stepId)  { state: 'none' | 'fresh' | 'stale', reason, changes[] }
 *   useChainFreshness()       the same for every step of the current session (the rail)
 *   isDuplicateRun(stepId, rerolls)  a Generate would only make the same picture again → skip it
 *   noteRunStart(store, stepId)      a video / workflow-runner run for this step is about to queue
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStore } from '@/lib/store';
import type { Layer, WorkflowState } from '@/lib/types';
import type { RunStore } from '@/lib/comfyRunner';
import { useVideo } from '@/features/video/videoStore';
import { useStudio } from '@/features/studio/studioStore';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useWorkflowStore, workflowKey, type StepWorkflowRef, type WorkflowMeta } from '~/screens/comfy/workflowStore';
import { useResultSteps } from '~/screens/image/resultSteps';
import { allResultsNow, useAllResults } from '~/screens/image/useStepOutput';
import { resolveStepInput, resultsOfStep, type StepResult } from '~/screens/image/stepInputLogic';
import { creditStep } from '~/screens/image/historyLogic';
import { IMAGE_STEP_ONLY } from '~/screens/image/kinds/imageStepOnly';
import { jobOwner } from './outputs';
import { useSteps, DEFAULT_REFINE, DEFAULT_UPSCALE, DEFAULT_REMOVE_BG, type Step } from './stepsStore';
import { chainFreshness, diffSnaps, fingerprintOf, flatten, withSeedsFrom, type Freshness, type Snap, type StepFact } from './fingerprintLogic';

export type { Freshness, Snap } from './fingerprintLogic';

const MAX_RESULTS = 3000;
const MAX_SNAPS = 50;
const MAX_RAWS = 30;

interface FpState {
  /** Output key (history id / run url) → the fingerprint it was made with. */
  byResult: Record<string, string>;
  /** Fingerprint → its snap (for "what changed"). Newest last, capped. */
  snaps: Record<string, Snap>;
  /** Fingerprint → the full settings that made it (Revert to last run). Newest last, capped. */
  raws: Record<string, StepRaw>;
  record: (pairs: Array<[string, Snap, StepRaw | null]>) => void;
}

export const useFingerprints = create<FpState>()(
  persist(
    (set) => ({
      byResult: {},
      snaps: {},
      raws: {},
      record: (pairs) => set((s) => {
        const byResult = { ...s.byResult };
        const snaps = { ...s.snaps };
        const raws = { ...s.raws };
        for (const [key, snap, raw] of pairs) {
          const fp = fingerprintOf(snap);
          byResult[key] = fp;
          delete snaps[fp];
          snaps[fp] = snap;
          if (raw) { delete raws[fp]; raws[fp] = raw; }
        }
        const wk = Object.keys(raws);
        if (wk.length > MAX_RAWS) for (const k of wk.slice(0, wk.length - MAX_RAWS)) delete raws[k];
        const rk = Object.keys(byResult);
        if (rk.length > MAX_RESULTS) for (const k of rk.slice(0, rk.length - MAX_RESULTS)) delete byResult[k];
        const sk = Object.keys(snaps);
        if (sk.length > MAX_SNAPS) for (const k of sk.slice(0, sk.length - MAX_SNAPS)) delete snaps[k];
        return { byResult, snaps, raws };
      }),
    }),
    { name: 'imagelab.next.fingerprints.v1' },
  ),
);

// ── the snap of a step's settings + input now ──────────────────────────────────────────────

interface Ctx {
  steps: readonly Step[];
  tags: Readonly<Record<string, string>>;
  results: readonly StepResult[];
  workflow: WorkflowState;
  layers: readonly Layer[];
  video: object;
  studioValues: Record<string, Record<string, unknown>>;
  byStep: Record<string, StepWorkflowRef>;
  meta: Record<string, WorkflowMeta>;
}

function ctxNow(): Ctx {
  const st = useStore.getState();
  const wf = useWorkflowStore.getState();
  return {
    steps: useSteps.getState().steps, tags: useResultSteps.getState().tags, results: allResultsNow(),
    workflow: st.workflow, layers: st.layers, video: useVideo.getState(), studioValues: useStudio.getState().values,
    byStep: wf.byStep, meta: wf.meta,
  };
}

const promptOf = (layers: readonly Layer[]) => {
  const part = (kind: Layer['kind']) => layers.filter((l) => l.on && l.kind === kind && l.text.trim())
    .map((l) => (l.weight === 1 ? l.text.trim() : `(${l.text.trim()}:${l.weight})`)).join(', ');
  return { positive: part('positive'), negative: part('negative') };
};

/** What the Refine step (and Upscale's "refine after") takes from step 1: model, LoRAs, prompt, seed, sampler. */
const SESSION_KEYS = ['checkpoints', 'loras', 'embeddings', 'vae', 'clipSkip', 'textEncoder', 'modelKeywords', 'modelProfile', 'modelProfileOverrides', 'profileTags', 'seed', 'sampler', 'scheduler'] as const;
const sessionPart = (c: Ctx) => {
  const out: Record<string, unknown> = { prompt: promptOf(c.layers) };
  for (const k of SESSION_KEYS) out[k] = c.workflow[k];
  return out;
};

function snapOf(step: Step, c: Ctx): Snap {
  let own: Record<string, unknown>;
  switch (step.kind) {
    case 'image': {
      // Not part of the picture: ×N (more of the same), per-type memory, the loader picked per server at queue time.
      const { typeSettings: _t, baseFile: _b, batch: _n, ...wf } = { ...c.workflow, ...IMAGE_STEP_ONLY };
      own = { ...wf, prompt: promptOf(c.layers) };
      break;
    }
    case 'refine': own = { refine: { ...DEFAULT_REFINE, ...step.params?.refine }, ...sessionPart(c) }; break;
    case 'upscale': {
      const up = { ...DEFAULT_UPSCALE, ...step.params?.upscale };
      own = { upscale: up, ...(up.refine ? sessionPart(c) : {}) };
      break;
    }
    case 'remove-bg': own = { removeBg: { ...DEFAULT_REMOVE_BG, ...step.params?.removeBg } }; break;
    case 'video': own = { ...(c.video as Record<string, unknown>) }; break;
    case 'workflow': {
      const ref = c.byStep[step.id];
      own = ref ? { workflow: ref.path, host: ref.host, modified: c.meta[workflowKey(ref.host, ref.path)]?.modified, values: c.studioValues[ref.path] } : {};
      break;
    }
    default: own = {};
  }
  const snap = flatten(own);
  if (c.steps[0]?.id !== step.id) {
    const res = resolveStepInput(step, c.steps, c.tags, c.results);
    if (res.kind === 'chained' || res.kind === 'explicit') snap.input = res.src.url;
  }
  return snap;
}

// ── the full settings (Revert to last run) ────────────────────────────────────────────────

/** Everything a step's output was made with, as the stores hold it (not flattened): what "Revert to last run" puts back. */
export interface StepRaw {
  kind: Step['kind'];
  /** Image step: the main workflow (minus what the Image step overrides at queue time) and the prompt layers. */
  workflow?: Partial<WorkflowState>;
  layers?: Layer[];
  /** Refine / Upscale / Remove BG: the step's own settings. */
  params?: Step['params'];
  /** Video step: the video store's settings. */
  video?: Record<string, unknown>;
  /** Workflow step: which workflow and its values. */
  wf?: { ref: StepWorkflowRef | null; values?: Record<string, unknown> };
  /** Step 2+: how it took its input, and the picture it resolved to. */
  input?: { chained: boolean; input?: Step['input']; chainMode?: Step['chainMode']; chainPick?: Step['chainPick']; url?: string };
}

/** Not saved for a revert: what the Image step overrides at queue time, ×N, the per-type memory, the loader picked per server. */
const NOT_RESTORED = new Set<string>([...Object.keys(IMAGE_STEP_ONLY), 'typeSettings', 'baseFile', 'batch']);
/** An input picture larger than this (a data URL) is not kept; a revert takes it from the output's history entry instead. */
const MAX_INLINE = 150_000;

const clone = <V>(v: V): V => (v === undefined ? v : JSON.parse(JSON.stringify(v)) as V);

function rawOf(step: Step, c: Ctx): StepRaw {
  const raw: StepRaw = { kind: step.kind };
  switch (step.kind) {
    case 'image': {
      const wf: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(c.workflow)) if (!NOT_RESTORED.has(k)) wf[k] = v;
      const img = c.workflow.inputImage as { dataUrl?: string } | null;
      if (img?.dataUrl && img.dataUrl.length > MAX_INLINE) wf.inputImage = { ...img, dataUrl: '' };
      raw.workflow = clone(wf) as Partial<WorkflowState>;
      raw.layers = clone(c.layers as Layer[]);
      break;
    }
    case 'refine': case 'upscale': case 'remove-bg': raw.params = clone(step.params ?? {}); break;
    case 'video': raw.video = clone(Object.fromEntries(Object.entries(c.video).filter(([, v]) => typeof v !== 'function'))); break;
    case 'workflow': {
      const ref = c.byStep[step.id] ?? null;
      raw.wf = { ref, values: ref ? clone(c.studioValues[ref.path]) : undefined };
      break;
    }
  }
  if (c.steps[0]?.id !== step.id) {
    const res = resolveStepInput(step, c.steps, c.tags, c.results);
    raw.input = { chained: step.chained, input: step.input ?? null, chainMode: step.chainMode, chainPick: step.chainPick ?? null, url: res.kind === 'chained' || res.kind === 'explicit' ? res.src.url : undefined };
  }
  return raw;
}

/** The step's full settings as they are now (Revert's undo). */
export function rawNow(stepId: string): StepRaw | null {
  const c = ctxNow();
  const step = c.steps.find((s) => s.id === stepId);
  return step ? rawOf(step, c) : null;
}

/** The full settings that made the step's newest output, the key of that output; null when none were kept. */
export function savedRawOf(stepId: string): { raw: StepRaw; outKey: string } | null {
  const c = ctxNow();
  const step = c.steps.find((s) => s.id === stepId);
  if (!step) return null;
  const out = resultsOfStep(step, c.steps, c.tags, c.results)[0];
  const st = useFingerprints.getState();
  const fp = out ? st.byResult[out.key] : undefined;
  const raw = fp ? st.raws[fp] : undefined;
  return raw && out ? { raw, outKey: out.key } : null;
}

// ── freshness of the chain ─────────────────────────────────────────────────────────────────

export interface StepFresh {
  state: Freshness;
  reason: 'own' | 'above' | null;
  /** What changed since the output was made, one short line each (empty unless stale). */
  changes: string[];
  /** The fingerprint of the settings + input now. */
  fp: string;
  /** The fingerprint the newest output was made with (undefined: made before fingerprints existed). */
  outFp?: string;
}

const NO_CHAIN: ReadonlyMap<string, StepFresh> = new Map();

function chainOf(c: Ctx, byResult: Record<string, string>, snaps: Record<string, Snap>): Map<string, StepFresh> {
  const facts: StepFact[] = [];
  const nowSnaps: Snap[] = [];
  for (const step of c.steps) {
    const snap = snapOf(step, c);
    nowSnaps.push(snap);
    const out = resultsOfStep(step, c.steps, c.tags, c.results)[0];
    const res = c.steps[0]?.id === step.id ? null : resolveStepInput(step, c.steps, c.tags, c.results);
    facts.push({
      id: step.id, hasOutput: !!out, outFp: out ? byResult[out.key] : undefined, nowFp: fingerprintOf(snap),
      followsAbove: !!res && (res.kind === 'chained' || res.kind === 'waiting') && res.mode === 'auto',
    });
  }
  const fresh = chainFreshness(facts);
  const map = new Map<string, StepFresh>();
  facts.forEach((f, i) => {
    const r = fresh[i];
    let changes: string[] = [];
    if (r.state === 'stale') {
      if (r.reason === 'above') changes = [`Step ${i} above is out of date`];
      else {
        const before = f.outFp ? snaps[f.outFp] : undefined;
        changes = before ? diffSnaps(before, nowSnaps[i], 8) : [];
        if (!changes.length) changes = ['Settings changed'];
      }
    }
    map.set(f.id, { state: r.state, reason: r.reason, changes, fp: f.nowFp, outFp: f.outFp });
  });
  return map;
}

/** Freshness of every step of the current session (the rail): memoised on the stores it reads. */
export function useChainFreshness(): ReadonlyMap<string, StepFresh> {
  const steps = useSteps((s) => s.steps);
  const tags = useResultSteps((s) => s.tags);
  const results = useAllResults();
  const workflow = useStore((s) => s.workflow);
  const layers = useStore((s) => s.layers);
  const video = useVideo((s) => s);
  const studioValues = useStudio((s) => s.values);
  const byStep = useWorkflowStore((s) => s.byStep);
  const meta = useWorkflowStore((s) => s.meta);
  const byResult = useFingerprints((s) => s.byResult);
  const snaps = useFingerprints((s) => s.snaps);
  return useMemo(() => (steps.length
    ? chainOf({ steps, tags, results, workflow, layers, video, studioValues, byStep, meta }, byResult, snaps)
    : NO_CHAIN), [steps, tags, results, workflow, layers, video, studioValues, byStep, meta, byResult, snaps]);
}

/** One step's freshness, read now (Generate all, the Generate button). */
export function stepFreshnessNow(stepId: string): StepFresh | null {
  const fp = useFingerprints.getState();
  return chainOf(ctxNow(), fp.byResult, fp.snaps).get(stepId) ?? null;
}

/** THE contract: the fingerprint of a step's settings + input as they are now; null when the step is not in the current session. */
export function stepFingerprint(stepId: string): string | null {
  const c = ctxNow();
  const step = c.steps.find((s) => s.id === stepId);
  return step ? fingerprintOf(snapOf(step, c)) : null;
}

/** THE contract: the step has an output, but it is out of date (its settings / input changed, or a step it follows is stale). */
export const isStale = (stepId: string): boolean => stepFreshnessNow(stepId)?.state === 'stale';

// ── recording: the snap at queue time, filed under each output ──────────────────────────────

interface Queued { stepId: string; snap: Snap; fp: string; raw: StepRaw }
/** Prompt id → the step + snap it was queued with (session memory, capped). */
const byPrompt = new Map<string, Queued>();
/** Prompt ids still queued / running. */
const live = new Set<string>();

function remember(promptId: string, stepId: string): void {
  const c = ctxNow();
  const step = c.steps.find((s) => s.id === stepId);
  if (!step) return;
  const snap = snapOf(step, c);
  byPrompt.set(promptId, { stepId, snap, fp: fingerprintOf(snap), raw: rawOf(step, c) });
  if (byPrompt.size > 400) for (const k of [...byPrompt.keys()].slice(0, byPrompt.size - 400)) byPrompt.delete(k);
}

/** The step a queued job was credited to (image jobs, and runs armed by `noteRunStart`), when known. */
export const stepOfPrompt = (promptId: string): string | undefined => byPrompt.get(promptId)?.stepId;

/** A run for `stepId` is about to queue on `store`: its job is credited to that step. */
const armed = new Map<RunStore, string>();
export function noteRunStart(store: RunStore, stepId: string): void { armed.set(store, stepId); }

// Image jobs (the main store): the step that asked (its owner, `~/app/outputs`, else the open step's rule).
let knownJobs = new Set(useStore.getState().jobs.map((j) => j.id));
useStore.subscribe((st, prev) => {
  if (st.jobs === prev.jobs) return;
  const ids = new Set(st.jobs.map((j) => j.id));
  const { steps, activeId } = useSteps.getState();
  for (const j of st.jobs) {
    if (knownJobs.has(j.id)) continue;
    // `outputs.ts` (imported first, so its listener ran first) has fixed the job's owner by now.
    const stepId = jobOwner(j.id)?.stepId || (j as { stepId?: string }).stepId || creditStep('image', activeId, steps);
    if (stepId) remember(j.id, stepId);
  }
  for (const id of knownJobs) if (!ids.has(id)) live.delete(id);
  for (const id of ids) live.add(id);
  knownJobs = ids;
});

// Video / workflow-runner jobs: credited to the step that armed the store.
for (const store of [useVideoRun, useWorkflowRun] as RunStore[]) {
  let known = new Set(store.getState().jobs.map((j) => j.promptId));
  store.subscribe((st, prev) => {
    if (st.jobs === prev.jobs) return;
    const ids = new Set(st.jobs.map((j) => j.promptId));
    for (const id of ids) {
      if (known.has(id)) continue;
      const stepId = armed.get(store);
      if (stepId) { remember(id, stepId); armed.delete(store); }
    }
    for (const id of known) if (!ids.has(id)) live.delete(id);
    for (const id of ids) if (byPrompt.has(id)) live.add(id);
    known = ids;
  });
}

/** The prompt id behind an output key: a history entry's, or a run result's (keyed by url). */
function promptIdOf(key: string): string | undefined {
  const e = useStore.getState().history.find((h) => h.id === key);
  if (e) return e.promptId;
  for (const store of [useWorkflowRun, useVideoRun] as RunStore[]) {
    const r = store.getState().results.find((x) => x.url === key);
    if (r) return r.promptId;
  }
  return undefined;
}

// A new output credited to a step: file the snap it was queued with under its key.
useResultSteps.subscribe((st, prev) => {
  if (st.tags === prev.tags) return;
  const have = useFingerprints.getState().byResult;
  const pairs: Array<[string, Snap, StepRaw | null]> = [];
  let ctx: Ctx | null = null;
  for (const [key, stepId] of Object.entries(st.tags)) {
    if (prev.tags[key] === stepId || have[key]) continue;
    const pid = promptIdOf(key);
    const q = pid ? byPrompt.get(pid) : undefined;
    if (q && q.stepId === stepId) { pairs.push([key, q.snap, q.raw]); continue; }
    // Not seen at queue time (a run started elsewhere): the settings now, which is what just ran unless edited since.
    ctx ??= ctxNow();
    const step = ctx.steps.find((s) => s.id === stepId);
    if (step) pairs.push([key, q ? withSeedsFrom(q.snap, snapOf(step, ctx)) : snapOf(step, ctx), q ? null : rawOf(step, ctx)]);
  }
  if (pairs.length) useFingerprints.getState().record(pairs);
});

// ── no duplicate outputs ───────────────────────────────────────────────────────────────────

/**
 * A Generate of this step would only make the picture it already has (or one already on its way):
 * the settings + input match its newest output's fingerprint, or a queued job's, and the run does
 * not re-roll a seed (`rerolls`). The caller skips it: no job, no second identical history entry.
 */
export function isDuplicateRun(stepId: string, rerolls: boolean): boolean {
  if (rerolls) return false;
  const f = stepFreshnessNow(stepId);
  if (!f) return false;
  if (f.state === 'fresh' && f.outFp === f.fp) return true;
  for (const id of live) {
    const q = byPrompt.get(id);
    if (q && q.stepId === stepId && q.fp === f.fp) return true;
  }
  return false;
}

/** Item 17's "already up to date" flash: the rail badge and the Generate button show it for a moment. */
export const useSkipFlash = create<{ stepId: string | null; at: number }>(() => ({ stepId: null, at: 0 }));
export function flashUpToDate(stepId: string): void {
  useSkipFlash.setState({ stepId, at: Date.now() });
  setTimeout(() => { if (useSkipFlash.getState().stepId === stepId) useSkipFlash.setState({ stepId: null }); }, 1600);
}
