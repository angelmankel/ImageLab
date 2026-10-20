/**
 * The Input / Composition tab: the Image step's size (`settings/SizeControl`) and its input
 * picture; for a step 2+ (Refine, Upscale, Remove BG…) its input picture alone. The picture slot
 * is THE shared drop zone (`~/compose`, fix list 41): step 1 stores it in the main store's
 * `workflow.inputImage` (img2img), a step 2+ on the step (`step.input`) unless it follows the
 * step before it (My image · Last from N · Pick from N).
 */
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { blobToImageState } from '@/features/inputImage/imageOps';
import { EditImageModal } from '@/features/inputImage/EditImageModal';
import { useSteps, stepTitle, type Step } from '~/app/stepsStore';
import { SliderRow, Chip } from '~/ui';
import { ImageDropZone, StepImageInput, rememberOrigin, useOrigin } from '~/compose';
import { SizeControl } from './settings/SizeControl';

const SIZES = [768, 1024, 1280, 1536, 2048];

export function InputTab({ step }: { step: Step; phone?: boolean }) {
  const steps = useSteps((s) => s.steps);
  const setStepInput = useSteps((s) => s.setStepInput);
  const first = steps[0]?.id === step.id;
  const inputImage = useStore((s) => s.workflow.inputImage);
  const inputDenoise = useStore((s) => s.workflow.inputDenoise);
  const inputMaxSize = useStore((s) => s.workflow.inputMaxSize);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const [editing, setEditing] = useState(false);
  const slot = first ? 'image:1' : `step:${step.id}`;
  const url = first ? inputImage?.dataUrl ?? null : step.input?.url ?? null;
  const origin = useOrigin(slot, url);
  const label = stepTitle(steps, step.id);

  const zone = (
    <ImageDropZone
      url={url}
      name={first ? inputImage?.name : step.input?.name}
      dims={first && inputImage ? { width: inputImage.width, height: inputImage.height } : null}
      origin={origin}
      pasteAnywhere
      target={{ id: `input:${step.id}`, label: `Input of ${label}` }}
      onBlob={async ({ blob, name }, from) => {
        const st = await blobToImageState(blob, name);
        if (first) setWorkflow({ inputImage: st });
        else setStepInput(step.id, { url: st.dataUrl, name: st.name });
        rememberOrigin(slot, from, st.dataUrl);
      }}
      onClear={() => (first ? setWorkflow({ inputImage: null }) : setStepInput(step.id, null))}
      onEdit={first && inputImage ? () => setEditing(true) : undefined}
    />
  );

  return (
    <>
      {step.kind === 'image' && <SizeControl />}
      <StepImageInput step={step} own={zone} />
      {first && inputImage && (
        <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SliderRow label="Denoise" value={inputDenoise} min={0} max={1} step={0.01} onChange={(v) => setWorkflow({ inputDenoise: v })} presets={[0.35, 0.5, 0.65, 0.8]} format={(v) => v.toFixed(2)} hint="← keep the picture · change it more →" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', marginBottom: 6 }}>Longest side sent to the model</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{SIZES.map((n) => <Chip key={n} small on={inputMaxSize === n} onClick={() => setWorkflow({ inputMaxSize: n, inputMinSize: Math.min(useStore.getState().workflow.inputMinSize, n) })}>{n}</Chip>)}</div>
          </div>
        </div>
      )}
      {editing && inputImage && <EditImageModal image={inputImage} onClose={() => setEditing(false)} />}
    </>
  );
}
