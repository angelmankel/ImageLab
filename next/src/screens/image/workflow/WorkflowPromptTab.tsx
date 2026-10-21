/**
 * The Workflow step's Prompt tab (item 39: like the Image step's). The picker, the workflow's
 * keywords (its tags, first in the prompt), then THE prompt card — the smart box with the
 * Prompt / Negative tabs — and the tile grid / negative pills under it, all the Image step's own
 * components. Positive = the prompt shared with the other workflows (or this one's own); negative
 * = the workflow's negative text box, found automatically (`paramMap`). Any other text box shows
 * with a friendly label. Raw node names never show here: which box is which is set in
 * "Labels & controls" (the ComfyUI screen, or the Settings tab), not in this tab.
 */
import { useEffect, useMemo } from 'react';
import { IconArrowDown, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { compileLayers } from '@/lib/prompt';
import { useStudio } from '@/features/studio/studioStore';
import type { Step } from '~/app/stepsStore';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, Chip } from '~/ui';
import { PromptCard } from '../prompt/PromptCard';
import { TileGrid } from '../prompt/TileGrid';
import { SnippetHost } from '../snippets/SnippetHost';
import { NegativePills } from '../prompt/NegativePills';
import { usePromptTiles } from '../prompt/usePromptTiles';
import { useTileEdit } from '../prompt/tileStore';
import { StringField } from './fields';
import { WorkflowPicker } from './WorkflowPicker';
import { markStepEdited, useWorkflowStepHost } from './useWorkflowStepHost';
import { Hint } from './Hint';
import { resolveParams } from './paramMap';
import { useWorkflowMap } from './paramMapStore';

const NO_VALUES: Record<string, unknown> = {};

export function WorkflowPromptTab({ step }: { step: Step }) {
  const phone = useIsPhone();
  const { ref, open, loading } = useWorkflowStepHost(step);
  const path = useStudio((s) => s.path);
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
  const imageNegative = useStore((s) => compileLayers(s.layers, 'negative'));
  const map = useWorkflowMap(path);
  const negative = useTileEdit((s) => s.negative);
  const setNegative = useTileEdit((s) => s.setNegative);

  const resolved = useMemo(() => (open ? resolveParams(params, targetId, map) : []), [open, params, targetId, map]);
  const pos = resolved.find((r) => r.role === 'positive');
  const neg = resolved.find((r) => r.role === 'negative');
  const others = resolved.filter((r) => r.p.type === 'STRING' && r.p.multiline && !r.role && !r.hidden);

  // A box the mapping names as the prompt becomes the studio's target (what Generate writes into).
  useEffect(() => { if (pos && pos.p.id !== targetId) setPromptTarget(pos.p.id); }, [pos?.p.id, targetId, setPromptTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (fn: () => void) => { fn(); markStepEdited(step.id); };
  const negValue = neg ? String(neg.p.id in values ? values[neg.p.id] ?? '' : neg.p.value ?? '') : '';
  const writePos = (t: string) => edit(() => setPrompt(t));
  const writeNeg = (t: string) => { if (neg) edit(() => setValue(neg.p.id, t)); };
  const tiles = usePromptTiles({ text: prompt, put: writePos }, neg ? { text: negValue, put: writeNeg } : undefined);
  const negMode = negative && !!neg;
  const size = phone ? 'lg' : 'sm';

  return (
    <>
      <WorkflowPicker step={step} />
      {!ref && <Hint>Pick a workflow above. Its prompt, models and settings show here.</Hint>}
      {loading && <Hint>Opening {ref?.name}…</Hint>}
      {open && !pos && <Hint>This workflow has no prompt box: nothing to write. Its settings are in the other tabs.</Hint>}
      {open && pos && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--il-card)', borderRadius: 14, padding: '0 6px 0 12px', minHeight: phone ? 44 : 38 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--il-muted)', flex: 'none' }} title="Workflow tags">Keywords</span>
            <input aria-label="Keywords for this workflow" value={keywords} onChange={(e) => edit(() => setKeywords(e.currentTarget.value))} placeholder="this workflow's tags, first in the prompt"
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }} />
            {keywords && <Button tone="ghost" size="sm" icon={<IconX size={12} stroke={2.4} />} tooltip="Clear the keywords" onClick={() => edit(() => setKeywords(''))} />}
          </label>
          <PromptCard
            positive={{ value: prompt, onChange: writePos }}
            negative={neg ? { value: negValue, onChange: writeNeg } : undefined}
            negativeMode={negMode}
            onMode={setNegative}
            tiles={tiles.tiles}
            onClear={(isNeg) => (isNeg ? writeNeg('') : writePos(''))}
            onSaveAsSnippet={(text) => useTileEdit.getState().edit('new', text)}
            tools={<>
              <Chip small={!phone} on={shared} onClick={() => edit(() => setUseShared(!shared))} title={shared ? 'Shared prompt' : 'Own prompt'}>{shared ? 'Shared' : 'Own'}</Chip>
              <Button tone="card" size={size} icon={<IconArrowDown size={13} />} disabled={negMode ? !imageNegative.trim() : !imagePrompt.trim()}
                tooltip={negMode ? 'Copy the Image step\'s negative here' : 'Copy the Image step\'s prompt here'}
                onClick={() => (negMode ? writeNeg(imageNegative) : writePos(imagePrompt))}>{phone ? 'From Image' : 'From the Image step'}</Button>
            </>}
          />
          {negMode
            ? <NegativePills tiles={tiles.tiles} on={tiles.negOn} onToggle={tiles.toggle} />
            : <TileGrid tiles={tiles.tiles} on={tiles.posOn} typed={tiles.typed} onToggle={tiles.toggle} />}
        </>
      )}
      {others.length > 0 && (
        <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '2px 12px' }}>
          {others.map((r) => (
            <StringField key={r.p.id} p={r.p} label={r.label === 'Text' && r.group !== 'Text' ? r.group : r.label} sub={r.sub} hintText={r.hintText} value={r.p.id in values ? values[r.p.id] : r.p.value}
              onChange={(v) => edit(() => setValue(r.p.id, v))} onReset={() => resetValue(r.p.id)} rows={3} />
          ))}
        </div>
      )}
      <SnippetHost />
    </>
  );
}
