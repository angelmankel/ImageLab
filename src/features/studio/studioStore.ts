/**
 * Studio's own state: which saved workflow is loaded, what its knobs are set to, and which of them
 * are worth showing when the person just wants to make pictures.
 *
 * Deliberately separate from the generate view's store. That one owns a fixed pipeline described
 * by WorkflowState; this one owns "whatever graph you built in ComfyUI", and the two have almost
 * nothing in common beyond the server list. Keeping them apart is what lets Studio be rebuilt
 * without touching a working view.
 */
import { create } from 'zustand';
import type { EditorWorkflowWithSubgraphs, ObjectInfo } from '@/lib/workflowGraph';
import { readParams, randomSeed, type WorkflowParam } from './params';

/** Per-workflow choices survive reloads — re-picking exposed knobs every session would be absurd. */
const KEY = 'imagelab.studio.v1';

export type StudioMode = 'simple' | 'advanced';

interface Persisted {
  /** workflow path → the param ids chosen for simple mode, in display order. */
  exposed: Record<string, string[]>;
  /** workflow path → last values, so a workflow reopens where it was left. */
  values: Record<string, Record<string, unknown>>;
  lastPath: string | null;
  mode: StudioMode;
  /** Hide ComfyUI itself and live only in this UI. */
  focusMode: boolean;
  /**
   * The prompt shared by every workflow that opts in: the subject, written once and carried from
   * one workflow to the next. What a particular model wants on top of it goes in `keywords`.
   */
  sharedPrompt: string;
  /** workflow path → keywords only that workflow needs (quality/score tags, trigger words). */
  keywords: Record<string, string>;
  /** workflow path → that workflow's own prompt, used when it does not share. */
  ownPrompt: Record<string, string>;
  /** workflow path → false to use `ownPrompt` instead of `sharedPrompt`. Missing means shared. */
  useShared: Record<string, boolean>;
  /** workflow path → the param the composed prompt is written into. Missing means auto-detected. */
  promptTarget: Record<string, string>;
}

// Focus mode defaults OFF. On a phone `useFocusMode` forces it on regardless, which is where it
// was asked for; defaulting it on for desktop too quietly removed the ComfyUI buttons from a
// sidebar someone was still using.
const EMPTY: Persisted = {
  exposed: {}, values: {}, lastPath: null, mode: 'simple', focusMode: false,
  sharedPrompt: '', keywords: {}, ownPrompt: {}, useShared: {}, promptTarget: {},
};

/** The text params a prompt can be written into: multiline STRING widgets. */
export const promptCandidates = (params: WorkflowParam[]) =>
  params.filter(p => p.type === 'STRING' && p.multiline);

/**
 * Where the composed prompt goes when nobody has said: a text box titled "positive", else the first
 * multiline text that is not titled "negative". A workflow with no such box has no prompt target
 * and the prompt panel stays out of the way.
 */
export function detectPromptTarget(params: WorkflowParam[]): string | null {
  const texts = promptCandidates(params);
  const byLabel = (re: RegExp) => texts.find(p => re.test(p.nodeLabel));
  return (byLabel(/positive/i) ?? texts.find(p => !/negative/i.test(p.nodeLabel)))?.id ?? null;
}

/** Keywords first, then the prompt, joined the way a tag list is. Either side may be empty. */
export function composePrompt(keywords: string, prompt: string): string {
  const k = keywords.trim().replace(/,\s*$/, '');
  const p = prompt.trim();
  return k && p ? `${k}, ${p}` : k || p;
}

function load(): Persisted {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw ? { ...EMPTY, ...raw } : EMPTY;
  } catch { return EMPTY; }
}

interface StudioStore extends Persisted {
  /** The loaded workflow, as saved in ComfyUI. Null until one is picked. */
  workflow: EditorWorkflowWithSubgraphs | null;
  /** Path of the loaded workflow — the key everything per-workflow is stored under. */
  path: string | null;
  /** Every knob found on it. Recomputed whenever the workflow or object_info changes. */
  params: WorkflowParam[];
  error: string | null;

  loadWorkflow: (path: string, wf: EditorWorkflowWithSubgraphs, info: ObjectInfo) => void;
  setValue: (id: string, value: unknown) => void;
  resetValue: (id: string) => void;
  toggleExposed: (id: string) => void;
  setExposed: (ids: string[]) => void;
  setMode: (mode: StudioMode) => void;
  setFocusMode: (on: boolean) => void;
  setError: (error: string | null) => void;
  /** The param the prompt is written into for the open workflow, or null if it has none. */
  targetId: () => string | null;
  setPromptTarget: (id: string) => void;
  setKeywords: (text: string) => void;
  /** Writes whichever prompt the open workflow uses: the shared one or its own. */
  setPrompt: (text: string) => void;
  setUseShared: (on: boolean) => void;
  /** Values for the loaded workflow, falling back to each param's own value. */
  currentValues: () => Record<string, unknown>;
  /** Re-roll every seed-like knob. Called before each run unless the person pinned the seed. */
  rerollSeeds: () => void;
}

