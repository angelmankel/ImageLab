/**
 * Rule 6 for the Video step: the motion prompt box bound to the main app's `videoStore`
 * (`positive`), ✦ Write it (the LLM writes a motion prompt: from an idea, from the prompt, or
 * from the start picture — `generateVideoPrompt` / `videoPromptFromImage` in `@/lib/venice`),
 * Clear, and the negative prompt folded (Wan; it acts above CFG 1 or with NAG).
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { aiNotReadyHint, aiReady, generateVideoPrompt, videoPromptFromImage, type GenerateLayerSource } from '@/lib/venice';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import { inputViewUrl } from '@/features/studio/ImageInput';
import { useModeHost } from '@/features/workspace/modeHost';
import { useVideo } from '@/features/video/videoStore';
import { WAN_NEGATIVE } from '@/lib/wanGraph';
import { chainModeOf, type Step } from '~/app/stepsStore';
import { Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { usePrevStepOutput } from '../useStepOutput';
import { muted } from './bits';

const COMMIT_MS = 250;
const btn = (accent: boolean): React.CSSProperties => ({ height: 34, padding: '0 12px', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: accent ? 'var(--il-ember-hi)' : 'var(--il-fg2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' });
const box: React.CSSProperties = { width: '100%', border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 15, lineHeight: 1.5, resize: 'none', outline: 'none', padding: 0, display: 'block' };

/** A box bound to one text field of the video store, committed on a short timer and on blur. */
function useVideoText(key: 'positive' | 'negative') {
  const value = useVideo((s) => s[key]);
  const [draft, setDraft] = useState(value);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current === null) return;
    const text = pending.current; pending.current = null;
    useVideo.getState().set({ [key]: text });
  };
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pending.current === null) setDraft(value); }, [value]);
  return {
    text: draft, flush,
    set: (text: string) => { setDraft(text); pending.current = text; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(flush, COMMIT_MS); },
    clear: () => { if (timer.current) clearTimeout(timer.current); pending.current = null; setDraft(''); useVideo.getState().set({ [key]: '' }); },
  };
}

type Source = GenerateLayerSource | 'picture';

