/**
 * The Workflow step's Prompt tab (rule 6, studio semantics): the picker on top, then the
 * workflow's own keywords (its tags), the prompt shared with the other workflows (or this
 * workflow's own), "Sent to <node>" (the text box the prompt goes into, re-pointable), and every
 * other multiline text box of the graph (a Negative, a second encoder) as its own card. Values
 * live in the studio store (`@/features/studio/studioStore`): `startWorkflowStepRun` composes
 * keywords + prompt into the target box on Generate. No Write it / Library yet: those write the
 * Image step's layers; "Use the Image step's prompt" copies them over.
 */
import { IconArrowDown, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { compileLayers } from '@/lib/prompt';
import { composePrompt, promptCandidates, useStudio } from '@/features/studio/studioStore';
import type { Step } from '~/app/stepsStore';
import { Chip } from '~/ui';
import { Pick, StringField } from './fields';
import { WorkflowPicker } from './WorkflowPicker';
import { markStepEdited, useWorkflowStepHost } from './useWorkflowStepHost';
import { Hint } from './Hint';

const NO_VALUES: Record<string, unknown> = {};
const MAX_TARGET_CHIPS = 3;

const area: React.CSSProperties = { width: '100%', border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 14, lineHeight: 1.5, resize: 'none', outline: 'none', padding: 0, display: 'block', fontFamily: 'inherit' };
const clearBtn: React.CSSProperties = { width: 30, height: 30, border: 0, borderRadius: '50%', background: 'var(--il-card-on)', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' };
const btn: React.CSSProperties = { height: 30, padding: '0 11px', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' };

export function WorkflowPromptTab({ step }: { step: Step }) {
  const { ref, open, loading } = useWorkflowStepHost(step);
  const params = useStudio((s) => s.params);
  const targetId = useStudio((s) => s.targetId());
  const keywords = useStudio((s) => (s.path ? s.keywords[s.path] ?? '' : ''));
  const shared = useStudio((s) => (s.path ? s.useShared[s.path] !== false : true));
  const prompt = useStudio((s) => (s.path && s.useShared[s.path] === false ? s.ownPrompt[s.path] ?? '' : s.sharedPrompt));
  const values = useStudio((s) => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const setKeywords = useStudio((s) => s.setKeywords);
  const setPrompt = useStudio((s) => s.setPrompt);
  const setUseShared = useStudio((s) => s.setUseShared);
  const setPromptTarget = useStudio((s) => s.setPromptTarget);
  const setValue = useStudio((s) => s.setValue);
  const resetValue = useStudio((s) => s.resetValue);
  const imagePrompt = useStore((s) => compileLayers(s.layers, 'positive'));

  const edit = (fn: () => void) => { fn(); markStepEdited(step.id); };
  const candidates = promptCandidates(params);
  const others = open ? candidates.filter((p) => p.id !== targetId) : [];
  const sent = composePrompt(keywords, prompt);

  return (
    <>
      <WorkflowPicker step={step} />
      {!ref && <Hint>Pick a workflow above. Its prompt, models and settings show here.</Hint>}
      {loading && <Hint>Opening {ref?.name}…</Hint>}
      {open && !targetId && <Hint>This workflow has no prompt box: nothing to write. Its settings are in the other tabs.</Hint>}
      {open && targetId && (
        <>
          <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Keywords <span style={{ color: 'var(--il-muted)', fontWeight: 600 }}>· this workflow's tags, first in the prompt</span></span>
              {keywords && <button type="button" aria-label="Clear keywords" onClick={() => edit(() => setKeywords(''))} style={{ ...clearBtn, width: 26, height: 26 }}><IconX size={12} stroke={2.4} /></button>}
            </div>
            <textarea aria-label="Keywords for this workflow" rows={2} value={keywords} onChange={(e) => edit(() => setKeywords(e.currentTarget.value))}
              placeholder="score_9, score_8_up, masterpiece…" style={{ ...area, fontSize: 13 }} />
          </div>

          <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Prompt</span>
              <Chip small on={shared} onClick={() => edit(() => setUseShared(!shared))} title={shared ? 'Shared with the other workflows · tap to give this one its own' : 'This workflow\'s own prompt · tap to share'}>
                {shared ? 'shared' : 'own'}
              </Chip>
            </div>
            <textarea aria-label="Prompt" rows={6} value={prompt} onChange={(e) => edit(() => setPrompt(e.currentTarget.value))} placeholder="What do you want to see?" style={area} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <button type="button" style={btn} disabled={!imagePrompt.trim()} title={imagePrompt.trim() ? 'Copy the Image step\'s prompt here' : 'The Image step has no prompt'}
                onClick={() => edit(() => setPrompt(imagePrompt))}><IconArrowDown size={13} />Use the Image step's prompt</button>
              <div style={{ flex: 1 }} />
              <button type="button" aria-label="Clear prompt" onClick={() => edit(() => setPrompt(''))} style={clearBtn}><IconX size={14} stroke={2.4} /></button>
            </div>
          </div>

          <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', flex: 'none' }}>Sent to</span>
            {candidates.length <= 1 ? (
              <span style={{ fontSize: 12, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidates[0]?.nodeLabel} #{candidates[0]?.nodeId}</span>
            ) : candidates.length <= MAX_TARGET_CHIPS ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                {candidates.map((c) => <Chip key={c.id} small on={c.id === targetId} onClick={() => edit(() => setPromptTarget(c.id))}>{c.nodeLabel} #{c.nodeId}</Chip>)}
              </div>
            ) : (
              <Pick label="Which text box receives the prompt" value={targetId} options={candidates.map((c) => ({ value: c.id, label: `${c.nodeLabel} #${c.nodeId}` }))} onChange={(id) => edit(() => setPromptTarget(id))} />
            )}
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', flex: 'none', fontVariantNumeric: 'tabular-nums' }} title={sent}>{sent.length} chars</span>
          </div>
        </>
      )}
      {others.length > 0 && (
        <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '2px 12px' }}>
          {others.map((p) => (
            <StringField key={p.id} p={p} value={p.id in values ? values[p.id] : p.value} sub={`${p.nodeLabel} #${p.nodeId}`}
              onChange={(v) => edit(() => setValue(p.id, v))} onReset={() => resetValue(p.id)} rows={3} />
          ))}
        </div>
      )}
    </>
  );
}
