/**
 * Pure rules for the Workflow step (rule 2: a step = a saved ComfyUI workflow with its own
 * settings and outputs). No React, no stores: tested in tests/workflowStep.test.cjs.
 *
 * Works on the studio store's `WorkflowParam`s (`@/features/studio/params`, read from the saved
 * graph + `/object_info`). The seed trap (`lib/workflowGraph.ts`) lives there, not here: this file
 * never touches `widgets_values`; it only sorts the knobs into the four tabs and says how each one
 * is drawn.
 */
import type { WorkflowParam } from '@/features/studio/params';

/** Which tab a widget belongs to and how it is drawn. */
export type WidgetKind = 'prompt' | 'image' | 'loader' | 'seed' | 'number' | 'combo' | 'bool' | 'string';

/** The model kinds the big models modal can be pointed at (`~/screens/image/model/pickTypes`). */
export type LoaderPickKind = 'checkpoint' | 'lora' | 'embedding' | 'controlnet' | 'vae' | 'upscale';

const FILE_EXT = /\.(safetensors|ckpt|pt|pth|bin|gguf|sft|onnx|pkl|vae|yaml)$/i;
const LOADER_NAME = /(ckpt|checkpoint|unet|diffusion_model|lora|vae|clip|text_encoder|model_name|control_?net|upscale_model|ipadapter|style_model|gligen|photomaker|embedding)/i;

/** A COMBO named `image` on an image-loading node is a picture, not a dropdown (the studio rule). */
export const isImageParam = (p: Pick<WorkflowParam, 'type' | 'name' | 'nodeType'>): boolean =>
  p.type === 'COMBO' && p.name === 'image' && /LoadImage|ImageLoad/i.test(p.nodeType);

/**
 * A loader widget: a COMBO whose options are the server's file list (checkpoints, LoRAs, VAEs,
 * CLIPs, upscale models…). An empty list on a loader node still counts: nothing is installed.
 */
export function isLoaderParam(p: Pick<WorkflowParam, 'type' | 'name' | 'nodeType' | 'options'>): boolean {
  if (p.type !== 'COMBO' || isImageParam(p)) return false;
  const opts = (p.options ?? []).map(String);
  if (opts.some((o) => FILE_EXT.test(o))) return true;
  return !opts.length && LOADER_NAME.test(p.name) && /Loader/i.test(p.nodeType);
}

/** Where a widget goes: `targetId` is the box the prompt is written into (Prompt tab). */
export function classify(p: WorkflowParam, targetId: string | null): WidgetKind {
  if (targetId && p.id === targetId) return 'prompt';
  if (isImageParam(p)) return 'image';
  if (isLoaderParam(p)) return 'loader';
  if (p.seedLike && p.type === 'INT') return 'seed';
  if (p.type === 'INT' || p.type === 'FLOAT') return 'number';
  if (p.type === 'COMBO') return 'combo';
  if (p.type === 'BOOLEAN') return 'bool';
  return 'string';
}

/** Which models-modal kind a loader widget can be browsed with; null = the server's list only. */
export function loaderPickKind(p: Pick<WorkflowParam, 'name' | 'nodeType'>): LoaderPickKind | null {
  const n = p.name.toLowerCase();
  const t = p.nodeType.toLowerCase();
  if (/lora/.test(n)) return 'lora';
  if (/vae/.test(n)) return 'vae';
  if (/control_?net/.test(n) || /controlnet/.test(t)) return 'controlnet';
  if (/upscale/.test(t) && /model/.test(n)) return 'upscale';
  if (/ckpt|checkpoint|unet|diffusion_model/.test(n)) return 'checkpoint';
  if (/embedding/.test(n)) return 'embedding';
  return null;
}

/** "Checkpoint", "LoRA", "VAE", "CLIP"…: the row label of a loader widget. */
export function loaderLabel(p: Pick<WorkflowParam, 'name' | 'nodeType'>): string {
  const n = p.name.toLowerCase();
  if (/ckpt|checkpoint/.test(n)) return 'Checkpoint';
  if (/unet|diffusion_model/.test(n)) return 'Diffusion model';
  if (/lora/.test(n)) return 'LoRA';
  if (/vae/.test(n)) return 'VAE';
  if (/clip|text_encoder/.test(n)) return n.match(/\d+$/) ? `CLIP ${n.match(/\d+$/)![0]}` : 'CLIP';
  if (/control_?net/.test(n)) return 'ControlNet';
  if (/upscale/.test(p.nodeType.toLowerCase()) && /model/.test(n)) return 'Upscale model';
  if (/ipadapter/.test(n)) return 'IP-Adapter';
  if (/style_model/.test(n)) return 'Style model';
  return humanize(p.name);
}

