/**
 * The Composition tab (fix list 2, was "Input"), two different panels:
 *
 *   No input picture — composing a new frame: the aspect preview (the output's shape with its
 *   numbers in it, nothing else), Portrait / Square / Landscape, then the ratio, then the size:
 *   Model default (the model type's native pixel count) or Custom (W / H, ± 64); Smaller /
 *   Larger nudge from the default. Under it a small "Start from a picture" drop zone.
 *
 *   An input picture — changing that picture: the picture first (THE drop zone, item 41), "How
 *   much to change" (denoise, with named presets), then the output size in the picture's shape:
 *   Model default · Picture size · Custom (± 64 on the long side).
 *
 * A step 2+ (Refine, Upscale, Remove BG…) shows its input picture alone. Size maths:
 * `sizeLogic.ts` (tested); the choices: `sizeStore.ts`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { IconMinus, IconPlus } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { blobToImageState } from '@/features/inputImage/imageOps';
import { EditImageModal } from '@/features/inputImage/EditImageModal';
import { useSteps, stepTitle, type Step } from '~/app/stepsStore';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, SliderRow, Tip } from '~/ui';
import { T, btnRadius } from '~/theme/tokens';
import { ImageDropZone } from './ImageDropZone';
import { StepImageInput } from './StepImageInput';
import { Seg } from './Seg';
import { rememberOrigin, useOrigin } from './originStore';
import { useComposition, useNativeArea, type InputSizeMode, type SizeMode } from './sizeStore';
import {
  DEFAULT_RATIO, RATIOS, flipRatio, nearestRatio, orientOf, orientOfRatio, ratioById, reshape, scaleStep, scaledInput, sizeForArea, snapSide, stepSide, type Orient,
} from './sizeLogic';

const card: React.CSSProperties = { background: 'var(--il-card)', borderRadius: T.radius.lg, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 };
const title: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: 'var(--il-fg)' };
const fmt = (w: number, h: number) => `${w} × ${h}`;

/** The output's shape in a frame, the numbers on it. Only the numbers: no helper text. */
function AspectPreview({ w, h, height }: { w: number; h: number; height: number }) {
  const maxW = 0.62; const maxH = 0.8;
  const k = Math.min((maxW * 340) / w, (maxH * height) / h);
  return (
    <div style={{ height, borderRadius: T.radius.md, background: 'var(--il-bg-deep)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ width: Math.round(w * k), height: Math.round(h * k), maxWidth: '86%', border: '2px solid var(--il-ember)', borderRadius: 6, background: 'repeating-linear-gradient(45deg, rgba(240,134,58,.08) 0 8px, transparent 8px 16px)', transition: 'width .18s ease, height .18s ease' }} />
      <span aria-live="polite" style={{ position: 'absolute', padding: '3px 9px', borderRadius: 999, background: 'rgba(15,15,17,.78)', fontSize: 14, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(w, h)}</span>
    </div>
  );
}

const ORIENTS: Array<{ key: Orient; label: string; iw: number; ih: number }> = [
  { key: 'portrait', label: 'Portrait', iw: 12, ih: 18 },
  { key: 'square', label: 'Square', iw: 16, ih: 16 },
  { key: 'landscape', label: 'Landscape', iw: 18, ih: 12 },
];

function OrientPicker({ value, onPick }: { value: Orient; onPick: (o: Orient) => void }) {
  const phone = useIsPhone();
  return (
    <div role="radiogroup" aria-label="Shape" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
      {ORIENTS.map((o) => {
        const on = o.key === value;
        return (
          <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => onPick(o.key)}
            style={{ height: phone ? 60 : 56, minWidth: 0, border: 0, borderRadius: btnRadius(56), cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 800,
              background: on ? 'var(--il-ember-soft)' : 'var(--il-elev)', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg2)', boxShadow: on ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined }}>
            <span aria-hidden style={{ width: o.iw, height: o.ih, border: '2px solid currentColor', borderRadius: 3 }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RatioRow({ orient, value, onPick }: { orient: Orient; value: string | null; onPick: (id: string) => void }) {
  const phone = useIsPhone();
  if (orient === 'square') return null;
  return (
    <div role="radiogroup" aria-label="Ratio" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
      {RATIOS[orient].map((r) => {
        const on = r.id === value;
        return (
          <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => onPick(r.id)}
            style={{ height: phone ? 40 : 30, minWidth: 0, border: 0, borderRadius: btnRadius(30), cursor: 'pointer', fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              background: on ? 'var(--il-card-on)' : 'var(--il-elev)', color: on ? 'var(--il-fg)' : 'var(--il-fg2)', boxShadow: on ? 'inset 0 0 0 1px var(--il-line-strong)' : undefined }}>
            {r.id}
          </button>
        );
      })}
    </div>
  );
}

/** − [number] +: steps of 64, the box takes any number (snapped to 8). */
function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const phone = useIsPhone();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => { const v = snapSide(Number(draft)); setDraft(String(v)); if (v !== value) onChange(v); };
  const h = phone ? 44 : 38;
  const btn: React.CSSProperties = { width: h, height: h, flex: 'none', border: 0, background: 'transparent', color: 'var(--il-fg2)', display: 'grid', placeItems: 'center', cursor: 'pointer', borderRadius: btnRadius(h) };
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: h, borderRadius: btnRadius(h), background: 'var(--il-bg-deep)', minWidth: 0 }}>
      <button type="button" style={btn} aria-label={`${label} smaller`} onClick={() => onChange(stepSide(value, -1))}><IconMinus size={15} stroke={2.6} /></button>
      <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--il-muted)' }}>{label}</span>
        <input value={draft} inputMode="numeric" aria-label={label} onChange={(e) => setDraft(e.currentTarget.value.replace(/[^\d]/g, ''))} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
          style={{ width: '100%', minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: 'var(--il-fg)', textAlign: 'center', fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', padding: 0 }} />
      </label>
      <button type="button" style={btn} aria-label={`${label} larger`} onClick={() => onChange(stepSide(value, 1))}><IconPlus size={15} stroke={2.6} /></button>
    </div>
  );
}

const SIZE_MODES: Array<{ key: SizeMode; label: string; title: string }> = [
  { key: 'model', label: 'Model default', title: "The model's own pixel count, in this shape" },
  { key: 'custom', label: 'Custom', title: 'Width and height of your own' },
];

/** No input picture: shape, then size. */
function NewFrame() {
  const phone = useIsPhone();
  const width = useStore((s) => s.workflow.width);
  const height = useStore((s) => s.workflow.height);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const ratio = useComposition((s) => s.ratio);
  const sizeMode = useComposition((s) => s.sizeMode);
  const setRatio = useComposition((s) => s.setRatio);
  const setSizeMode = useComposition((s) => s.setSizeMode);
  const area = useNativeArea();
  const model = sizeMode === 'model';
  // Model default: the shape is the chosen ratio (the size follows it). Custom: the shape is the size's.
  const shown = model ? sizeForArea(area, ratioById(ratio).w, ratioById(ratio).h) : { width, height };
  const orient: Orient = model ? orientOfRatio(ratioById(ratio)) : orientOf(width, height);
  const near = nearestRatio(width, height);
  const litRatio = model ? ratio : Math.abs(Math.log((width / height) / (near.w / near.h))) < 0.02 ? near.id : null;

  const pickOrient = (o: Orient) => {
    if (model) { setRatio(orientOfRatio(ratioById(ratio)) === o ? ratio : o === 'square' ? '1:1' : orientOfRatio(ratioById(ratio)) === 'square' ? DEFAULT_RATIO[o] : flipRatio(ratio)); return; }
    const cur = orientOf(width, height);
    if (cur === o) return;
    if (o === 'square' || cur === 'square') { const r = ratioById(DEFAULT_RATIO[o]); setWorkflow(reshape(width, height, r)); setRatio(r.id); return; }
    setWorkflow({ width: height, height: width });
    setRatio(flipRatio(near.id));
  };
  const pickRatio = (id: string) => {
    setRatio(id);
    if (!model) setWorkflow(reshape(width, height, ratioById(id)));
  };
  const toMode = (m: SizeMode) => {
    if (m === 'model') setRatio(nearestRatio(width, height).id);
    setSizeMode(m);
  };
  const nudge = (dir: 1 | -1) => { setSizeMode('custom'); setWorkflow(scaleStep(shown.width, shown.height, dir)); };

  return (
    <>
      <div style={card}>
        <AspectPreview w={shown.width} h={shown.height} height={phone ? 150 : 176} />
        <OrientPicker value={orient} onPick={pickOrient} />
        <RatioRow orient={orient} value={litRatio} onPick={pickRatio} />
      </div>
      <div style={card}>
        <Tip hint="width"><div style={title}>Size</div></Tip>
        <Seg<SizeMode> label="Size" items={SIZE_MODES} value={sizeMode} onChange={toMode} />
        {model ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Button size={phone ? 'lg' : 'sm'} icon={<IconMinus size={14} />} onClick={() => nudge(-1)}>Smaller</Button>
            <Button size={phone ? 'lg' : 'sm'} caret={<IconPlus size={14} />} onClick={() => nudge(1)}>Larger</Button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stepper label="W" value={width} onChange={(w) => setWorkflow({ width: w })} />
            <Stepper label="H" value={height} onChange={(h) => setWorkflow({ height: h })} />
          </div>
        )}
      </div>
    </>
  );
}

const INPUT_SIZES: Array<{ key: InputSizeMode; label: string; title: string }> = [
  { key: 'model', label: 'Model default', title: "The model's own pixel count, in the picture's shape" },
  { key: 'picture', label: 'Picture size', title: "The picture's own size" },
  { key: 'custom', label: 'Custom', title: 'A long side of your own' },
];

const CHANGE: Array<{ key: string; label: string; v: number }> = [
  { key: 'subtle', label: 'Subtle', v: 0.35 }, { key: 'balanced', label: 'Balanced', v: 0.5 }, { key: 'strong', label: 'Strong', v: 0.65 }, { key: 'reimagine', label: 'Reimagine', v: 0.8 },
];

/** An input picture: how much to change it and the output size (its shape). */
function ChangePicture({ iw, ih }: { iw: number; ih: number }) {
  const phone = useIsPhone();
  const denoise = useStore((s) => s.workflow.inputDenoise);
  const maxSize = useStore((s) => s.workflow.inputMaxSize);
  const minSize = useStore((s) => s.workflow.inputMinSize);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const inputSize = useComposition((s) => s.inputSize);
  const setInputSize = useComposition((s) => s.setInputSize);
  const out = scaledInput(iw, ih, maxSize, minSize);
  const long = Math.max(out.width, out.height);
  const setLong = (l: number) => { setInputSize('custom'); setWorkflow({ inputMaxSize: l, inputMinSize: l }); };
  const preset = CHANGE.find((c) => Math.abs(c.v - denoise) < 0.005)?.key ?? null;
  return (
    <>
      <div style={card}>
        <Tip hint="denoise"><div style={{ minWidth: 0 }}>
          <SliderRow id="denoise" label="How much to change" value={denoise} min={0} max={1} step={0.01} onChange={(v) => setWorkflow({ inputDenoise: v })} format={(v) => v.toFixed(2)} />
        </div></Tip>
        <Seg label="How much to change" items={CHANGE} value={preset} onChange={(k) => setWorkflow({ inputDenoise: CHANGE.find((c) => c.key === k)!.v })} />
      </div>
      <div style={card}>
        <div style={title}>Output size</div>
        <AspectPreview w={out.width} h={out.height} height={phone ? 110 : 120} />
        <Seg<InputSizeMode> label="Output size" items={INPUT_SIZES} value={inputSize}
          onChange={(m) => { setInputSize(m); if (m === 'custom') setWorkflow({ inputMaxSize: long, inputMinSize: long }); }} />
        {inputSize === 'custom' && (
          <Stepper label="Long side" value={long} onChange={setLong} />
        )}
      </div>
    </>
  );
}

export function CompositionTab({ step }: { step: Step; phone?: boolean }) {
  const steps = useSteps((s) => s.steps);
  const setStepInput = useSteps((s) => s.setStepInput);
  const first = steps[0]?.id === step.id;
  const inputImage = useStore((s) => s.workflow.inputImage);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const [editing, setEditing] = useState(false);
  const slot = first ? 'image:1' : `step:${step.id}`;
  const url = first ? inputImage?.dataUrl ?? null : step.input?.url ?? null;
  const origin = useOrigin(slot, url);
  const label = stepTitle(steps, step.id);
  const isImage = step.kind === 'image' && first;
  const hasPicture = isImage && !!inputImage;

  const zone = (
    <ImageDropZone
      url={url}
      name={first ? inputImage?.name : step.input?.name}
      dims={first && inputImage ? { width: inputImage.width, height: inputImage.height } : null}
      origin={origin}
      small={isImage && !hasPicture}
      emptyTitle={isImage ? 'Drop a picture to start from' : undefined}
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

  let body: ReactNode;
  if (!isImage) body = <StepImageInput step={step} own={zone} />;
  else if (!hasPicture) body = <><NewFrame /><div style={card}><div style={title}>Start from a picture</div>{zone}</div></>;
  else body = <><div style={card}><div style={title}>Input image</div>{zone}</div><ChangePicture iw={inputImage!.width} ih={inputImage!.height} /></>;

  return (
    <>
      {body}
      {editing && inputImage && <EditImageModal image={inputImage} onClose={() => setEditing(false)} />}
    </>
  );
}
