/**
 * One provider's page inside Settings (desktop: replaces the pane, with ‹ Back; phone: a full
 * page under the phone's bar). Every field is visible; Model, Vision model and Base URL stay
 * disabled until the key passed a Test (Local: until its server answered). The key is a
 * SecretInput with Test beside it and the result inline. Remove at the bottom (not for Local).
 * Local has "Where it runs" (Home PC / This pod / Custom URL) instead of a key.
 */
import { useEffect, useState } from 'react';
import { TextInput } from '@mantine/core';
import { useStore } from '@/lib/store';
import { LOCAL_LLM_DEFAULT_BASE_URL, podLlmUrl } from '@/lib/storage';
import { ollamaRoot } from '@/lib/localLlm';
import { providerEntry, providerSpec, visionModels, type AiProviderEntry, type AiProviderId } from '@/lib/aiProviders';
import { fetchKey, useAiModels, useProviderModels } from '@/features/ai/aiModelsStore';
import { Chip, Row } from '~/ui';
import type { SettingDef } from '../categories';
import { ctlStyle, inputStyles, monoInputStyles } from '../inputs';
import { SecretInput } from '../SecretInput';
import { RowGroup, SettingRow } from '../SettingRow';
import { ModelSelect } from './ModelSelect';

const Noop = () => <></>;
const def = (id: string, label: string, hint: string, extra: Partial<SettingDef> = {}): SettingDef => ({ id, category: 'ai', label, hint, Control: Noop, ...extra });

const KEY_DEF = def('ai.p.key', 'API key', 'Stays in this browser; calls go straight from this tab to the provider.', { wide: true });
const WHERE_DEF = def('ai.p.where', 'Where it runs', 'Home PC = the Ollama behind llm.blueoceanswim.com; This pod = the Ollama the pod starts itself.', { wide: true });
const MODEL_DEF = def('ai.p.model', 'Model', 'The chat model every helper uses: Write it, Improve, suggestions, prompt sets.');
const VISION_DEF = def('ai.p.vision', 'Vision model', 'For the image helpers: tagging, describe, prompt from a picture, motion from a frame.');
const URL_DEF = def('ai.p.url', 'Base URL', 'Advanced. The API root; a proxy or a compatible server of yours goes here.');
const LOCAL_URL_DEF = def('ai.p.url', 'Server URL', 'The Ollama root, no /v1. Pick Custom URL above to change it.');

const locked = (d: SettingDef, why: string): SettingDef => ({ ...d, hint: `${d.hint} ${why}` });

/** Where Local's address points: a known place, or a custom one. */
function knownPlaces() {
  const pod = podLlmUrl();
  return [{ label: 'Home PC', url: LOCAL_LLM_DEFAULT_BASE_URL }, ...(pod ? [{ label: 'This pod', url: pod }] : [])];
}
const isKnown = (url: string) => knownPlaces().some((p) => ollamaRoot(p.url) === ollamaRoot(url));