/** `strength_model` → "strength model". */
export const humanize = (name: string): string => name.replace(/_/g, ' ');

/** A file as a person reads it: no folder, no extension. */
export function fileLabel(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  return s.replace(/^.*[\\/]/, '').replace(FILE_EXT, '');
}

/** Is the widget's value one the server offers? `none` = the server lists nothing for it. */
export function loaderStatus(p: Pick<WorkflowParam, 'options'>, value: unknown): 'ok' | 'missing' | 'none' {
  const opts = (p.options ?? []).map(String);
  if (!opts.length) return 'none';
  return opts.includes(String(value ?? '')) ? 'ok' : 'missing';
}

export interface ParamGroup { nodeId: number; label: string; items: WorkflowParam[] }

/** Consecutive widgets of one node form a group, in graph order; the node's title is the label. */
export function groupByNode(params: readonly WorkflowParam[]): ParamGroup[] {
  const groups: ParamGroup[] = [];
  for (const p of params) {
    const last = groups[groups.length - 1];
    if (last && last.nodeId === p.nodeId) last.items.push(p);
    else groups.push({ nodeId: p.nodeId, label: p.nodeLabel, items: [p] });
  }
  return groups;
}

/** The pinned widgets, in the order they were pinned (ids that no longer exist are skipped). */
export function pinnedFirst(params: readonly WorkflowParam[], pinned: readonly string[]): WorkflowParam[] {
  const byId = new Map(params.map((p) => [p.id, p]));
  return pinned.map((id) => byId.get(id)).filter((p): p is WorkflowParam => !!p);
}

/**
 * A usable range. `/object_info` bounds are often the type's limits (steps 0..10000, cfg 0..100):
 * well-known names are narrowed to what people use, never so far that the saved value falls out.
 * A slider needs a declared min AND max and a span that a thumb can address; else a number box.
 */
const SANE: Record<string, [number, number]> = {
  steps: [1, 100], cfg: [1, 20], denoise: [0, 1], guidance: [0, 20],
  width: [256, 2048], height: [256, 2048], batch_size: [1, 8],
  strength: [0, 2], strength_model: [0, 2], strength_clip: [0, 2], upscale_by: [1, 4],
  shift: [0, 20], max_shift: [0, 20], base_shift: [0, 20], crop_w: [0, 4096], crop_h: [0, 4096],
};
const MAX_SLIDER_STOPS = 1000;

export function numberRange(p: Pick<WorkflowParam, 'name' | 'type' | 'value' | 'min' | 'max' | 'step'>): { min: number; max: number; step: number; slider: boolean } {
  const isFloat = p.type === 'FLOAT';
  const declared = p.min != null && p.max != null;
  let min = p.min ?? 0;
  let max = p.max ?? (isFloat ? 10 : 100);
  const sane = SANE[p.name];
  if (sane) { min = Math.max(min, sane[0]); max = Math.min(max, sane[1]); }
  const current = Number(p.value);
  if (Number.isFinite(current)) { min = Math.min(min, current); max = Math.max(max, current); }
  const step = p.step && p.step > 0 ? p.step : isFloat ? 0.05 : 1;
  const slider = (declared || !!sane) && max > min && (max - min) / step <= MAX_SLIDER_STOPS;
  return { min, max, step, slider };
}

const PRESETS: Record<string, number[]> = {
  steps: [8, 20, 30, 40], cfg: [1, 3.5, 5, 7], denoise: [0.35, 0.5, 0.65, 0.8, 1], guidance: [2.5, 3.5, 5],
  strength: [0.5, 0.8, 1, 1.2], strength_model: [0.5, 0.8, 1, 1.2], strength_clip: [0.5, 0.8, 1, 1.2],
  width: [768, 1024, 1280, 1536], height: [768, 1024, 1280, 1536], batch_size: [1, 2, 4],
  upscale_by: [1.5, 2, 3, 4], shift: [1, 3, 5, 8], scale: [1.5, 2, 4],
};

