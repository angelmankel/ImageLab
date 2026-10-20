/**
 * The Input tab: the Image step's output size first (aspect + longest side, `settings/SizeControl`;
 * moved here from Settings, Donny 10-20), then the input image for img2img / inpaint. Steps 2+: the
 * Off · Auto · Pick card (`ChainInputCard`: the previous step's last or a picked result); any step: drop / upload / paste, "From history" (the main
 * app's past-generations browser), Edit (the main app's editor: crop, rotate, filters, remove
 * background), Clear, and the Denoise slider. Logic from `features/inputImage` and the main
 * store's `workflow.inputImage`; the look is this file.
 */
import { useRef, useState } from 'react';
import { IconUpload, IconPhoto, IconBrush, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { fileToImageState, urlToImageState } from '@/features/inputImage/imageOps';
import { InputImageBrowserModal } from '@/features/inputImage/InputImageBrowserModal';
import { EditImageModal } from '@/features/inputImage/EditImageModal';
import { useSteps, chainModeOf, type Step } from '~/app/stepsStore';
import { SliderRow, Chip } from '~/ui';
import { ChainInputCard } from './ChainInputCard';
import { SizeControl } from './settings/SizeControl';

const SIZES = [768, 1024, 1280, 1536, 2048];

const smallBtn: React.CSSProperties = { height: 30, padding: '0 11px', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' };

export function InputTab({ step }: { step: Step; phone?: boolean }) {
  const steps = useSteps((s) => s.steps);
  const setStepInput = useSteps((s) => s.setStepInput);
  const first = steps[0]?.id === step.id;
  const inputImage = useStore((s) => s.workflow.inputImage);
  const inputDenoise = useStore((s) => s.workflow.inputDenoise);
  const inputMaxSize = useStore((s) => s.workflow.inputMaxSize);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const setStatus = useStore((s) => s.setStatus);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [editing, setEditing] = useState(false);

  // Step 1 edits the main workflow's input image; steps 2+ keep their own input on the step.
  const image = first ? inputImage : step.input ?? null;
  const load = async (read: () => Promise<{ dataUrl: string; name: string; width: number; height: number }>) => {
    setLoading(true);
    try {
      const state = await read();
      if (first) setWorkflow({ inputImage: state });
      else setStepInput(step.id, { url: state.dataUrl, name: state.name });
      setStatus(`Input image ${state.width}×${state.height}`, 'ok');
    } catch (e) { setStatus(`Could not load the image: ${e instanceof Error ? e.message : String(e)}`, 'error'); }
    finally { setLoading(false); }
  };
  const ingest = (file: File | null | undefined) => { if (file && file.type.startsWith('image/')) void load(() => fileToImageState(file)); };
  const onDrop = async (dt: DataTransfer | null) => {
    if (!dt) return;
    if (dt.files?.[0]) { ingest(dt.files[0]); return; }
    let url = ''; let name = 'image.png';
    try { const j = dt.getData('application/x-imagelab-image'); if (j) { const p = JSON.parse(j) as { url?: string; name?: string }; url = p.url ?? ''; name = p.name ?? name; } } catch { /* fall through */ }
    if (!url) url = dt.getData('text/uri-list').split('\n').find((s) => s.trim() && !s.startsWith('#'))?.trim() || dt.getData('text/plain').trim();
    if (/^(https?:|blob:|data:)/.test(url)) void load(() => urlToImageState(url, name));
  };
  const clear = () => (first ? setWorkflow({ inputImage: null }) : setStepInput(step.id, null));
  const chained = !first && chainModeOf(step) !== 'off';

  return (
    <>
      {step.kind === 'image' && <SizeControl />}
      {!first && <ChainInputCard step={step} />}
      {!chained && (
        <>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { ingest(e.target.files?.[0]); e.target.value = ''; }} />
          <div role="button" tabIndex={0} aria-label={image ? 'Input image' : 'Drop an image, click to upload, or paste'}
            onClick={() => { if (!image) fileRef.current?.click(); }}
            onKeyDown={(e) => { if (!image && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileRef.current?.click(); } }}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void onDrop(e.dataTransfer); }}
            onPaste={(e) => { const it = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/')); ingest(it?.getAsFile()); }}
            style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', maxHeight: 240, borderRadius: 16, overflow: 'hidden', background: 'var(--il-bg-deep)', border: `2px dashed ${dragging ? 'var(--il-ember)' : image ? 'transparent' : 'var(--il-line-strong)'}`, display: 'grid', placeItems: 'center', cursor: image ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {image ? (
              <img src={first ? (image as { dataUrl: string }).dataUrl : (image as { url: string }).url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--il-muted)', fontSize: 12, fontWeight: 600, padding: 12 }}>
                <IconUpload size={26} style={{ opacity: .6 }} /><div style={{ marginTop: 6 }}>Drop an image, click to upload, or paste</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={smallBtn} onClick={() => setBrowsing(true)}><IconPhoto size={13} />From history</button>
            <button type="button" style={smallBtn} onClick={() => fileRef.current?.click()}><IconUpload size={13} />{image ? 'Replace' : 'Upload'}</button>
            {image && first && inputImage && <button type="button" style={smallBtn} onClick={() => setEditing(true)}><IconBrush size={13} />Edit</button>}
            {image && <button type="button" style={{ ...smallBtn, color: 'var(--il-err)' }} onClick={clear}><IconX size={13} />Clear</button>}
            {image && first && inputImage && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{inputImage.width} × {inputImage.height}</span>}
          </div>
        </>
      )}
      {(image || chained) && first && (
        <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SliderRow label="Denoise" value={inputDenoise} min={0} max={1} step={0.01} onChange={(v) => setWorkflow({ inputDenoise: v })} presets={[0.35, 0.5, 0.65, 0.8]} format={(v) => v.toFixed(2)} hint="← keep the picture · change it more →" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', marginBottom: 6 }}>Longest side sent to the model</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{SIZES.map((n) => <Chip key={n} small on={inputMaxSize === n} onClick={() => setWorkflow({ inputMaxSize: n, inputMinSize: Math.min(useStore.getState().workflow.inputMinSize, n) })}>{n}</Chip>)}</div>
          </div>
        </div>
      )}
      {(image || chained) && !first && (
        <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: 10, fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>This step's own settings (denoise, size) come with its workflow.</div>
      )}
      <InputImageBrowserModal opened={browsing} onClose={() => setBrowsing(false)} onSelect={(url, name) => { setBrowsing(false); void load(() => urlToImageState(url, name)); }} />
      {editing && inputImage && <EditImageModal image={inputImage} onClose={() => setEditing(false)} />}
    </>
  );
}
