/**
 * A Workflow step's loader widgets as the universal model list sees them (rule 4: one model
 * component for ALL models). Pure: which kind a loader widget is, which sibling widgets are its
 * strengths (a LoRA loader's `strength_model` / `strength_clip`), the entries per kind, and how a
 * picked file maps onto the server's option list. No React, no stores: tested in
 * tests/modelKinds.test.cjs. The kind classification builds on `workflowStepLogic.loaderPickKind`.
 */
import type { WorkflowParam } from '@/features/studio/params';
import type { ModelEntry, ModelKind } from '../model/kindSpecs';
import { isLoaderParam, loaderPickKind } from './workflowStepLogic';

type Loader = Pick<WorkflowParam, 'id' | 'nodeId' | 'nodeLabel' | 'nodeType' | 'name' | 'type' | 'value' | 'options'>;

/** Every loader widget's kind: the modal kinds, else text encoders → clip, the rest → other. */
export function loaderKind(p: Pick<WorkflowParam, 'name' | 'nodeType'>): ModelKind {
  const k = loaderPickKind(p);
  if (k) return k;
  return /clip|text_encoder/i.test(p.name) ? 'clip' : 'other';
}

/** The kinds a workflow has slots for, in list order. */
export function workflowKinds(params: readonly Loader[]): ModelKind[] {
  const order: ModelKind[] = ['checkpoint', 'lora', 'embedding', 'controlnet', 'vae', 'clip', 'upscale', 'other'];
  const present = new Set(params.filter(isLoaderParam).map(loaderKind));
  return order.filter((k) => present.has(k));
}

/** A loader's strength widgets on the same node: `strength_model` / `strength` is the main one, `strength_clip` the CLIP one. */
export function strengthWidgets<P extends Pick<WorkflowParam, 'id' | 'nodeId' | 'name' | 'type'>>(params: readonly P[], loader: Pick<WorkflowParam, 'nodeId'>): { main?: P; clip?: P } {
  const same = params.filter((p) => p.nodeId === loader.nodeId && p.type === 'FLOAT');
  const main = same.find((p) => p.name === 'strength_model') ?? same.find((p) => p.name === 'strength');
  const clip = same.find((p) => p.name === 'strength_clip');
  return { main, clip };
}

/** The server's name for a picked file: exact, else the option whose base name matches, else null. */
export function matchOption(options: readonly string[], file: string): string | null {
  if (options.includes(file)) return file;
  const base = file.replace(/^.*[\\/]/, '').toLowerCase();
  return options.find((o) => o.replace(/^.*[\\/]/, '').toLowerCase() === base) ?? null;
}

const num = (v: unknown, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

/** One entry per loader widget of `kind`: the file it holds, badged with the node's title, its strength when the node has one. */
export function workflowEntries(params: readonly Loader[], values: Readonly<Record<string, unknown>>, kind: ModelKind): ModelEntry[] {
  const valueOf = (p: Loader) => (p.id in values ? values[p.id] : p.value);
  return params.filter((p) => isLoaderParam(p) && loaderKind(p) === kind).map((p) => {
    const { main } = strengthWidgets(params as readonly Pick<WorkflowParam, 'id' | 'nodeId' | 'name' | 'type'>[], p);
    return { id: p.id, name: String(valueOf(p) ?? ''), on: true, weight: main ? num(valueOf(main as Loader), 1) : 1, badge: p.nodeLabel, fixed: true, noWeight: !main };
  });
}

/** Every loader widget (of the given kind) whose value is `file` by base name — what a landed download renames. */
export function loadersHolding(params: readonly Loader[], values: Readonly<Record<string, unknown>>, kind: ModelKind, file: string): string[] {
  const base = file.replace(/^.*[\\/]/, '').toLowerCase();
  return params
    .filter((p) => isLoaderParam(p) && loaderKind(p) === kind)
    .filter((p) => String((p.id in values ? values[p.id] : p.value) ?? '').replace(/^.*[\\/]/, '').toLowerCase() === base)
    .map((p) => p.id);
}