export const useStudio = create<StudioStore>((set, get) => {
  const persisted = load();
  const persist = () => {
    const { exposed, values, lastPath, mode, focusMode, sharedPrompt, keywords, ownPrompt, useShared, promptTarget } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({
        exposed, values, lastPath, mode, focusMode, sharedPrompt, keywords, ownPrompt, useShared, promptTarget,
      }));
    }
    catch { /* private mode, a quota, a blocked origin — none of it should break the app */ }
  };

  return {
    ...persisted,
    workflow: null,
    path: null,
    params: [],
    error: null,

    loadWorkflow: (path, wf, info) => {
      const params = readParams(wf, info);
      // Drop remembered values whose knob no longer exists: the workflow was edited in ComfyUI and
      // the old id would otherwise be written back into a node that has moved on.
      const live = new Set(params.map(p => p.id));
      const kept = Object.fromEntries(
        Object.entries(get().values[path] ?? {}).filter(([id]) => live.has(id)));
      const exposed = (get().exposed[path] ?? []).filter(id => live.has(id));
      set(s => ({
        workflow: wf, path, params, error: null, lastPath: path,
        values: { ...s.values, [path]: kept },
        exposed: { ...s.exposed, [path]: exposed },
      }));
      // First time this workflow is opened with a prompt box: keep the text it was saved with, as
      // its own prompt, and as the shared one too if nothing has been written there yet. Without
      // this, opening a workflow would replace its prompt with an empty shared one.
      const target = get().targetId();
      if (target && !(path in get().ownPrompt)) {
        const saved = String(kept[target] ?? params.find(p => p.id === target)?.value ?? '');
        set(s => ({
          ownPrompt: { ...s.ownPrompt, [path]: saved },
          sharedPrompt: s.sharedPrompt.trim() ? s.sharedPrompt : saved,
        }));
      }
      persist();
    },

    setValue: (id, value) => {
      const path = get().path;
      if (!path) return;
      set(s => ({ values: { ...s.values, [path]: { ...s.values[path], [id]: value } } }));
      persist();
    },

    resetValue: (id) => {
      const path = get().path;
      if (!path) return;
      set(s => {
        const next = { ...s.values[path] };
        delete next[id];
        return { values: { ...s.values, [path]: next } };
      });
      persist();
    },

    toggleExposed: (id) => {
      const path = get().path;
      if (!path) return;
      set(s => {
        const cur = s.exposed[path] ?? [];
        const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
        return { exposed: { ...s.exposed, [path]: next } };
      });
      persist();
    },

    setExposed: (ids) => {
      const path = get().path;
      if (!path) return;
      set(s => ({ exposed: { ...s.exposed, [path]: ids } }));
      persist();
    },

    setMode: (mode) => { set({ mode }); persist(); },
    setFocusMode: (focusMode) => { set({ focusMode }); persist(); },
    setError: (error) => set({ error }),

    targetId: () => {
      const { path, params, promptTarget } = get();
      if (!path) return null;
      const chosen = promptTarget[path];
      if (chosen && params.some(p => p.id === chosen)) return chosen;
      return detectPromptTarget(params);
    },
    setPromptTarget: (id) => {
      const path = get().path;
      if (!path) return;
      set(s => ({ promptTarget: { ...s.promptTarget, [path]: id } }));
      persist();
    },
    setKeywords: (text) => {
      const path = get().path;
      if (!path) return;
      set(s => ({ keywords: { ...s.keywords, [path]: text } }));
      persist();
    },
    setPrompt: (text) => {
      const path = get().path;
      if (!path) return;
      if (get().useShared[path] !== false) set({ sharedPrompt: text });
      else set(s => ({ ownPrompt: { ...s.ownPrompt, [path]: text } }));
      persist();
    },
    setUseShared: (on) => {
      const path = get().path;
      if (!path) return;
      set(s => ({ useShared: { ...s.useShared, [path]: on } }));
      persist();
    },

    currentValues: () => {
      const { params, values, path } = get();
      const saved = path ? values[path] ?? {} : {};
      const out: Record<string, unknown> = {};
      for (const p of params) out[p.id] = p.id in saved ? saved[p.id] : p.value;
      // The prompt box is driven by keywords + prompt, not by its own field.
      const target = get().targetId();
      if (path && target) {
        const s = get();
        const prompt = s.useShared[path] !== false ? s.sharedPrompt : s.ownPrompt[path] ?? '';
        out[target] = composePrompt(s.keywords[path] ?? '', prompt);
      }
      return out;
    },

    rerollSeeds: () => {
      const { params, path } = get();
      if (!path) return;
      const seeds = params.filter(p => p.seedLike && p.type === 'INT');
      if (!seeds.length) return;
      set(s => {
        const next = { ...s.values[path] };
        for (const p of seeds) next[p.id] = randomSeed();
        return { values: { ...s.values, [path]: next } };
      });
      persist();
    },
  };
});

/** The params to show in simple mode: the chosen ones, in the order they were chosen. */
export function exposedParams(params: WorkflowParam[], exposed: string[]): WorkflowParam[] {
  const byId = new Map(params.map(p => [p.id, p]));
  return exposed.map(id => byId.get(id)).filter((p): p is WorkflowParam => !!p);
}
