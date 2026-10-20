/**
 * "✦ Write it": the LLM writes the prompt (the main app's `generateLayerSet` through
 * `lib/ai`), from an idea or from the current prompt, and replaces every positive layer with
 * the set it returns, with Undo. The model picker is the main app's `AiModelPicker`.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { compileLayers } from '@/lib/prompt';
import { aiNotReadyHint, aiReady, generateLayerSet, type GenerateLayerSource } from '@/lib/ai';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import { Tabs } from '~/ui';
import { T } from '~/theme/tokens';

export function WriteItModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const ai = useStore((s) => s.ai);
  const current = useStore((s) => compileLayers(s.layers, 'positive'));
  const [source, setSource] = useState<GenerateLayerSource>('idea');
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { if (!opened) abort.current?.abort(); }, [opened]);
  const ready = aiReady(ai);
  const canRun = ready && !busy && (source === 'idea' ? idea.trim().length > 0 : current.trim().length > 0);

  const run = async () => {
    if (!canRun) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true); setError(null);
    try {
      const items = await generateLayerSet({ seed: source === 'idea' ? idea : current, source, settings: ai, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      if (!items.length) { setError('The AI returned nothing usable — try rephrasing.'); return; }
      const st = useStore.getState();
      const before = st.layers;
      st.replaceLayers('positive', items);
      const id = `write-it-${Date.now()}`;
      notifications.show({ id, color: 'teal', autoClose: 3000, title: 'Prompt written', message: <Button size="compact-xs" variant="light" mt={4} onClick={() => { useStore.getState().setPromptLayers(before); notifications.hide(id); }}>Undo</Button> });
      onClose();
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Generation failed');
    } finally { if (!ctrl.signal.aborted) setBusy(false); }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Write it" size="sm" centered zIndex={T.z.modal}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Tabs<GenerateLayerSource> items={[{ key: 'idea', label: 'From an idea' }, { key: 'prompt', label: 'From the prompt', title: current.trim() ? undefined : 'The prompt is empty' }]} value={source} onChange={setSource} />
        {source === 'idea' ? (
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="cyberpunk sphinx at dusk, neon rain…" rows={4} autoFocus aria-label="Your idea"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void run(); }}
            style={{ width: '100%', border: 0, borderRadius: 14, background: 'var(--il-card)', color: 'var(--il-fg)', fontSize: 14, lineHeight: 1.5, padding: '10px 12px', resize: 'none', outline: 'none' }} />
        ) : (
          <div style={{ maxHeight: 120, overflow: 'auto', borderRadius: 14, background: 'var(--il-card)', color: 'var(--il-fg2)', fontSize: 12, lineHeight: 1.5, padding: '10px 12px', whiteSpace: 'pre-wrap' }}>{current || '(empty)'}</div>
        )}
        <AiModelPicker size="xs" />
        <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>{ready ? 'Replaces the prompt with a fresh set of parts: subject, setting, light, style. The negative stays.' : `${aiNotReadyHint(ai)} to write prompts.`}</div>
        {error && <div style={{ fontSize: 12, color: 'var(--il-err)' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button type="button" onClick={onClose} style={{ height: 34, padding: '0 14px', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={() => void run()} disabled={!canRun} style={{ height: 34, padding: '0 16px', border: 0, borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-bg)', fontWeight: 800, fontSize: 12, cursor: canRun ? 'pointer' : 'default', opacity: canRun ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {busy ? <Loader size={12} color="dark" /> : '✦'} {busy ? 'Writing…' : 'Write'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
