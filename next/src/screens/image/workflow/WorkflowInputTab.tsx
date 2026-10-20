/**
 * The Workflow step's Input tab (rule 2: a step can take the previous step's output): the
 * workflow's LoadImage widget(s). The first one is THE input: the Off · Auto · Pick card
 * (`../ChainInputCard`: the previous step's last or a picked result; on Generate `startWorkflowStepRun` fetches that output, uploads it to the step's
 * host and sets it into the widget — the classic sendTo "Workflow" logic), or a picture of your
 * own: upload / From history (uploaded at once, the widget set to the server's name) / one already
 * on the server. More LoadImage nodes get a compact row each. No LoadImage: one line says so.
 */
import { useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import { loadImageRef, uploadImage } from '@/lib/comfy';
import { useStudio } from '@/features/studio/studioStore';
import { inputViewUrl } from '@/features/studio/ImageInput';
import type { WorkflowParam } from '@/features/studio/params';
import { InputImageBrowserModal } from '@/features/inputImage/InputImageBrowserModal';
import { useSteps, chainModeOf, type Step } from '~/app/stepsStore';
import { ChainInputCard } from '../ChainInputCard';
import { Pick } from './fields';
import { Hint } from './Hint';
import { WorkflowPicker } from './WorkflowPicker';
import { rememberUpload } from './stepRun';
import { markStepEdited, useWorkflowStepHost } from './useWorkflowStepHost';
import { fileLabel, isImageParam, uploadName } from './workflowStepLogic';

const NO_VALUES: Record<string, unknown> = {};
const smallBtn: React.CSSProperties = { height: 30, padding: '0 11px', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' };

/** Upload a file or a URL to the host and point the widget at it. */
function useUploader(host: string | null, step: Step, p: WorkflowParam, setAsStepInput: boolean) {
  const [busy, setBusy] = useState(false);
  const setValue = useStudio((s) => s.setValue);
  const setStepInput = useSteps((s) => s.setStepInput);
  const send = async (blob: Blob, name: string, sourceUrl?: string) => {
    if (!host) return;
    setBusy(true);
    try {
      const up = await uploadImage(host, blob, uploadName(name, Date.now()));
      const ref = loadImageRef(up);
      setValue(p.id, ref);
      markStepEdited(step.id);
      const url = inputViewUrl(host, ref) ?? '';
      rememberUpload(host, url, ref);
      if (sourceUrl) rememberUpload(host, sourceUrl, ref);
      if (setAsStepInput) setStepInput(step.id, { url, name });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Upload failed', message: err instanceof Error ? err.message : String(err) });
    } finally { setBusy(false); }
  };
  const file = (f: File | null | undefined) => { if (f && f.type.startsWith('image/')) void send(f, f.name); };
  const url = async (u: string, name: string) => {
    setBusy(true);
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await send(await res.blob(), name, u);
    } catch (err) {
      setBusy(false);
      notifications.show({ color: 'red', title: 'Could not fetch the picture', message: err instanceof Error ? err.message : String(err) });
    }
  };
  return { busy, file, url };
}

function Picture({ host, p, value, step, main }: { host: string | null; p: WorkflowParam; value: unknown; step: Step; main: boolean }) {
  const setValue = useStudio((s) => s.setValue);
  const up = useUploader(host, step, p, main);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cur = String(value ?? '');
  const preview = host ? inputViewUrl(host, cur) : null;
  const options = (p.options ?? []).map(String);
  const onDrop = (dt: DataTransfer) => {
    if (dt.files?.[0]) { up.file(dt.files[0]); return; }
    let u = ''; let name = 'image.png';
    try { const j = dt.getData('application/x-imagelab-image'); if (j) { const x = JSON.parse(j) as { url?: string; name?: string }; u = x.url ?? ''; name = x.name ?? name; } } catch { /* a plain url then */ }
    if (!u) u = dt.getData('text/uri-list').split('\n').find((s) => s.trim() && !s.startsWith('#'))?.trim() || dt.getData('text/plain').trim();
    if (/^(https?:|blob:|data:)/.test(u)) void up.url(u, name);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { up.file(e.target.files?.[0]); e.target.value = ''; }} />
      <div role="button" tabIndex={0} aria-label={cur ? `${fileLabel(cur)} — tap to replace` : 'Drop an image, tap to upload, or paste'}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onDrop(e.dataTransfer); }}
        onPaste={(e) => { const it = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/')); up.file(it?.getAsFile()); }}
        style={{ position: 'relative', width: '100%', aspectRatio: main ? '4 / 3' : '16 / 7', maxHeight: main ? 240 : 120, borderRadius: 16, overflow: 'hidden', background: 'var(--il-bg-deep)', border: `2px dashed ${dragging ? 'var(--il-ember)' : preview ? 'transparent' : 'var(--il-line-strong)'}`, display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: up.busy ? 0.6 : 1 }}>
        {preview
          ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <div style={{ textAlign: 'center', color: 'var(--il-muted)', fontSize: 12, fontWeight: 600, padding: 12 }}><IconUpload size={22} style={{ opacity: .6 }} /><div style={{ marginTop: 4 }}>{up.busy ? 'Uploading…' : 'Drop an image, tap to upload, or paste'}</div></div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={smallBtn} onClick={() => setBrowsing(true)}><IconPhoto size={13} />From history</button>
        <button type="button" style={smallBtn} onClick={() => fileRef.current?.click()}><IconUpload size={13} />{cur ? 'Replace' : 'Upload'}</button>
        {cur && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cur}>{fileLabel(cur)}</span>}
      </div>
      {options.length > 0 && (
        <Pick label="A picture already on the server" value={options.includes(cur) ? cur : ''} options={options} placeholder="…or one already on the server"
          onChange={(v) => { setValue(p.id, v); markStepEdited(step.id); }} />
      )}
      <InputImageBrowserModal opened={browsing} onClose={() => setBrowsing(false)} onSelect={(u, name) => { setBrowsing(false); void up.url(u, name); }} />
    </div>
  );
}