/** Tap presets for a well-known number, kept inside its range; undefined when there are fewer than two. */
export function presetsFor(p: Pick<WorkflowParam, 'name'>, range: { min: number; max: number }): number[] | undefined {
  const list = (PRESETS[p.name] ?? []).filter((v) => v >= range.min && v <= range.max);
  return list.length >= 2 ? list : undefined;
}

/** A number as the row shows it: as many decimals as the step implies. */
export function formatNumber(value: unknown, p: Pick<WorkflowParam, 'type' | 'step'>): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  if (p.type === 'INT') return String(Math.round(n));
  const step = p.step ?? 0.05;
  const decimals = step < 0.01 ? 3 : 2;
  return n.toFixed(decimals).replace(/\.?0+$/, '') || '0';
}

/** Seed widgets to re-roll before a run: every one on the dice, else the ones not kept ("random each run"). */
export function seedIdsToReroll(params: readonly WorkflowParam[], kept: readonly string[], newSeed: boolean): string[] {
  return params.filter((p) => p.seedLike && p.type === 'INT' && (newSeed || !kept.includes(p.id))).map((p) => p.id);
}

export interface ChainSource { url: string; name: string }

/**
 * What goes into the workflow's first LoadImage on Generate, from the step's resolved input
 * (`~/screens/image/stepInputLogic.ts`'s `resolveStepInput`, the one rule every step follows):
 * the step's explicit picture ("Send to step", upload), else the previous step's last or picked
 * result when chained (waiting = chained but nothing made yet), else nothing (the widget keeps
 * what it holds). No LoadImage in the workflow = nothing, whatever the step says.
 */
export type ChainInput = { kind: 'none' } | { kind: 'waiting' } | { kind: 'explicit' | 'chained'; src: ChainSource };

export function chainInputFrom(resolved: { kind: 'none' | 'waiting' } | { kind: 'explicit' | 'chained'; src: ChainSource } | null, hasImageInput: boolean): ChainInput {
  if (!hasImageInput || !resolved) return { kind: 'none' };
  if (resolved.kind === 'explicit' || resolved.kind === 'chained') return { kind: resolved.kind, src: resolved.src };
  return { kind: resolved.kind };
}

/** A safe upload name: unique per upload, the original name kept readable. */
export const uploadName = (name: string, now: number): string => `${now}-${(name || 'image.png').replace(/[^\w.-]+/g, '-')}`;

export interface SavedWorkflowLike { path: string; name: string }
export interface WorkflowFolder<W extends SavedWorkflowLike> { folder: string; items: W[] }

/** The picker's list: root workflows first, then each folder, every list by name. */
export function groupWorkflows<W extends SavedWorkflowLike>(list: readonly W[]): WorkflowFolder<W>[] {
  const by = new Map<string, W[]>();
  for (const w of list) {
    const i = w.path.lastIndexOf('/');
    const folder = i < 0 ? '' : w.path.slice(0, i);
    (by.get(folder) ?? by.set(folder, []).get(folder)!).push(w);
  }
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  return [...by.entries()]
    .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : cmp(a, b)))
    .map(([folder, items]) => ({ folder, items: [...items].sort((a, b) => cmp(a.name, b.name)) }));
}

/** "Wan 2.2 I2V A14B" from "Wan 2.2 I2V A14B.json" or "TagForce/….json". */
export const workflowName = (path: string): string => path.replace(/^.*\//, '').replace(/\.json$/i, '');

interface NoteLike { type?: string; title?: string; widgets_values?: unknown }

/**
 * The workflow's own explanation: the text of its Note / MarkdownNote titled "About…", else of its
 * first note (the ready-made presets carry one; any workflow with a note shows it). '' = none.
 */
export function workflowAbout(wf: { nodes?: readonly NoteLike[] } | null | undefined): string {
  const notes = (wf?.nodes ?? []).filter((n) => n.type === 'Note' || n.type === 'MarkdownNote');
  const pick = notes.find((n) => /^about/i.test(n.title ?? '')) ?? notes[0];
  const v = Array.isArray(pick?.widgets_values) ? pick!.widgets_values[0] : undefined;
  return typeof v === 'string' ? v.trim() : '';
}