function WriteItModal({ opened, onClose, step }: { opened: boolean; onClose: () => void; step: Step }) {
  const venice = useStore((s) => s.venice);
  const engine = useVideo((s) => s.engine);
  const current = useVideo((s) => s.positive);
  const startImage = useVideo((s) => s.startImage);
  const host = useModeHost('video');
  const prev = usePrevStepOutput(step);
  const chained = chainModeOf(step) !== 'off';
  const pictureUrl = chained ? prev?.url ?? null : startImage && host ? inputViewUrl(host, startImage) : null;
  const [source, setSource] = useState<Source>(pictureUrl ? 'picture' : 'idea');
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { if (!opened) abort.current?.abort(); }, [opened]);
  const ready = aiReady(venice);
  const canRun = ready && !busy && (source === 'idea' ? idea.trim().length > 0 : source === 'prompt' ? current.trim().length > 0 : !!pictureUrl);

  const run = async () => {
    if (!canRun) return;
    const ctrl = new AbortController(); abort.current = ctrl;
    setBusy(true); setError(null);
    try {
      const text = source === 'picture'
        ? await videoPromptFromImage(pictureUrl!, engine, venice, ctrl.signal, idea.trim())
        : await generateVideoPrompt({ seed: source === 'idea' ? idea : current, source, engine, settings: venice, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      if (!text.trim()) { setError('The AI returned nothing usable — try rephrasing.'); return; }
      const before = useVideo.getState().positive;
      useVideo.getState().set({ positive: text.trim() });
      const id = `write-video-${Date.now()}`;
      notifications.show({ id, color: 'teal', autoClose: 6000, title: 'Motion prompt written', message: <button type="button" onClick={() => { useVideo.getState().set({ positive: before }); notifications.hide(id); }} style={btn(false)}>Undo</button> });
      onClose();
    } catch (e) { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Generation failed'); }
    finally { if (!ctrl.signal.aborted) setBusy(false); }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Write it" size="sm" centered zIndex={T.z.modal}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Tabs<Source> items={[{ key: 'idea', label: 'From an idea' }, { key: 'prompt', label: 'From the prompt' }, { key: 'picture', label: 'From the picture', title: pictureUrl ? undefined : 'No start picture yet' }]} value={source} onChange={setSource} />
        {source === 'picture' && pictureUrl && <img src={pictureUrl} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 12, background: 'var(--il-bg-deep)' }} />}
        {source === 'prompt' ? (
          <div style={{ maxHeight: 120, overflow: 'auto', borderRadius: 14, background: 'var(--il-card)', color: 'var(--il-fg2)', fontSize: 12, lineHeight: 1.5, padding: '10px 12px', whiteSpace: 'pre-wrap' }}>{current || '(empty)'}</div>
        ) : (
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} autoFocus aria-label={source === 'picture' ? 'A hint (optional)' : 'Your idea'}
            placeholder={source === 'picture' ? 'optional: what should happen (slow dolly in, she turns and smiles…)' : 'a cat jumps off the sofa, slow motion, dust in the light…'}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void run(); }}
            style={{ width: '100%', border: 0, borderRadius: 14, background: 'var(--il-card)', color: 'var(--il-fg)', fontSize: 14, lineHeight: 1.5, padding: '10px 12px', resize: 'none', outline: 'none' }} />
        )}
        <AiModelPicker size="xs" />
        <div style={muted}>{ready ? (engine === 'h3' ? 'A motion prompt for MiniMax H3, with what to hear ("Audio: …").' : 'A motion prompt for Wan 2.2: camera, subject motion, light.') : `${aiNotReadyHint(venice)} to write prompts.`}</div>
        {error && <div style={{ fontSize: 12, color: 'var(--il-err)' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button type="button" onClick={onClose} style={btn(false)}>Cancel</button>
          <button type="button" onClick={() => void run()} disabled={!canRun} style={{ ...btn(false), background: 'var(--il-ember)', color: 'var(--il-bg)', fontWeight: 800, opacity: canRun ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {busy ? <Loader size={12} color="dark" /> : '✦'} {busy ? 'Writing…' : 'Write'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function VideoPromptTab({ step, large = false }: { step: Step; large?: boolean }) {
  const prompt = useVideoText('positive');
  const negative = useVideoText('negative');
  const engine = useVideo((s) => s.engine);
  const venice = useStore((s) => s.venice);
  const [writing, setWriting] = useState(false);
  const [negOpen, setNegOpen] = useState(false);
  const negShort = negative.text.trim() === WAN_NEGATIVE ? "Wan's own" : negative.text.trim() ? `${negative.text.trim().slice(0, 28)}${negative.text.trim().length > 28 ? '…' : ''}` : 'none';

  return (
    <>
      <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '10px 12px 10px' }}>
        <textarea aria-label="Motion prompt" rows={large ? 5 : 6} value={prompt.text} onChange={(e) => prompt.set(e.target.value)} onBlur={prompt.flush}
          placeholder={engine === 'h3' ? 'What happens, how the camera moves — and what to hear ("Audio: …").' : 'What happens, how the camera moves.'} style={box} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => { prompt.flush(); setWriting(true); }} style={btn(true)} title={aiReady(venice) ? 'Let the AI write the motion prompt' : 'Set up the AI helper in Settings to write prompts'}>✦ Write it</button>
          <div style={{ flex: 1 }} />
          <button type="button" aria-label="Clear prompt" onClick={prompt.clear} style={{ width: 34, height: 34, border: 0, borderRadius: '50%', background: 'var(--il-card-on)', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={14} stroke={2.4} /></button>
        </div>
      </div>
      <div style={muted}>{engine === 'h3' ? 'MiniMax H3 reads the prompt for picture and sound. Name reference pictures as <Picture 1>, <Picture 2>… in the Reference task.' : 'Wan 2.2 likes a plain description of the motion: who moves how, where the camera goes.'}</div>
      {engine === 'wan' && (
        <>
          <button type="button" onClick={() => setNegOpen((v) => !v)} aria-expanded={negOpen} style={{ display: 'flex', alignItems: 'center', width: '100%', height: 44, padding: '0 14px', border: 0, borderRadius: 14, background: 'var(--il-card)', color: 'var(--il-fg)', fontSize: 13, fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ flex: 1 }}>Negative prompt</span>
            <span style={{ color: 'var(--il-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>{negShort} {negOpen ? '⌄' : '›'}</span>
          </button>
          {negOpen && (
            <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: '10px 12px 10px' }}>
              <textarea aria-label="Negative prompt" rows={3} value={negative.text} onChange={(e) => negative.set(e.target.value)} onBlur={negative.flush} placeholder="static, blurry, extra fingers…" style={{ ...box, fontSize: 13 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={muted}>Acts above CFG 1 (Fast runs at 1) or with NAG on.</span>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={() => useVideo.getState().set({ negative: WAN_NEGATIVE })} style={{ ...btn(false), height: 30, fontSize: 11 }}>Wan's own</button>
                <button type="button" aria-label="Clear negative prompt" onClick={negative.clear} style={{ width: 30, height: 30, border: 0, borderRadius: '50%', background: 'var(--il-card-on)', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={13} stroke={2.4} /></button>
              </div>
            </div>
          )}
        </>
      )}
      <WriteItModal opened={writing} onClose={() => setWriting(false)} step={step} />
    </>
  );
}