export function WorkflowInputTab({ step }: { step: Step }) {
  const { ref, host, open, loading } = useWorkflowStepHost(step);
  const steps = useSteps((s) => s.steps);
  const setStepInput = useSteps((s) => s.setStepInput);
  const params = useStudio((s) => s.params);
  const values = useStudio((s) => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const first = steps[0]?.id === step.id;
  const images = open ? params.filter(isImageParam) : [];
  const [main, ...more] = images;
  const chained = !first && chainModeOf(step) !== 'off';
  const valueOf = (p: WorkflowParam) => (p.id in values ? values[p.id] : p.value);

  return (
    <>
      {!ref && <WorkflowPicker step={step} />}
      {!ref && <Hint>Pick a workflow first.</Hint>}
      {loading && <Hint>Opening {ref?.name}…</Hint>}
      {open && !images.length && <Hint>This workflow takes no input picture.</Hint>}
      {main && (
        <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>{main.nodeLabel} <span style={{ color: 'var(--il-muted)', fontWeight: 600 }}>#{main.nodeId} · the input</span></div>
          {!first && <ChainInputCard step={step} bare note="— sent to the workflow on Generate" />}
          {!chained && (
            <>
              <Picture host={host} p={main} value={valueOf(main)} step={step} main />
              {step.input && (
                <button type="button" style={{ ...smallBtn, alignSelf: 'flex-start', color: 'var(--il-err)' }} onClick={() => setStepInput(step.id, null)} title="Forget the picture sent to this step (the workflow keeps the file it has)"><IconX size={13} />Clear sent picture</button>
              )}
            </>
          )}
        </div>
      )}
      {more.map((p) => (
        <div key={p.id} style={{ background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>{p.nodeLabel} <span style={{ color: 'var(--il-muted)', fontWeight: 600 }}>#{p.nodeId}</span></div>
          <Picture host={host} p={p} value={valueOf(p)} step={step} main={false} />
        </div>
      ))}
    </>
  );
}
