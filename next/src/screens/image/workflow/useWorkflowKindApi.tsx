/**
 * A Workflow step's `KindApi` for the universal model list (rule 4): every loader widget of the
 * open workflow (checkpoint / diffusion model / LoRA / VAE / CLIP / ControlNet / upscale model…)
 * is one fixed entry of its kind — the file it holds, badged with the node's title, a Strength
 * slider when the node has one, CLIP strength and "back to the saved file" under More. A pick
 * writes the file through the studio store's `setValue`, so Generate sends it. Registers the
 * 'workflow' pending scope: a download that lands renames the waiting widget.
 */
import { createContext, useContext, useMemo } from 'react';
import { useStudio } from '@/features/studio/studioStore';
import type { WorkflowParam } from '@/features/studio/params';
import { IconArrowBackUp } from '@tabler/icons-react';
import { Chip, SliderRow } from '~/ui';
import { registerPendingScope, fmtWeight, KINDS, type KindApi, type ModelKind, type CardParts } from '~/screens/image/model';
import type { Step } from '~/app/stepsStore';
import { markStepEdited } from './useWorkflowStepHost';
import { fileLabel, isLoaderParam } from './workflowStepLogic';
import { loaderKind, loadersHolding, matchOption, strengthWidgets, workflowEntries } from './workflowKinds';

export const WORKFLOW_SCOPE = 'workflow';

/** The step whose tab mounted the list (so `useWorkflowKindApi` fits `ModelList`'s `useApi(kind)`). */
export const WorkflowStepContext = createContext<Step | null>(null);
const NO_VALUES: Record<string, unknown> = Object.freeze({});
const NO_PARAMS: WorkflowParam[] = Object.freeze([]) as unknown as WorkflowParam[];

/** The files every loader widget of `kind` offers (the union of their option lists). */
function filesOf(params: readonly WorkflowParam[], kind: ModelKind): string[] {
  const out = new Set<string>();
  for (const p of params) if (loaderKindOf(p) === kind) for (const o of p.options ?? []) out.add(String(o));
  return [...out];
}

const loaderKindOf = (p: WorkflowParam): ModelKind | null => (isLoaderParam(p) ? loaderKind(p) : null);

export function useWorkflowKindApi(kind: ModelKind): KindApi {
  const step = useContext(WorkflowStepContext);
  const stepId = step?.id ?? null;
  const params = useStudio((s) => s.params) ?? NO_PARAMS;
  const values = useStudio((s) => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const entries = useMemo(() => workflowEntries(params, values, kind), [params, values, kind]);
  const files = useMemo(() => filesOf(params, kind), [params, kind]);

  return useMemo<KindApi>(() => {
    const write = (id: string, v: unknown) => { useStudio.getState().setValue(id, v); if (stepId) markStepEdited(stepId); };
    const mainOf = (id: string) => { const p = params.find((x) => x.id === id); return p ? strengthWidgets(params, p).main : undefined; };
    return {
      kind, spec: KINDS[kind], entries, files,
      pendingScope: WORKFLOW_SCOPE,
      rename: (id, name) => { const p = params.find((x) => x.id === id); write(id, matchOption((p?.options ?? []).map(String), name) ?? name); },
      setOn: () => undefined,
      setWeight: (id, v) => { const m = mainOf(id); if (m) write(m.id, v); },
      card: CARD,
    };
  }, [kind, entries, files, params, stepId]);
}

const CARD: CardParts = {
  more: (e) => <LoaderMore id={e.id} />,
  moreHint: (e) => { const p = useStudio.getState().params.find((x) => x.id === e.id); return p && strengthWidgets(useStudio.getState().params, p).clip ? 'CLIP strength, saved file' : 'saved file'; },
};

/** CLIP strength when the node has one; the file saved in ComfyUI with a way back to it. */
function LoaderMore({ id }: { id: string }) {
  const params = useStudio((s) => s.params);
  const values = useStudio((s) => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const p = params.find((x) => x.id === id);
  if (!p) return null;
  const { clip } = strengthWidgets(params, p);
  const clipValue = clip ? Number(clip.id in values ? values[clip.id] : clip.value) : NaN;
  const current = id in values ? values[id] : p.value;
  const edited = current !== p.value;
  return (
    <>
      {clip && Number.isFinite(clipValue) && (
        <SliderRow label="CLIP strength" value={clipValue} min={0} max={2} step={0.05} presets={[0.5, 0.8, 1, 1.2]} format={fmtWeight}
          onChange={(v) => useStudio.getState().setValue(clip.id, v)} hint="How much the LoRA changes the way the words read" />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--il-muted)' }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(p.value ?? '')}>Saved in ComfyUI: <b style={{ color: 'var(--il-fg2)' }}>{fileLabel(p.value)}</b></span>
        {edited && <Chip small icon={<IconArrowBackUp size={12} />} onClick={() => useStudio.getState().resetValue(id)} title="Back to the file saved in ComfyUI">Back to saved</Chip>}
      </div>
    </>
  );
}

registerPendingScope(WORKFLOW_SCOPE, {
  // The waiting widget is a value under some workflow path (the step's workflow may not be the open one right now).
  has: (r) => {
    const s = useStudio.getState();
    const base = r.file.replace(/^.*[\\/]/, '').toLowerCase();
    return Object.values(s.values).some((v) => Object.values(v).some((x) => String(x ?? '').replace(/^.*[\\/]/, '').toLowerCase() === base));
  },
  land: (r, file) => {
    const s = useStudio.getState();
    for (const id of loadersHolding(s.params, s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES, r.kind, r.file)) {
      const p = s.params.find((x) => x.id === id);
      s.setValue(id, matchOption((p?.options ?? []).map(String), file) ?? file);
    }
  },
});
