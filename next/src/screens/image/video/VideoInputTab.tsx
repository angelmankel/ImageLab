/**
 * The Video step's Input tab (rule 2): the start frame. The Off · Auto · Pick card
 * (`../ChainInputCard`: the previous step's last or a picked result, default Auto when a step
 * comes before; uploaded at Generate time), or a picture of your own (drop / upload / paste / from history → uploaded to the video
 * host as the `LoadImage` start image, the main app's send-to-video path); an optional end frame
 * (Wan first/last frame, H3 last frame); H3's reference pictures (up to 9). State: the main
 * app's `videoStore` (`startImage`, `endImage`, `h3.refImages`) and the step's `chained` flag.
 */
import { useRef, useState, type ReactNode } from 'react';
import { IconUpload, IconPhoto, IconX, IconPlus } from '@tabler/icons-react';
import { InputImageBrowserModal } from '@/features/inputImage/InputImageBrowserModal';
import { inputViewUrl } from '@/features/studio/ImageInput';
import { useModeHost } from '@/features/workspace/modeHost';
import { useVideo } from '@/features/video/videoStore';
import { useSteps, chainModeOf, type Step } from '~/app/stepsStore';
import { Chip } from '~/ui';
import { ChainInputCard } from '../ChainInputCard';
import { usePrevStepOutput } from '../useStepOutput';
import { setStartFrameFile, setStartFrameFrom, uploadToVideoHost, taskOf } from './videoChain';
import { card, muted, pillBtn } from './bits';

