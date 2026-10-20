/**
 * Item 39: the mapping layer that makes a saved ComfyUI workflow look like part of the app. Every
 * widget gets a ROLE when it is one of the common inputs (prompt, negative, seed, steps, CFG,
 * sampler, scheduler, denoise, size, batch, guidance, shift…) — found automatically from its name
 * and node — and then a friendly label, a group (Sampling · Size · a friendly node name), a hint
 * id and a control. Raw node names ("CLIP Text Encode (Prompt) #3") are never what the step shows.
 * A user mapping (edited in the ComfyUI screen: right-click a workflow → Labels & controls) can
 * override any of it per widget: label, group, control, hint text, hidden, role. Pure, tested in
 * node (`tests/paramMap.test.cjs`).
 */
import type { WorkflowParam } from '@/features/studio/params';

export type Role =
  | 'positive' | 'negative' | 'seed' | 'steps' | 'cfg' | 'sampler' | 'scheduler' | 'denoise'
  | 'width' | 'height' | 'batch' | 'guidance' | 'shift' | 'clipSkip';

export type Control = 'auto' | 'slider' | 'box' | 'chips' | 'select';

/** One widget's user mapping; every field optional (unset = automatic). */
export interface ParamMapping {
  label?: string;
  group?: string;
  control?: Control;
  hint?: string;
  hidden?: boolean;
  /** A text box's role ('none' = just a text box), or any widget's. */
  role?: Role | 'none';
}

export type WorkflowMap = Record<string, ParamMapping>;

export const GROUP_SAMPLING = 'Sampling';
export const GROUP_SIZE = 'Size';

/** Per role: the label, its group and the hint id (`~/ui/hints`). */
export const ROLE_INFO: Record<Role, { label: string; group: string; hint?: string }> = {
  positive: { label: 'Prompt', group: 'Prompt', hint: 'prompt' },
  negative: { label: 'Negative prompt', group: 'Prompt', hint: 'negative' },
  seed: { label: 'Seed', group: GROUP_SAMPLING, hint: 'seed' },
  steps: { label: 'Steps', group: GROUP_SAMPLING, hint: 'steps' },
  cfg: { label: 'CFG', group: GROUP_SAMPLING, hint: 'cfg' },
  sampler: { label: 'Sampler', group: GROUP_SAMPLING, hint: 'sampler' },
  scheduler: { label: 'Scheduler', group: GROUP_SAMPLING, hint: 'scheduler' },
  denoise: { label: 'Denoise', group: GROUP_SAMPLING, hint: 'denoise' },
  guidance: { label: 'Guidance', group: GROUP_SAMPLING },
  shift: { label: 'Shift', group: GROUP_SAMPLING },
  width: { label: 'Width', group: GROUP_SIZE, hint: 'width' },
  height: { label: 'Height', group: GROUP_SIZE, hint: 'height' },
  batch: { label: 'Batch', group: GROUP_SIZE, hint: 'batch' },
  clipSkip: { label: 'Clip skip', group: GROUP_SAMPLING, hint: 'clipSkip' },
};

export const ROLES = Object.keys(ROLE_INFO) as Role[];

const BY_NAME: Record<string, Role> = {
  steps: 'steps', cfg: 'cfg', sampler_name: 'sampler', scheduler: 'scheduler', denoise: 'denoise',
  width: 'width', height: 'height', batch_size: 'batch', guidance: 'guidance', shift: 'shift',
  stop_at_clip_layer: 'clipSkip',
};

const multiText = (p: WorkflowParam) => p.type === 'STRING' && p.multiline;

/** The negative text box: titled "negative", else the one other box when there are exactly two. */
export function detectNegative(params: readonly WorkflowParam[], targetId: string | null): string | null {
  const texts = params.filter((p) => multiText(p) && p.id !== targetId);
  const named = texts.find((p) => /neg/i.test(p.nodeLabel));
  if (named) return named.id;
  return targetId && texts.length === 1 && params.filter(multiText).length === 2 ? texts[0].id : null;
}

/** The role a widget plays, automatically. */
export function autoRole(p: WorkflowParam, targetId: string | null, negativeId: string | null): Role | null {
  if (targetId && p.id === targetId) return 'positive';
  if (negativeId && p.id === negativeId) return 'negative';
  if (p.seedLike && p.type === 'INT') return 'seed';
  if (p.type === 'BOOLEAN') return null;
  return BY_NAME[p.name] ?? null;
}

