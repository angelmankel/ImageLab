/**
 * The Workflow step's picker (rule 2: a step = a saved ComfyUI workflow). A card: the step's
 * workflow name, "14 saved", Refresh, and "Change ▾" that unfolds every saved workflow of the
 * step's server, grouped by folder (TagForce/…). Tap = the step runs that one: the ref goes to
 * the comfy `workflowStore` (what Generate reads), the step is renamed, and
 * `ensureStepWorkflowOpen` loads it into the studio store so the other tabs fill at once.
 */
import { useState } from 'react';
import { IconChevronDown, IconChevronUp, IconFolder, IconRefresh, IconTopologyStar3 } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { serverRole } from '@/lib/serverRoles';
import { loadSavedWorkflow, type SavedWorkflow } from '@/lib/comfy';
import { useStudio } from '@/features/studio/studioStore';
import type { EditorWorkflowWithSubgraphs } from '@/lib/workflowGraph';
import { useSteps, type Step } from '~/app/stepsStore';
import { ensureStepWorkflowOpen, useWorkflowStore } from '~/screens/comfy';
import { workflowKey } from '~/screens/comfy/workflowStore';
import { IconBtn } from '~/ui';
import { useSavedWorkflows } from './useSavedWorkflows';
import { useWorkflowStepHost } from './useWorkflowStepHost';
import { groupWorkflows } from './workflowStepLogic';
import { notifyError } from '~/app/notify';

/** Make `w` the step's workflow and load it. Shared with anything else that picks (the ComfyUI screen has its own). */
export async function chooseStepWorkflow(step: Step, host: string, w: SavedWorkflow): Promise<void> {
  const server = useStore.getState().servers.find((s) => s.host === host) ?? null;
  const wfStore = useWorkflowStore.getState();
  wfStore.setStepWorkflow(step.id, { host, serverId: server?.id ?? null, path: w.path, name: w.name, kind: server && serverRole(server) === 'video' ? 'video' : 'image' });
  wfStore.markUsed(workflowKey(host, w.path));
  useSteps.getState().updateStep(step.id, { name: w.name, edited: false });
  try { await ensureStepWorkflowOpen(step.id); } catch (err) {
    notifyError('Could not open the workflow', err);
  }
}

export function WorkflowPicker({ step }: { step: Step }) {
  const { ref, host, info, loading } = useWorkflowStepHost(step);
  const list = useSavedWorkflows(host);
  const [open, setOpen] = useState(!ref);
  const groups = groupWorkflows(list.rows);
  const pick = async (w: SavedWorkflow) => {
    if (!host) return;
    setOpen(false);
    await chooseStepWorkflow(step, host, w);
  };
  /** Refresh = the list again, and the step's own file re-read (a save in ComfyUI shows up). */
  const refresh = async () => {
    list.refresh();
    if (!ref || !info) return;
    try {
      const wf = await loadSavedWorkflow(ref.host, ref.path);
      useStudio.getState().loadWorkflow(ref.path, wf as EditorWorkflowWithSubgraphs, info);
    } catch (err) {
      notifyError('Could not re-read the workflow', err);
    }
  };

  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ width: 30, height: 30, flex: 'none', borderRadius: 10, background: 'var(--il-bg-deep)', color: ref ? 'var(--il-ember-hi)' : 'var(--il-muted)', display: 'grid', placeItems: 'center' }}>
          <IconTopologyStar3 size={16} stroke={2} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ref?.path}>
            {ref ? ref.name : 'Pick a workflow'}
          </span>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>
            {!host ? 'No ComfyUI server' : loading ? 'Opening…' : list.error ? `Could not list: ${list.error}` : `${list.rows.length} saved${list.loading ? ' · reading…' : ''}`}
          </span>
        </span>
        <IconBtn size={30} tone="card" icon={<IconRefresh size={15} />} label="Refresh" onClick={() => void refresh()} disabled={!host} />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={!host}
          style={{ height: 30, padding: '0 10px', border: 0, borderRadius: 999, background: open ? 'var(--il-ember-soft)' : 'var(--il-card-on)', color: open ? 'var(--il-ember-hi)' : 'var(--il-fg2)', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', flex: 'none' }}>
          {ref ? 'Change' : 'Pick'}{open ? <IconChevronUp size={13} stroke={2.6} /> : <IconChevronDown size={13} stroke={2.6} />}
        </button>
      </div>
      {open && host && (
        <div className="il-scroll" style={{ maxHeight: 320, overflowY: 'auto', touchAction: 'pan-y', display: 'flex', flexDirection: 'column', gap: 2, margin: '0 -4px' }}>
          {groups.map((g) => (
            <div key={g.folder || '/'} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {g.folder && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 6px 2px', fontSize: 10, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--il-muted)' }}>
                  <IconFolder size={12} />{g.folder}
                </div>
              )}
              {g.items.map((w) => {
                const on = ref?.path === w.path;
                return (
                  <button key={w.path} type="button" onClick={() => void pick(w)} aria-pressed={on} title={w.path}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 8px', border: 0, borderRadius: 12, textAlign: 'left', cursor: 'pointer', background: on ? 'var(--il-ember-soft)' : 'transparent', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg)', fontSize: 13, fontWeight: on ? 800 : 700 }}>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
                    {on && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px' }}>this step</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {!list.rows.length && (
            <div style={{ padding: '12px 8px', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', textAlign: 'center' }}>
              {list.loading ? 'Reading the server…' : list.error ? list.error : 'No saved workflows on this server. Save one in ComfyUI.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
