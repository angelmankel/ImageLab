/**
 * Item 11: "✦ Write it" — the LLM writes the prompt (`generateLayerSet` through `lib/ai`), from an
 * idea or from the current prompt, and replaces the positive prompt with it (Undo, 3 s). Clean
 * by default: the source, the box, the model, Write. The cog opens the advanced part: the system
 * prompt (see / edit / back to stock) and the LLM parameters of the selected provider — a
 * data-driven list per provider (`@/lib/aiParams`), unset values use the provider's default.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Button as MButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconRestore, IconSettings, IconSparkles, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { compileLayers } from '@/lib/prompt';
import { aiNotReadyHint, aiReady, generateLayerSet, layerSetSystemPrompt, type GenerateLayerSource } from '@/lib/ai';
import { activeEntry, providerSpec } from '@/lib/aiProviders';
import { paramBody, providerParams } from '@/lib/aiParams';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, SliderRow, Tabs, Spinner } from '~/ui';
import { T } from '~/theme/tokens';
import { useWriteIt } from './writeIt/writeItStore';
import { dvh } from '~/theme/uiScale';

const area: React.CSSProperties = { width: '100%', border: '1px solid var(--il-line-soft)', borderRadius: 14, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', fontSize: 14, lineHeight: 1.5, padding: '12px 14px', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--il-muted)' };

function Advanced({ source }: { source: GenerateLayerSource }) {
  const ai = useStore((s) => s.ai);
  const provider = activeEntry(ai).id;
  const stock = layerSetSystemPrompt(source, ai.promptStyle);
  const custom = useWriteIt((s) => s.system[source]);
  const setSystem = useWriteIt((s) => s.setSystem);
  const values = useWriteIt((s) => s.params[provider]);
  const setParam = useWriteIt((s) => s.setParam);
  const resetParams = useWriteIt((s) => s.resetParams);
  const specs = providerParams(provider);
  const anySet = !!values && Object.keys(values).length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 12, borderTop: '1px solid var(--il-line-soft)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={eyebrow}>System prompt</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: custom?.trim() ? 'var(--il-ember-hi)' : 'var(--il-dim)' }}>{custom?.trim() ? 'yours' : 'stock'}</span>
          <div style={{ flex: 1 }} />
          {custom?.trim() && <Button tone="ghost" size="sm" icon={<IconRestore size={13} />} onClick={() => setSystem(source, '')}>Back to stock</Button>}
        </div>
        <textarea aria-label="System prompt" rows={7} value={custom?.trim() ? custom : stock} onChange={(e) => setSystem(source, e.target.value === stock ? '' : e.target.value)}
          style={{ ...area, fontSize: 12, lineHeight: 1.55, color: 'var(--il-fg2)', resize: 'vertical' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-dim)' }}>
          The answer must stay one "Tag: phrase, phrase" line per part — that is how it is read back.
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={eyebrow}>Parameters · {providerSpec(provider).name}</span>
          <div style={{ flex: 1 }} />
          {anySet && <Button tone="ghost" size="sm" icon={<IconRestore size={13} />} onClick={() => resetParams(provider)}>All to default</Button>}
        </div>
        {specs.map((p) => {
          const v = values?.[p.id];
          const set = typeof v === 'number';
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SliderRow
                  label={set ? p.label : `${p.label} · default`}
                  value={set ? v : p.default}
                  min={p.min} max={p.max} step={p.step}
                  hint={p.hint}
                  format={(n) => (p.int ? String(Math.round(n)) : String(Number(n.toFixed(2))))}
                  onChange={(n) => setParam(provider, p.id, n)}
                />
              </div>
              <span style={{ width: 30, flex: 'none' }}>
                {set && <Button tone="ghost" size="sm" icon={<IconRestore size={13} />} tooltip={`${p.label}: back to the provider's default`} onClick={() => setParam(provider, p.id, undefined)} />}
              </span>
            </div>
          );
        })}
        {!specs.length && <span style={{ fontSize: 12, color: 'var(--il-dim)' }}>This provider takes no extra parameters.</span>}
      </div>
    </div>
  );
}

export function WriteItModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const phone = useIsPhone();
  const ai = useStore((s) => s.ai);
  const current = useStore((s) => compileLayers(s.layers, 'positive'));
  const advanced = useWriteIt((s) => s.advanced);
  const setAdvanced = useWriteIt((s) => s.setAdvanced);
  const [source, setSource] = useState<GenerateLayerSource>('idea');
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { if (!opened) { abort.current?.abort(); setBusy(false); } }, [opened]);
  const ready = aiReady(ai);
  const canRun = ready && !busy && (source === 'idea' ? idea.trim().length > 0 : current.trim().length > 0);
  const provider = activeEntry(ai).id;

  const run = async () => {
    if (!canRun) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true); setError(null);
    try {
      const w = useWriteIt.getState();
      const items = await generateLayerSet({
        seed: source === 'idea' ? idea : current, source, settings: ai, signal: ctrl.signal,
        systemPrompt: w.system[source], params: paramBody(provider, w.params[provider] ?? {}),
      });
      if (ctrl.signal.aborted) return;
      if (!items.length) { setError('The AI returned nothing usable — try rephrasing.'); return; }
      const st = useStore.getState();
      const before = st.layers;
      st.replaceLayers('positive', items);
      const id = `write-it-${Date.now()}`;
      notifications.show({ id, color: 'teal', autoClose: 3000, title: 'Prompt written', message: <MButton size="compact-xs" variant="light" mt={4} onClick={() => { useStore.getState().setPromptLayers(before); notifications.hide(id); }}>Undo</MButton> });
      onClose();
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Generation failed');
    } finally { if (!ctrl.signal.aborted) setBusy(false); }
  };

  const size = phone ? 'lg' : 'md';
  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} centered size={advanced ? 640 : 520} fullScreen={phone} zIndex={T.z.modal} radius={phone ? 0 : T.radius.xl} padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }} transitionProps={{ transition: 'pop', duration: 140 }}
      styles={{ content: { background: 'var(--il-panel)', border: phone ? 0 : '1px solid var(--il-line-soft)' } }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: phone ? '12px 14px 16px' : '16px 18px 18px', minHeight: phone ? dvh(100) : undefined, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)' }}><IconSparkles size={17} stroke={2.2} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Write it</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>A fresh prompt — subject, setting, light, style. The negative stays.</div>
          </div>
          <Button tone="ghost" size={phone ? 'lg' : 'sm'} on={advanced} icon={<IconSettings size={16} stroke={2.2} />} tooltip={advanced ? 'Hide the advanced settings' : 'Advanced: system prompt and parameters'} onClick={() => setAdvanced(!advanced)} />
          <Button tone="ghost" size={phone ? 'lg' : 'sm'} icon={<IconX size={16} stroke={2.4} />} tooltip="Close" onClick={onClose} />
        </div>

        <Tabs<GenerateLayerSource> items={[{ key: 'idea', label: 'From an idea' }, { key: 'prompt', label: 'From the prompt', title: current.trim() ? undefined : 'The prompt is empty' }]} value={source} onChange={setSource} />
        {source === 'idea' ? (
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="cyberpunk sphinx at dusk, neon rain…" rows={phone ? 5 : 4} autoFocus aria-label="Your idea"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void run(); } }} style={area} />
        ) : (
          <div className="il-scroll" style={{ ...area, maxHeight: 140, overflow: 'auto', color: current.trim() ? 'var(--il-fg2)' : 'var(--il-dim)', fontSize: 13, whiteSpace: 'pre-wrap' }}>{current || 'The prompt is empty.'}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={eyebrow}>Model</span>
          <div style={{ flex: 1, minWidth: 0 }}><AiModelPicker size="xs" /></div>
        </div>
        {!ready && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-warn)' }}>{aiNotReadyHint(ai)} to write prompts.</div>}
        {error && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-err)' }}>{error}</div>}

        {advanced && <Advanced source={source} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: phone ? 'auto' : 0 }}>
          {!phone && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-dim)' }}>Ctrl+Enter</span>}
          <div style={{ flex: 1 }} />
          <Button tone="card" size={size} onClick={onClose}>Cancel</Button>
          <Button tone="primary" size={size} disabled={!canRun} onClick={() => void run()} icon={busy ? <Spinner size={12} color="var(--il-bg)" /> : <IconSparkles size={15} stroke={2.2} />}>{busy ? 'Writing…' : 'Write'}</Button>
        </div>
      </div>
    </Modal>
  );
}
