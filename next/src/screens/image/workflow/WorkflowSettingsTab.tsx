/**
 * The Workflow step's Settings tab (rule 5 for a saved graph): the picker on top, then every
 * widget that is not a prompt box, a loader or a picture, as next-look fields — number (slider +
 * presets, or a stepper box), combo (chips ≤ 5 else a select), bool, string, seed (box + dice +
 * keep / random each run) — grouped per node with the node's title as the label, the **Pinned**
 * group first. Pins are the studio store's `exposed` (persisted per workflow, as the classic app);
 * values are its `values`, read and written through `setValue` so `startWorkflowStepRun` sends
 * them (the widgets_values mapping and the seed trap stay inside `@/lib/workflowGraph`).
 */
import { useMemo } from 'react';
import { IconArrowBackUp } from '@tabler/icons-react';
import { useStudio } from '@/features/studio/studioStore';
import type { WorkflowParam } from '@/features/studio/params';
import type { Step } from '~/app/stepsStore';
import { Chip, Eyebrow } from '~/ui';
import { BoolField, ComboField, NumberField, SeedField, StringField } from './fields';
import { Hint } from './Hint';
import { WorkflowPicker } from './WorkflowPicker';
import { markStepEdited, useWorkflowStepHost } from './useWorkflowStepHost';
import { useKeptSeeds, useWorkflowStepStore } from './workflowStepStore';
import { classify, groupByNode, pinnedFirst, type WidgetKind } from './workflowStepLogic';

const NO_IDS: string[] = [];
const NO_VALUES: Record<string, unknown> = {};
const SETTINGS_KINDS: ReadonlySet<WidgetKind> = new Set(['seed', 'number', 'combo', 'bool', 'string']);

export function WorkflowSettingsTab({ step }: { step: Step }) {
  const { ref, open, loading } = useWorkflowStepHost(step);
  const path = useStudio((s) => s.path);
  const params = useStudio((s) => s.params);
  const targetId = useStudio((s) => s.targetId());
  const pinned = useStudio((s) => (s.path ? s.exposed[s.path] ?? NO_IDS : NO_IDS));
  const values = useStudio((s) => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const setValue = useStudio((s) => s.setValue);
  const resetValue = useStudio((s) => s.resetValue);
  const togglePin = useStudio((s) => s.toggleExposed);
  const kept = useKeptSeeds(path);
  const toggleKept = useWorkflowStepStore((s) => s.toggleKept);

  // Multiline text boxes live in the Prompt tab; everything else of these kinds is here.
  const shown = useMemo(() => (open ? params.filter((p) => SETTINGS_KINDS.has(classify(p, targetId)) && !(p.type === 'STRING' && p.multiline)) : []), [open, params, targetId]);
  const groups = useMemo(() => groupByNode(shown), [shown]);
  const top = useMemo(() => pinnedFirst(shown, pinned), [shown, pinned]);
  const changed = shown.filter((p) => p.id in values && values[p.id] !== p.value).length;

  const field = (p: WorkflowParam, inPinned: boolean) => {
    const value = p.id in values ? values[p.id] : p.value;
    const common = {
      p, value, pinned: pinned.includes(p.id), onPin: () => togglePin(p.id),
      onChange: (v: unknown) => { setValue(p.id, v); markStepEdited(step.id); },
      onReset: () => resetValue(p.id),
      sub: inPinned ? p.nodeLabel : undefined,
    };
    switch (classify(p, targetId)) {
      case 'seed': return <SeedField key={p.id} {...common} kept={kept.includes(p.id)} onToggleKept={() => { if (path) toggleKept(path, p.id); }} />;
      case 'number': return <NumberField key={p.id} {...common} />;
      case 'combo': return <ComboField key={p.id} {...common} />;
      case 'bool': return <BoolField key={p.id} {...common} />;
      default: return <StringField key={p.id} {...common} />;
    }
  };

  return (
    <>
      <WorkflowPicker step={step} />
      {!ref && <Hint>Pick a workflow above. Every setting of its nodes shows here.</Hint>}
      {loading && <Hint>Opening {ref?.name}…</Hint>}
      {open && !shown.length && <Hint>This workflow has no settings to change.</Hint>}
      {top.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Eyebrow style={{ padding: '2px 4px 0' }}>Pinned</Eyebrow>
          <div style={{ background: 'var(--il-card)', border: '1px solid var(--il-ember-line)', borderRadius: 14, padding: '2px 10px' }}>{top.map((p) => field(p, true))}</div>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.nodeId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Eyebrow style={{ padding: '2px 4px 0', display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
            <span style={{ color: 'var(--il-dim)', fontWeight: 700 }}>#{g.nodeId}</span>
          </Eyebrow>
          <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: '2px 10px' }}>{g.items.map((p) => field(p, false))}</div>
        </section>
      ))}
      {open && shown.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 6px' }}>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{top.length ? '' : 'Pin a setting (the pin on its row) to keep it on top.'}</span>
          <Chip small icon={<IconArrowBackUp size={12} />} disabled={!changed} onClick={() => shown.forEach((p) => resetValue(p.id))} title="Every setting back to what ComfyUI saved">
            Reset{changed ? ` ${changed}` : ''}
          </Chip>
        </div>
      )}
    </>
  );
}