/** A picture slot: drop / click to upload / paste; shows the picture it holds. */
function PictureSlot({ url, label, onFile, onUrl, onClear, small = false, loading = false, children }: {
  url: string | null; label: string; onFile: (f: File) => void; onUrl: (url: string, name: string) => void; onClear?: () => void; small?: boolean; loading?: boolean; children?: ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const ingest = (f: File | null | undefined) => { if (f && f.type.startsWith('image/')) onFile(f); };
  const onDrop = (dt: DataTransfer | null) => {
    if (!dt) return;
    if (dt.files?.[0]) { ingest(dt.files[0]); return; }
    let u = ''; let name = 'image.png';
    try { const j = dt.getData('application/x-imagelab-image'); if (j) { const p = JSON.parse(j) as { url?: string; name?: string }; u = p.url ?? ''; name = p.name ?? name; } } catch { /* fall through */ }
    if (!u) u = dt.getData('text/uri-list').split('\n').find((s) => s.trim() && !s.startsWith('#'))?.trim() || dt.getData('text/plain').trim();
    if (/^(https?:|blob:|data:)/.test(u)) onUrl(u, name);
  };
  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { ingest(e.target.files?.[0]); e.target.value = ''; }} />
      <div role="button" tabIndex={0} aria-label={url ? label : `${label}: drop an image, click to upload, or paste`}
        onClick={() => { if (!url) fileRef.current?.click(); }}
        onKeyDown={(e) => { if (!url && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileRef.current?.click(); } }}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onDrop(e.dataTransfer); }}
        onPaste={(e) => { const it = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/')); ingest(it?.getAsFile()); }}
        style={{ position: 'relative', width: '100%', aspectRatio: small ? '16 / 7' : '4 / 3', maxHeight: small ? 120 : 240, borderRadius: 16, overflow: 'hidden', background: 'var(--il-bg-deep)', border: `2px dashed ${dragging ? 'var(--il-ember)' : url ? 'transparent' : 'var(--il-line-strong)'}`, display: 'grid', placeItems: 'center', cursor: url ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
        {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <div style={{ textAlign: 'center', color: 'var(--il-muted)', fontSize: 12, fontWeight: 600, padding: 12 }}><IconUpload size={small ? 18 : 26} style={{ opacity: .6 }} /><div style={{ marginTop: 4 }}>{label} — drop, click, or paste</div></div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={pillBtn} onClick={() => setBrowsing(true)}><IconPhoto size={13} />From history</button>
        <button type="button" style={pillBtn} onClick={() => fileRef.current?.click()}><IconUpload size={13} />{url ? 'Replace' : 'Upload'}</button>
        {url && onClear && <button type="button" style={{ ...pillBtn, color: 'var(--il-err)' }} onClick={onClear}><IconX size={13} />Clear</button>}
        {children}
      </div>
      <InputImageBrowserModal opened={browsing} onClose={() => setBrowsing(false)} onSelect={(u, name) => { setBrowsing(false); onUrl(u, name); }} />
    </>
  );
}

export function VideoInputTab({ step }: { step: Step; phone?: boolean }) {
  const steps = useSteps((s) => s.steps);
  const setChainMode = useSteps((s) => s.setChainMode);
  const first = steps[0]?.id === step.id;
  const prev = usePrevStepOutput(step);
  const prevIndex = steps.findIndex((s) => s.id === step.id) - 1;
  const v = useVideo();
  const host = useModeHost('video');
  const [busy, setBusy] = useState<string | null>(null);
  const task = taskOf(v);
  const h3 = v.engine === 'h3';
  const chained = !first && chainModeOf(step) !== 'off';
  const view = (ref: string) => (ref && host ? inputViewUrl(host, ref) : null);

  const ownStart = async (work: () => Promise<boolean>) => { setBusy('start'); try { if (await work()) setChainMode(step.id, 'off'); } finally { setBusy(null); } };
  const upload = async (what: 'end' | 'ref', src: Blob | string, name: string) => {
    setBusy(what);
    try {
      const ref = await uploadToVideoHost(src, name);
      if (!ref) return;
      if (what === 'end') v.set({ endImage: ref });
      else v.setH3({ refImages: [...v.h3.refImages.filter(Boolean), ref].slice(0, 9) });
    } finally { setBusy(null); }
  };

  if (task === 't2v') {
    return (
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Text → Video</div>
        <div style={muted}>This task starts from the prompt alone. Pick Image → Video in Settings to start from a picture{!first ? ' (the previous step\'s output, or one of yours)' : ''}.</div>
        <div><Chip onClick={() => (h3 ? v.setH3({ mode: 'i2v' }) : v.set({ mode: 'i2v' }))}>Switch to Image → Video</Chip></div>
      </div>
    );
  }

  if (task === 'ref') {
    const refs = v.h3.refImages.filter(Boolean);
    return (
      <>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Reference pictures <span style={muted}>{refs.length} / 9</span></div>
          <div style={muted}>H3 keeps these characters / objects; name them in the prompt as &lt;Picture 1&gt;, &lt;Picture 2&gt;…</div>
          {refs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
              {refs.map((r, i) => (
                <div key={r} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: 'var(--il-bg-deep)' }}>
                  <img src={view(r) ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', left: 6, bottom: 4, fontSize: 10, fontWeight: 800, color: 'var(--il-fg)', background: 'var(--il-dim)', borderRadius: 999, padding: '1px 6px' }}>{i + 1}</span>
                  <button type="button" aria-label={`Remove picture ${i + 1}`} onClick={() => v.setH3({ refImages: refs.filter((x) => x !== r) })}
                    style={{ position: 'absolute', right: 4, top: 4, width: 24, height: 24, border: 0, borderRadius: '50%', background: 'var(--il-dim)', color: 'var(--il-fg)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={12} stroke={2.6} /></button>
                </div>
              ))}
            </div>
          )}
          {refs.length < 9 && (
            <PictureSlot url={null} label="Add a picture" small loading={busy === 'ref'} onFile={(f) => void upload('ref', f, f.name)} onUrl={(u, n) => void upload('ref', u, n)}>
              {!first && prev && <button type="button" style={pillBtn} onClick={() => void upload('ref', prev.url, prev.name)}><IconPlus size={13} />Step {prevIndex + 1}'s output</button>}
            </PictureSlot>
          )}
        </div>
        <div style={card}>
          <div style={{ ...muted }}>Size: {v.h3.refImageSize === 'match' ? 'references match the video size' : 'references at their largest'}</div>
          <div style={{ display: 'flex', gap: 6 }}><Chip small on={v.h3.refImageSize === 'match'} onClick={() => v.setH3({ refImageSize: 'match' })}>Match</Chip><Chip small on={v.h3.refImageSize === 'max'} onClick={() => v.setH3({ refImageSize: 'max' })}>Max</Chip></div>
        </div>
      </>
    );
  }

  return (
    <>
      {!first && (
        <ChainInputCard step={step} thumb={56}>
          <div style={muted}>Uploaded to the video server at Generate time{h3 ? '; H3 stretches it to the video size, so the size follows the picture\'s shape.' : '; a portrait picture flips the size to portrait.'}</div>
        </ChainInputCard>
      )}
      {!chained && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{h3 ? 'First frame' : 'Start image'}</div>
          <PictureSlot url={view(v.startImage)} label={h3 ? 'First frame' : 'Start image'} loading={busy === 'start'}
            onFile={(f) => void ownStart(() => setStartFrameFile(f))} onUrl={(u, n) => void ownStart(() => setStartFrameFrom(u, n))} onClear={() => v.set({ startImage: '' })}>
            {!first && prev && <button type="button" style={pillBtn} onClick={() => void ownStart(() => setStartFrameFrom(prev.url, prev.name))}>Step {prevIndex + 1}'s output</button>}
          </PictureSlot>
          {v.startImage && !host && <div style={muted}>No video server: the picture cannot be shown.</div>}
        </div>
      )}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{h3 ? 'Last frame' : 'End image'} <span style={muted}>optional</span></div>
        <PictureSlot url={view(v.endImage)} label={h3 ? 'Last frame' : 'End image'} small loading={busy === 'end'}
          onFile={(f) => void upload('end', f, f.name)} onUrl={(u, n) => void upload('end', u, n)} onClear={() => v.set({ endImage: '' })} />
        <div style={muted}>With one, the clip travels from the first picture to this one{h3 ? ' (cover-cropped to the size)' : ' (first / last frame mode, the same I2V experts)'}.</div>
      </div>
    </>
  );
}
