/**
 * The Video step's Input tab: the start frame through THE shared drop zone (`~/compose`, fix list
 * 41) — My image · Last from N · Pick from N (a chained picture is uploaded at Generate time), or
 * a picture of your own (uploaded to the video host as the `LoadImage` start image, the main app's
 * send-to-video path); an optional end frame (Wan first/last frame, H3 last frame); H3's reference
 * pictures (up to 9). State: the main app's `videoStore` (`startImage`, `endImage`,
 * `h3.refImages`) and the step's chain mode.
 */
import { useState } from 'react';
import { IconX, IconPlus } from '@tabler/icons-react';
import { inputViewUrl } from '@/features/studio/ImageInput';
import { useModeHost } from '@/features/workspace/modeHost';
import { useVideo } from '@/features/video/videoStore';
import { useSteps, stepTitle, type Step } from '~/app/stepsStore';
import { Chip, Button } from '~/ui';
import { ImageDropZone, StepImageInput, rememberOrigin, useOrigin, type Origin } from '~/compose';
import { usePrevStepOutput } from '../useStepOutput';
import { setStartFrameFile, setStartFrameFrom, uploadToVideoHost, taskOf } from './videoChain';
import { card, muted } from './bits';

/** A blob as a File (the start-frame helper wants one). */
const asFile = (blob: Blob, name: string): File => (blob instanceof File ? blob : new File([blob], name || 'image.png', { type: blob.type || 'image/png' }));

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
  const view = (ref: string) => (ref && host ? inputViewUrl(host, ref) : null);

  const startOrigin = useOrigin('video:start', v.startImage);
  const endOrigin = useOrigin('video:end', v.endImage);
  const label = stepTitle(steps, step.id);
  const ownStart = async (work: () => Promise<boolean>, from: Origin) => {
    setBusy('start');
    try {
      if (await work()) { setChainMode(step.id, 'off'); rememberOrigin('video:start', from, useVideo.getState().startImage); }
    } finally { setBusy(null); }
  };
  const upload = async (what: 'end' | 'ref', src: Blob | string, name: string, from?: Origin) => {
    setBusy(what);
    try {
      const ref = await uploadToVideoHost(src, name);
      if (!ref) return;
      if (what === 'end') { v.set({ endImage: ref }); if (from) rememberOrigin('video:end', from, ref); }
      else v.setH3({ refImages: [...v.h3.refImages.filter(Boolean), ref].slice(0, 9) });
    } finally { setBusy(null); }
  };
  const prevBtn = (onClick: () => void) => (!first && prev ? <Button size="sm" icon={<IconPlus size={14} />} onClick={onClick}>Step {prevIndex + 1}'s output</Button> : null);

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
            <ImageDropZone url={null} small emptyTitle="Add a picture" busy={busy === 'ref'} target={{ id: `input:${step.id}:ref`, label: `Reference of ${label}` }}
              onBlob={({ blob, name }) => upload('ref', blob, name)} extra={prevBtn(() => void upload('ref', prev!.url, prev!.name))} />
          )}
        </div>
        <div style={card}>
          <div style={{ ...muted }}>Size: {v.h3.refImageSize === 'match' ? 'references match the video size' : 'references at their largest'}</div>
          <div style={{ display: 'flex', gap: 6 }}><Chip small on={v.h3.refImageSize === 'match'} onClick={() => v.setH3({ refImageSize: 'match' })}>Match</Chip><Chip small on={v.h3.refImageSize === 'max'} onClick={() => v.setH3({ refImageSize: 'max' })}>Max</Chip></div>
        </div>
      </>
    );
  }

  const startZone = (
    <>
      <ImageDropZone url={view(v.startImage)} name={v.startImage} origin={startOrigin} busy={busy === 'start'} pasteAnywhere
        target={{ id: `input:${step.id}`, label: `${h3 ? 'First frame' : 'Start image'} of ${label}` }}
        onBlob={({ blob, name }, from) => ownStart(() => setStartFrameFile(asFile(blob, name)), from)}
        onClear={() => v.set({ startImage: '' })}
        extra={prevBtn(() => void ownStart(() => setStartFrameFrom(prev!.url, prev!.name), 'step'))} />
      {v.startImage && !host && <div style={muted}>No video server: the picture cannot be shown.</div>}
    </>
  );

  return (
    <>
      <StepImageInput step={step} title={h3 ? 'First frame' : 'Start image'} own={startZone}>
        <div style={muted}>Uploaded to the video server at Generate time{h3 ? '; H3 stretches it to the video size, so the size follows the picture\'s shape.' : '; a portrait picture flips the size to portrait.'}</div>
      </StepImageInput>
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{h3 ? 'Last frame' : 'End image'} <span style={muted}>optional</span></div>
        <ImageDropZone url={view(v.endImage)} name={v.endImage} origin={endOrigin} small emptyTitle={h3 ? 'Add a last frame' : 'Add an end image'} busy={busy === 'end'}
          target={{ id: `input:${step.id}:end`, label: `${h3 ? 'Last frame' : 'End image'} of ${label}` }}
          onBlob={({ blob, name }, from) => upload('end', blob, name, from)} onClear={() => v.set({ endImage: '' })} />
        <div style={muted}>With one, the clip travels from the first picture to this one{h3 ? ' (cover-cropped to the size)' : ' (first / last frame mode, the same I2V experts)'}.</div>
      </div>
    </>
  );
}
