/**
 * The Workflow step's Model tab (rule 4 applied to a saved graph): one row per loader widget
 * (checkpoint / diffusion model / LoRA / VAE / CLIP / ControlNet / upscale model: any COMBO whose
 * options are a server file list), with the file's name, the server's list to pick from, and
 * "Browse ▾" opening the big models modal (`~/screens/image/model`'s `ModelsModalBridge`) for the
 * kinds it knows. A value the server does not list is flagged "not on this server". Values are
 * the studio store's, so Generate sends them.
 */
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconArrowBackUp, IconSearch } from '@tabler/icons-react';
import { useStudio } from '@/features/studio/studioStore';
import type { WorkflowParam } from '@/features/studio/params';
import type { Step } from '~/app/stepsStore';
import { ModelsModalBridge, type ModelPick } from '~/screens/image/model';
import { IconBtn } from '~/ui';
import { Pick } from './fields';
import { Hint } from './Hint';
import { WorkflowPicker } from './WorkflowPicker';
import { markStepEdited, useWorkflowStepHost } from './useWorkflowStepHost';
import { fileLabel, isLoaderParam, loaderLabel, loaderPickKind, loaderStatus } from './workflowStepLogic';

const NO_VALUES: Record<string, unknown> = {};

/** The server's name for a picked file: exact, else the option whose base name matches. */
function matchOption(options: string[], file: string): string | null {
  if (options.includes(file)) return file;
  const base = file.replace(/^.*[\\/]/, '').toLowerCase();
  return options.find((o) => o.replace(/^.*[\\/]/, '').toLowerCase() === base) ?? null;
}

function LoaderRow({ p, value, onChange, onReset }: { p: WorkflowParam; value: unknown; onChange: (v: string) => void; onReset: () => void }) {
  const [browsing, setBrowsing] = useState(false);
  const options = (p.options ?? []).map(String);
  const status = loaderStatus(p, value);
  const kind = loaderPickKind(p);
  const onPick = (pick: ModelPick) => {
    setBrowsing(false);
    const file = pick.installed && pick.file ? matchOption(options, pick.file) : null;
    if (file) onChange(file);
    else notifications.show({ color: 'yellow', title: 'Not on this server', message: `${pick.model.name} is not downloaded here yet. Get it from Models first, then pick it.`, autoClose: 5000 });
  };
  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 24 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {loaderLabel(p)}<span style={{ fontWeight: 600, color: 'var(--il-muted)' }}> · {p.nodeLabel}</span>
        </span>
        {value !== p.value && <IconBtn size={24} icon={<IconArrowBackUp size={13} />} label="Back to the file saved in ComfyUI" onClick={onReset} />}
        {kind && <IconBtn size={26} tone="card" icon={<IconSearch size={14} />} label="Browse the models" onClick={() => setBrowsing(true)} />}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(value ?? '')}>{fileLabel(value)}</div>
      {status === 'missing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--il-warn)' }}>
          <IconAlertTriangle size={13} />not on this server — pick one below or download it from Models
        </div>
      )}
      {status === 'none'
        ? <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>The server lists nothing for this slot.</div>
        : <Pick label={`${loaderLabel(p)} file`} value={String(value ?? '')} options={options} onChange={onChange} placeholder="Pick a file on the server" />}
      {kind && (
        <ModelsModalBridge opened={browsing} onClose={() => setBrowsing(false)} kind={kind} title={`Pick a ${loaderLabel(p)}`} onPick={onPick}
          fallback={{ files: options, selected: value ? [String(value)] : [] }} />
      )}
    </div>
  );
}

export function WorkflowModelTab({ step }: { step: Step }) {
  const { ref, open, loading } = useWorkflowStepHost(step);
  const params = useStudio((s) => s.params);
  const values = useStudio((s) => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const setValue = useStudio((s) => s.setValue);
  const resetValue = useStudio((s) => s.resetValue);
  const loaders = open ? params.filter(isLoaderParam) : [];
  return (
    <>
      {!ref && <WorkflowPicker step={step} />}
      {!ref && <Hint>Pick a workflow first.</Hint>}
      {loading && <Hint>Opening {ref?.name}…</Hint>}
      {open && !loaders.length && <Hint>This workflow has no model slot.</Hint>}
      {loaders.map((p) => (
        <LoaderRow key={p.id} p={p} value={p.id in values ? values[p.id] : p.value}
          onChange={(v) => { setValue(p.id, v); markStepEdited(step.id); }} onReset={() => resetValue(p.id)} />
      ))}
    </>
  );
}