function Result({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return <div role="status" style={{ fontSize: 11, fontWeight: 700, color: ok ? 'var(--il-ok)' : 'var(--il-err)', lineHeight: 1.45, marginTop: 2 }}>{text}</div>;
}

function TestButton({ onClick, disabled, loading, label = 'Test' }: { onClick: () => void; disabled?: boolean; loading?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading}
      style={{ height: 36, padding: '0 14px', flex: 'none', border: 0, borderRadius: 999, background: disabled ? 'var(--il-elev)' : 'var(--il-ember)', color: disabled ? 'var(--il-dim)' : 'var(--il-bg)', fontSize: 12, fontWeight: 800, cursor: disabled || loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
      {loading ? 'Testing…' : label}
    </button>
  );
}

/** The Test flow shared by the key row and Local's Check: run, remember the outcome, mark tested.
 *  A result belongs to the key + URL it was made with; typing a new key clears it. */
function useTest(entry: AiProviderEntry) {
  const test = useAiModels((s) => s.test);
  const setAiProvider = useStore((s) => s.setAiProvider);
  const [result, setResult] = useState<{ ok: boolean; message: string; key: string } | null>(null);
  const key = fetchKey(entry);
  const run = async () => {
    const r = await test(entry);
    setResult({ ...r, key });
    if (r.ok) setAiProvider(entry.id, { tested: true });
  };
  return { run, result: result && result.key === key ? result : null };
}

function KeyRow({ entry }: { entry: AiProviderEntry }) {
  const spec = providerSpec(entry.id);
  const setAiProvider = useStore((s) => s.setAiProvider);
  const { loading, error, summary } = useProviderModels(entry);
  const { run, result } = useTest(entry);
  const shown = result ?? (entry.tested ? (error ? { ok: false, message: error } : summary ? { ok: true, message: summary } : null) : null);
  const d = { ...KEY_DEF, hint: `Stays in this browser.`, ...(spec.keyUrl ? { links: [{ text: `Get one at ${new URL(spec.keyUrl).host}`, href: spec.keyUrl }] } : {}) };
  return (
    <SettingRow def={d} first control={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
          <SecretInput value={entry.apiKey} onChange={(e) => setAiProvider(entry.id, { apiKey: e.currentTarget.value })} placeholder={spec.keyPlaceholder ?? 'API key'}
            aria-label={`${spec.name} API key`} size="sm" styles={inputStyles} style={{ flex: 1, minWidth: 0 }} />
          <TestButton onClick={() => void run()} disabled={!entry.apiKey.trim()} loading={loading} />
        </div>
        {shown ? <Result text={shown.message} ok={shown.ok} /> : entry.apiKey.trim() && !entry.tested ? <Result text="Not tested yet — Test unlocks the model pickers." ok={false} /> : null}
      </div>
    } />
  );
}

function WhereRow({ entry, custom, onCustom }: { entry: AiProviderEntry; custom: boolean; onCustom: (on: boolean) => void }) {
  const setAiProvider = useStore((s) => s.setAiProvider);
  const { loading, error, summary } = useProviderModels(entry);
  const { run, result } = useTest(entry);
  const here = ollamaRoot(entry.baseUrl);
  const shown = result ?? (error ? { ok: false, message: error } : summary ? { ok: true, message: summary } : null);
  return (
    <SettingRow def={WHERE_DEF} first control={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
          <Row wrap style={{ flex: 1 }}>
            {knownPlaces().map((p) => <Chip key={p.url} small on={!custom && ollamaRoot(p.url) === here} title={p.url} onClick={() => { onCustom(false); setAiProvider('local', { baseUrl: p.url }); }}>{p.label}</Chip>)}
            <Chip small on={custom} title="Ollama address" onClick={() => onCustom(true)}>Custom URL</Chip>
          </Row>
          <TestButton onClick={() => void run()} disabled={!entry.baseUrl.trim()} loading={loading} label="Check" />
        </div>
        {shown ? <Result text={shown.message} ok={shown.ok} /> : loading ? <Result text="Checking…" ok /> : null}
      </div>
    } />
  );
}

export function ProviderPage({ id, onBack, header = true }: { id: AiProviderId; onBack: () => void; header?: boolean }) {
  const entry = useStore((s) => providerEntry(s.ai, id));
  const active = useStore((s) => s.ai.active);
  const setAiProvider = useStore((s) => s.setAiProvider);
  const removeAiProvider = useStore((s) => s.removeAiProvider);
  const spec = providerSpec(id);
  const local = id === 'local';
  const slot = useProviderModels(entry);
  const [custom, setCustom] = useState(() => !!entry && local && !isKnown(entry.baseUrl));
  // Local's server answering is its Test: an answer for the current URL marks it tested.
  useEffect(() => {
    if (local && entry && !entry.tested && slot.key === fetchKey(entry) && !slot.loading && !slot.error && slot.summary) setAiProvider('local', { tested: true });
  }, [local, entry, slot.key, slot.loading, slot.error, slot.summary, setAiProvider]);
  if (!entry) return null;

  const ready = entry.tested && (local || !!entry.apiKey.trim());
  const why = local ? 'Waits for the server to answer.' : 'Enter a key and Test first.';
  const vision = visionModels(slot.models);
  const urlEditable = local ? custom : ready;
  const visionDef = !ready ? locked(VISION_DEF, why) : spec.vision ? VISION_DEF : { ...VISION_DEF, hint: `${spec.name} cannot read images.` };

  return (
    <div>
      {header && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 14px' }}>
          <button type="button" onClick={onBack} aria-label="Back to AI helper"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px 0 6px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-ember)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>‹</span>Back
          </button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.2px', flex: 1, minWidth: 0 }}>{spec.name}</h2>
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', padding: '0 0 10px', lineHeight: 1.45 }}>{spec.note}</div>

      <RowGroup title={local ? 'Server' : 'Access'}>
        {local ? <WhereRow entry={entry} custom={custom} onCustom={setCustom} /> : <KeyRow entry={entry} />}
      </RowGroup>

      <RowGroup title="Models">
        <SettingRow def={ready ? MODEL_DEF : locked(MODEL_DEF, why)} first disabled={!ready} control={
          <ModelSelect models={slot.models} value={entry.model} disabled={!ready} placeholder={slot.loading ? 'Loading…' : 'Pick a model'} label={`${spec.name} model`}
            onChange={(model) => setAiProvider(id, { model })} />
        } />
        <SettingRow def={visionDef} disabled={!ready || !spec.vision} control={
          <ModelSelect sameAs models={vision} value={entry.visionModel} disabled={!ready || !spec.vision} placeholder="Same as model" label={`${spec.name} vision model`}
            onChange={(visionModel) => setAiProvider(id, { visionModel })} />
        } />
      </RowGroup>

      <RowGroup title="Advanced">
        <SettingRow def={local ? LOCAL_URL_DEF : ready ? URL_DEF : locked(URL_DEF, why)} first disabled={!urlEditable} control={
          <TextInput value={entry.baseUrl} onChange={(e) => setAiProvider(id, { baseUrl: e.currentTarget.value })} placeholder={spec.baseUrl} disabled={!urlEditable}
            aria-label={`${spec.name} base URL`} size="sm" spellCheck={false} autoCapitalize="off" autoComplete="off" styles={monoInputStyles} style={ctlStyle} />
        } />
        {local && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', padding: '8px 0 0', lineHeight: 1.45 }}>
            Download, delete and browse models (Hugging Face GGUF) in the <a href="../" style={{ color: 'var(--il-ember)', fontWeight: 700, textDecoration: 'none' }}>classic UI</a>, Settings → AI → Local LLM.
          </div>
        )}
      </RowGroup>

      {!local && (
        <div style={{ paddingTop: 6 }}>
          <button type="button" onClick={() => { removeAiProvider(id); onBack(); }}
            style={{ height: 32, padding: '0 12px', border: '1px solid var(--il-line-strong)', borderRadius: 999, background: 'transparent', color: 'var(--il-err)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            Remove {spec.name}
          </button>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', marginTop: 6 }}>Forgets its key and models here.{active === id ? ' Local becomes the active provider.' : ''}</div>
        </div>
      )}
    </div>
  );
}