/** Friendly names for common node classes (a node the user titled keeps its own title). */
const NODE_NAMES: Array<[RegExp, string]> = [
  [/^KSampler/i, 'Sampler'], [/^SamplerCustom/i, 'Sampler'], [/EmptyLatentImage|EmptySD3LatentImage|EmptyHunyuanLatent/i, 'Size'],
  [/^CheckpointLoader/i, 'Model'], [/^UNETLoader|DiffusionModelLoader/i, 'Model'], [/^LoraLoader/i, 'LoRA'],
  [/^VAELoader/i, 'VAE'], [/^CLIPLoader|DualCLIPLoader|TripleCLIPLoader/i, 'Text encoder'], [/^CLIPSetLastLayer/i, 'Clip skip'],
  [/^CLIPTextEncode/i, 'Text'], [/^LoadImage/i, 'Input image'], [/^ImageScale/i, 'Resize'], [/^LatentUpscale/i, 'Upscale'],
  [/^UpscaleModelLoader/i, 'Upscale model'], [/^ImageUpscaleWithModel/i, 'Upscale'], [/^FluxGuidance/i, 'Guidance'],
  [/^ModelSampling/i, 'Model sampling'], [/ControlNet/i, 'ControlNet'], [/^SaveImage/i, 'Save'], [/^PreviewImage/i, 'Preview'],
  [/^VAEEncode/i, 'Encode'], [/^VAEDecode/i, 'Decode'], [/^BasicScheduler/i, 'Scheduler'], [/^RandomNoise/i, 'Noise'],
  [/^KSamplerSelect/i, 'Sampler'], [/^CFGGuider|BasicGuider/i, 'Guider'], [/IPAdapter/i, 'IP-Adapter'],
];

/** A node title as people read it: a renamed node keeps its title; a stock one gets a plain name. */
export function friendlyNode(p: Pick<WorkflowParam, 'nodeLabel' | 'nodeType'>): string {
  const label = p.nodeLabel.replace(/\s*#\d+$/, '').trim();
  const stock = NODE_NAMES.find(([re]) => re.test(p.nodeType));
  // A title that is just the class (or its display name) is not the user's: use the plain name.
  const isStock = !label || label.replace(/[\s()_-]/g, '').toLowerCase().startsWith(p.nodeType.replace(/[\s()_-]/g, '').toLowerCase().slice(0, 8))
    || /\(Prompt\)$/.test(label) || label === p.nodeType;
  if (isStock && stock) return stock[1];
  return label.replace(/\s*\(Prompt\)$/, '') || stock?.[1] || 'Node';
}

/** `strength_model` → "Strength model". */
export function friendlyName(name: string): string {
  const s = name.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ResolvedParam {
  p: WorkflowParam;
  role: Role | null;
  label: string;
  /** Small grey text after the label (which node, when the label alone is ambiguous). */
  sub?: string;
  group: string;
  hintId?: string;
  hintText?: string;
  control: Control;
  hidden: boolean;
}

/** Every widget, resolved: user mapping over the automatic role over the plain names. */
export function resolveParams(params: readonly WorkflowParam[], targetId: string | null, map: WorkflowMap = {}): ResolvedParam[] {
  const userRole = (id: string) => map[id]?.role;
  const posId = Object.keys(map).find((id) => userRole(id) === 'positive' && params.some((p) => p.id === id)) ?? targetId;
  const negId = Object.keys(map).find((id) => userRole(id) === 'negative' && params.some((p) => p.id === id)) ?? detectNegative(params, posId);
  const out = params.map((p): ResolvedParam => {
    const m = map[p.id] ?? {};
    const role = m.role === 'none' ? null : (m.role as Role | undefined) ?? autoRole(p, posId, negId);
    const info = role ? ROLE_INFO[role] : null;
    const node = friendlyNode(p);
    return {
      p, role,
      label: m.label?.trim() || info?.label || friendlyName(p.name),
      group: m.group?.trim() || info?.group || node,
      hintId: info?.hint,
      hintText: m.hint?.trim() || undefined,
      control: m.control ?? 'auto',
      hidden: !!m.hidden,
    };
  });
  // The same label twice in a group (two samplers' Steps): say which node each one is.
  const seen = new Map<string, number>();
  for (const r of out) seen.set(`${r.group}|${r.label}`, (seen.get(`${r.group}|${r.label}`) ?? 0) + 1);
  const nth = new Map<string, number>();
  for (const r of out) {
    const k = `${r.group}|${r.label}`;
    if ((seen.get(k) ?? 0) > 1) {
      const i = (nth.get(k) ?? 0) + 1;
      nth.set(k, i);
      r.sub = `${friendlyNode(r.p)} ${i}`;
    }
  }
  return out;
}

export interface ResolvedGroup { name: string; items: ResolvedParam[] }

/** Groups in reading order: Sampling, Size, then the rest in graph order; same names merge. */
export function groupResolved(list: readonly ResolvedParam[]): ResolvedGroup[] {
  const by = new Map<string, ResolvedParam[]>();
  for (const r of list) (by.get(r.group) ?? by.set(r.group, []).get(r.group)!).push(r);
  const rank = (n: string) => (n === GROUP_SAMPLING ? 0 : n === GROUP_SIZE ? 1 : 2);
  return [...by.entries()].map(([name, items]) => ({ name, items }))
    .sort((a, b) => rank(a.name) - rank(b.name));
}
