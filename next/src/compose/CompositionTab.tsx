/**
 * The Composition tab (fix list 2 item 34, mockup agent-handoffs/fixlist2-mockups/34-composition.html):
 * the battle-tested layout (Midjourney / Leonardo / Krea / InvokeAI), one stable order:
 *
 *   New image | From image          the mode switch (New image = empty latent, From image = img2img)
 *   Input image                     From image only, always right under the switch (THE drop zone)
 *   How much to change              From image only (denoise + Subtle / Balanced / Strong / Reimagine)
 *   Size                            Portrait | Landscape + one even row of the unique ratios (1:1 4:5
 *                                   3:4 2:3 9:16, labels follow the orientation; From image adds
 *                                   "Picture" and a cell centre-crops the picture), the preview
 *                                   with a readable size chip, S / M (model default) / L / Custom —
 *                                   Custom opens Width / Height sliders with number boxes (+ ratio
 *                                   lock) — and the final size as one plain line.
 *
 * Going back to New image sets the picture aside (`inputShape.ts`); From image brings it back.
 * A step 2+ (Refine, Upscale, Remove BG…) shows its input picture alone. Size maths:
 * `sizeLogic.ts` (tested); the choices: `sizeStore.ts`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconLock, IconLockOpen } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { blobToImageState } from '@/features/inputImage/imageOps';
import { EditImageModal } from '@/features/inputImage/EditImageModal';
import { useSteps, stepTitle, type Step } from '~/app/stepsStore';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, SliderRow, Tip } from '~/ui';
import { T, btnRadius } from '~/theme/tokens';
import { dropToBlob, useRegisterDropTarget, type DropItem } from '~/dnd';
import { ImageDropZone } from './ImageDropZone';
import { usePaste } from './usePaste';
import { PasteNote } from './PasteButton';
import { originOfDrop, type Origin } from './inputLogic';
import { StepImageInput } from './StepImageInput';
import { Seg } from './Seg';
import { rememberOrigin, useOrigin } from './originStore';
import { useComposition, useNativeArea, type CompositionMode, type SizeMode } from './sizeStore';
import { originalOf, setCompositionMode, setInputShape, shapeOf, useInputShape, type Pic } from './inputShape';
import { defaultWorkflow } from '@/lib/storage';

/** Reset value of "How much to change" (item 8): the app's fresh img2img denoise. */
const DENOISE_DEFAULT = defaultWorkflow().inputDenoise;
import {
  SHAPES, cropRect, orientOf, orientOfRatio, type Orient, flipRatio, lockedPair, longForSide, megapixels, nearestRatio, presetArea, ratioById, reshape, scaledInput, sizeForArea, snap8, type SizePreset,
} from './sizeLogic';
import { useUndoableSetWorkflow } from '~/app/undoableWorkflow';

const card: React.CSSProperties = { background: 'var(--il-card)', borderRadius: T.radius.lg, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 };
const title: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: 'var(--il-fg)' };
const fmt = (w: number, h: number) => `${w} × ${h}`;
/** The size chip on a preview: solid panel colour + hairline, readable on any theme. */
const sizeChip: React.CSSProperties = {
  position: 'absolute', height: 26, padding: '0 10px', borderRadius: 999, background: 'var(--il-panel)', color: 'var(--il-fg)', boxShadow: '0 0 0 1px var(--il-line-strong)',
  fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', pointerEvents: 'none',
};

/* ---------- pieces ---------- */

function ModeSwitch({ value, onChange }: { value: CompositionMode; onChange: (m: CompositionMode) => void }) {
  const phone = useIsPhone();
  const h = phone ? 44 : 36;
  const items: Array<{ key: CompositionMode; label: string }> = [{ key: 'new', label: 'New image' }, { key: 'from', label: 'From image' }];
  return (
    <div role="radiogroup" aria-label="Start from" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: `calc(${btnRadius(h)} + 4px)`, background: 'var(--il-bg-deep)', flex: 'none' }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button key={it.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(it.key)}
            style={{ height: h, minWidth: 0, border: 0, borderRadius: btnRadius(h), cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
              background: on ? 'var(--il-card)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-fg2)', boxShadow: on ? 'inset 0 0 0 1px var(--il-line-strong)' : undefined }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** A ratio's little outline (longest side 17 px). */
function ShapeIcon({ w, h, dashed }: { w: number; h: number; dashed?: boolean }) {
  const k = 17 / Math.max(w, h);
  return <span aria-hidden style={{ width: Math.max(8, Math.round(w * k)), height: Math.max(8, Math.round(h * k)), border: `2px ${dashed ? 'dashed' : 'solid'} currentColor`, borderRadius: 3, flex: 'none' }} />;
}

/** Portrait | Landscape: two small icon segments (the ratio cells' labels follow it). */
function OrientSeg({ value, onChange, disabled }: { value: 'portrait' | 'landscape'; onChange: (o: 'portrait' | 'landscape') => void; disabled?: boolean }) {
  const phone = useIsPhone();
  const h = phone ? 40 : 28;
  const items = [{ key: 'portrait' as const, label: 'Portrait', w: 10, hh: 15 }, { key: 'landscape' as const, label: 'Landscape', w: 15, hh: 10 }];
  return (
    <div role="radiogroup" aria-label="Orientation" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: `calc(${btnRadius(h)} + 3px)`, background: 'var(--il-bg-deep)', flex: 'none' }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Tip key={it.key} label={it.label}>
            <button type="button" role="radio" aria-checked={on} aria-label={it.label} disabled={disabled} onClick={() => onChange(it.key)}
              style={{ width: phone ? 48 : 38, height: h, border: 0, borderRadius: btnRadius(h), cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', opacity: disabled ? 0.5 : 1,
                background: on ? 'var(--il-card-on)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-muted)', boxShadow: on ? 'inset 0 0 0 1px var(--il-line-strong)' : undefined }}>
              <span aria-hidden style={{ width: it.w, height: it.hh, border: '2px solid currentColor', borderRadius: 2 }} />
            </button>
          </Tip>
        );
      })}
    </div>
  );
}

/**
 * Size → shape (list 2, added after close): the UNIQUE ratios (1:1 4:5 3:4 2:3 9:16) as one even
 * row of equal cells — a tidy 3-column grid when the panel is narrow, never wrapping — and a
 * Portrait | Landscape switch in the title row (labels follow it: 4:5 ↔ 5:4). `picture` adds the
 * picture's own shape as the first cell (From image). `current` = the orientation of what is chosen
 * now (null when square / the picture): switching it flips the size (`onFlip`).
 */
const UNIQUE = SHAPES.filter((id) => { const r = ratioById(id); return r.w <= r.h; });

function ShapeChips({ value, onPick, onFlip, current, picture, disabled, title: head }: {
  value: string | null; onPick: (id: string) => void; onFlip: () => void; current: Orient | null;
  picture?: { w: number; h: number } | null; disabled?: boolean; title: ReactNode;
}) {
  const phone = useIsPhone();
  const [pref, setPref] = useState<'portrait' | 'landscape'>('portrait');
  const orient: 'portrait' | 'landscape' = current === 'landscape' || current === 'portrait' ? current : pref;
  const setOrient = (o: 'portrait' | 'landscape') => { setPref(o); if (current && current !== 'square' && current !== o) onFlip(); };
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cells = (picture ? 1 : 0) + UNIQUE.length;
  const minCell = phone ? 52 : 46;
  const cols = !width || width >= cells * minCell + (cells - 1) * 4 ? cells : 3;
  const h = phone ? 56 : 50;
  const cell = (key: string, label: string, icon: ReactNode, on: boolean, click: () => void, tip?: string) => (
    <Tip key={key} label={tip}>
      <button type="button" role="radio" aria-checked={on} aria-label={tip ?? label} onClick={click} disabled={disabled}
        style={{ height: h, minWidth: 0, border: 0, borderRadius: btnRadius(h), cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden',
          background: on ? 'var(--il-ember)' : 'var(--il-elev)', color: on ? 'var(--il-bg)' : 'var(--il-fg2)', transition: 'background-color .12s, color .12s' }}>
        <span style={{ height: 18, display: 'grid', placeItems: 'center' }}>{icon}</span>
        {label}
      </button>
    </Tip>
  );
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: phone ? 46 : 34 }}>
        {head}
        <span style={{ flex: 1 }} />
        <OrientSeg value={orient} onChange={setOrient} disabled={disabled} />
      </div>
      <div ref={gridRef} role="radiogroup" aria-label="Shape" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 4 }}>
        {picture && cell('picture', 'Picture', <ShapeIcon w={picture.w} h={picture.h} dashed />, value === 'picture', () => onPick('picture'), "The picture's own shape")}
        {UNIQUE.map((base) => {
          const id = orient === 'landscape' ? flipRatio(base) : base;
          const r = ratioById(id);
          return cell(base, id, <ShapeIcon w={r.w} h={r.h} />, value === id, () => onPick(id));
        })}
      </div>
    </>
  );
}

/** New image: the output's shape in a frame, its size on a solid chip. */
function ShapePreview({ w, h, height }: { w: number; h: number; height: number }) {
  const k = Math.min(200 / w, (0.8 * height) / h);
  return (
    <div style={{ height, borderRadius: T.radius.md, background: 'var(--il-bg-deep)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden', flex: 'none' }}>
      <div aria-hidden style={{ width: Math.round(w * k), height: Math.round(h * k), maxWidth: '86%', border: '2px solid var(--il-ember)', borderRadius: 6, background: 'repeating-linear-gradient(45deg, color-mix(in srgb, var(--il-ember) 8%, transparent) 0 8px, transparent 8px 16px)', transition: 'width .18s ease, height .18s ease' }} />
      <span aria-live="polite" style={sizeChip}>{fmt(w, h)}</span>
    </div>
  );
}

/** From image: the original picture, the part the shape keeps framed (the rest dimmed), the output size on a chip. */
function CropPreview({ original, shape, out, height }: { original: Pic; shape: string; out: { width: number; height: number }; height: number }) {
  const k = Math.min(220 / original.width, (0.86 * height) / original.height);
  const W = Math.round(original.width * k); const H = Math.round(original.height * k);
  const r = shape === 'picture' ? null : ratioById(shape);
  const c = r ? cropRect(W, H, r.w, r.h) : { x: 0, y: 0, width: W, height: H };
  return (
    <div style={{ height, borderRadius: T.radius.md, background: 'var(--il-bg-deep)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden', flex: 'none' }}>
      <div style={{ position: 'relative', width: W, height: H }}>
        <img src={original.dataUrl} alt="" draggable={false} style={{ width: W, height: H, display: 'block', borderRadius: 4 }} />
        <div aria-hidden style={{ position: 'absolute', left: c.x, top: c.y, width: c.width, height: c.height, border: '2px solid var(--il-ember)', borderRadius: 4, boxShadow: '0 0 0 999px color-mix(in srgb, var(--il-bg-deep) 70%, transparent)', transition: 'all .18s ease' }} />
      </div>
      <span aria-live="polite" style={sizeChip}>{fmt(out.width, out.height)}</span>
    </div>
  );
}

const PRESETS = (phone: boolean): Array<{ key: SizePreset; label: string; sub: string; title: string }> => [
  { key: 's', label: 'S', sub: 'smaller', title: 'Smaller than the model default' },
  { key: 'model', label: 'M', sub: phone ? 'default' : 'model default', title: "The model's own size" },
  { key: 'l', label: 'L', sub: 'larger', title: 'Larger than the model default' },
  { key: 'custom', label: 'Custom', sub: 'W × H', title: 'Width and height of your own' },
];

function FinalSize({ w, h, extra }: { w: number; h: number; extra?: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', fontVariantNumeric: 'tabular-nums' }}>
      Output <b style={{ color: 'var(--il-fg)', fontWeight: 800 }}>{fmt(w, h)}</b> · {megapixels(w, h)}{extra ? ` · ${extra}` : ''}
    </div>
  );
}

/** Width + Height sliders (steps of 64; the boxes take any number, snapped to 8) and the ratio lock. */
function SideSliders({ w, h, onWidth, onHeight, lock }: {
  w: number; h: number; onWidth: (v: number) => void; onHeight: (v: number) => void;
  lock: { on: boolean; label: string; onToggle?: () => void; fixed?: string };
}) {
  const phone = useIsPhone();
  return (
    <>
      <SliderRow id="width" label="Width" value={w} min={256} max={3072} step={64} onChange={(v) => onWidth(snap8(v))} unit="px" />
      <SliderRow id="height" label="Height" value={h} min={256} max={3072} step={64} onChange={(v) => onHeight(snap8(v))} unit="px" />
      <div>
        <Button size={phone ? 'lg' : 'sm'} on={lock.on} disabled={!lock.onToggle} onClick={lock.onToggle} icon={lock.on ? <IconLock size={14} /> : <IconLockOpen size={14} />}
          tooltip={lock.fixed ?? (lock.on ? 'Unlock the ratio' : 'Lock the ratio')}>
          {lock.label}
        </Button>
      </div>
    </>
  );
}

/* ---------- New image ---------- */

function NewImageSize() {
  const phone = useIsPhone();
  const width = useStore((s) => s.workflow.width);
  const height = useStore((s) => s.workflow.height);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const ratio = useComposition((s) => s.ratio);
  const sizeMode = useComposition((s) => s.sizeMode);
  const lock = useComposition((s) => s.lock);
  const setRatio = useComposition((s) => s.setRatio);
  const setSizeMode = useComposition((s) => s.setSizeMode);
  const setLock = useComposition((s) => s.setLock);
  const area = useNativeArea();
  const custom = sizeMode === 'custom';
  const shown = custom ? { width, height } : sizeForArea(presetArea(area, sizeMode), ratioById(ratio).w, ratioById(ratio).h);
  const near = nearestRatio(width, height);
  const exact = Math.abs(Math.log((width / height) / (near.w / near.h))) < 0.02;
  const lit = custom ? (exact ? near.id : null) : ratio;
  const lockRatio = lit ? ratioById(lit).w / ratioById(lit).h : width / height;

  const pick = (id: string) => { setRatio(id); if (custom) setWorkflow(reshape(width, height, ratioById(id))); };
  const flip = () => {
    if (custom) { setWorkflow({ width: height, height: width }); setRatio(flipRatio(near.id)); return; }
    setRatio(flipRatio(ratio));
  };
  const toPreset = (m: SizeMode) => {
    if (m === 'custom') setWorkflow(shown);
    else if (custom) setRatio(nearestRatio(width, height).id);
    setSizeMode(m);
  };

  return (
    <div style={card}>
      <ShapeChips title={<Tip hint="width"><div style={title}>Size</div></Tip>} value={lit} onPick={pick} onFlip={flip}
        current={orientOf(shown.width, shown.height) === 'square' ? null : orientOf(shown.width, shown.height)} />
      <ShapePreview w={shown.width} h={shown.height} height={phone ? 140 : 150} />
      <Seg<SizeMode> label="Size" items={PRESETS(phone)} value={sizeMode} onChange={toPreset} />
      {custom && (
        <SideSliders w={width} h={height}
          onWidth={(v) => setWorkflow(lock ? lockedPair('width', v, lockRatio) : { width: v })}
          onHeight={(v) => setWorkflow(lock ? lockedPair('height', v, lockRatio) : { height: v })}
          lock={{ on: lock, label: lock ? `Keep ${lit ?? 'the ratio'}` : 'Ratio free', onToggle: () => setLock(!lock) }} />
      )}
      <FinalSize w={shown.width} h={shown.height} />
    </div>
  );
}

/* ---------- From image ---------- */

const CHANGE: Array<{ key: string; label: string; v: number }> = [
  { key: 'subtle', label: 'Subtle', v: 0.35 }, { key: 'balanced', label: 'Balanced', v: 0.5 }, { key: 'strong', label: 'Strong', v: 0.65 }, { key: 'reimagine', label: 'Reimagine', v: 0.8 },
];

function HowMuch() {
  const denoise = useStore((s) => s.workflow.inputDenoise);
  const setWorkflow = useUndoableSetWorkflow();
  const preset = CHANGE.find((c) => Math.abs(c.v - denoise) < 0.005)?.key ?? null;
  return (
    <div style={card}>
      <SliderRow id="denoise" label="How much to change" value={denoise} min={0} max={1} step={0.01} defaultValue={DENOISE_DEFAULT} onChange={(v) => setWorkflow({ inputDenoise: v })} format={(v) => v.toFixed(2)} />
      <Seg label="How much to change" items={CHANGE} value={preset} onChange={(k) => setWorkflow({ inputDenoise: CHANGE.find((c) => c.key === k)!.v })} />
    </div>
  );
}

function FromImageSize({ input }: { input: Pic | null }) {
  const phone = useIsPhone();
  const maxSize = useStore((s) => s.workflow.inputMaxSize);
  const minSize = useStore((s) => s.workflow.inputMinSize);
  const setWorkflow = useUndoableSetWorkflow();
  const inputSize = useComposition((s) => s.inputSize);
  const setInputSize = useComposition((s) => s.setInputSize);
  const shapeState = useInputShape();
  const [busy, setBusy] = useState(false);
  if (!input) {
    return (
      <div style={card}>
        <div style={title}>Size</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>Add a picture: the output takes its shape.</div>
      </div>
    );
  }
  const original = originalOf(shapeState, input);
  const shape = shapeOf(shapeState, input);
  const out = scaledInput(input.width, input.height, maxSize, minSize);
  const long = Math.max(out.width, out.height);
  const setLong = (l: number) => setWorkflow({ inputMaxSize: l, inputMinSize: l });
  const pickShape = (id: string) => { if (id === shape || busy) return; setBusy(true); void setInputShape(id).finally(() => setBusy(false)); };
  const custom = inputSize === 'custom';
  return (
    <div style={card}>
      <ShapeChips title={<Tip hint="width"><div style={title}>Size</div></Tip>} value={shape} picture={{ w: original.width, h: original.height }} onPick={pickShape} disabled={busy}
        current={shape === 'picture' || shape === '1:1' ? null : orientOfRatio(ratioById(shape))}
        onFlip={() => { if (shape !== 'picture') pickShape(flipRatio(shape)); }} />
      <CropPreview original={original} shape={shape} out={out} height={phone ? 150 : 160} />
      <Seg<SizeMode> label="Size" items={PRESETS(phone)} value={inputSize} onChange={(m) => { if (m === 'custom') setLong(long); setInputSize(m); }} />
      {custom && (
        <SideSliders w={out.width} h={out.height}
          onWidth={(v) => setLong(longForSide(input.width, input.height, 'width', v))}
          onHeight={(v) => setLong(longForSide(input.width, input.height, 'height', v))}
          lock={{ on: true, label: 'Keeps the picture\'s shape', fixed: 'Pick a shape above to change it' }} />
      )}
      <FinalSize w={out.width} h={out.height} extra={`picture ${fmt(input.width, input.height)}`} />
    </div>
  );
}

/* ---------- the tab ---------- */

export function CompositionTab({ step }: { step: Step; phone?: boolean }) {
  const steps = useSteps((s) => s.steps);
  const setStepInput = useSteps((s) => s.setStepInput);
  const first = steps[0]?.id === step.id;
  const inputImage = useStore((s) => s.workflow.inputImage);
  const setWorkflow = useUndoableSetWorkflow();
  const storedMode = useComposition((s) => s.mode);
  const setMode = useComposition((s) => s.setMode);
  const [editing, setEditing] = useState(false);
  const slot = first ? 'image:1' : `step:${step.id}`;
  const url = first ? inputImage?.dataUrl ?? null : step.input?.url ?? null;
  const origin = useOrigin(slot, url);
  const label = stepTitle(steps, step.id);
  const isImage = step.kind === 'image' && first;
  const hasPicture = isImage && !!inputImage;
  const mode: CompositionMode = hasPicture ? 'from' : storedMode;
  // A picture that arrives from elsewhere (Send to, a drop on the rail) means From image.
  useEffect(() => { if (hasPicture && storedMode !== 'from') setMode('from'); }, [hasPicture, storedMode, setMode]);

  const zone = (
    <ImageDropZone
      url={url}
      name={first ? inputImage?.name : step.input?.name}
      dims={first && inputImage ? { width: inputImage.width, height: inputImage.height } : null}
      origin={origin}
      label={isImage ? 'Input image' : undefined}
      emptyTitle={isImage ? 'Drop a picture to start from' : undefined}
      pasteAnywhere={!isImage || mode === 'from'}
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

  const switchMode = (m: CompositionMode) => { setMode(m); setCompositionMode(m); };

  // New image hides the slot, but a picture sent here (Send-to sheet, a paste on the page) still
  // lands: it becomes the input and the tab switches to From image.
  const newMode = isImage && mode === 'new';
  const takeNew = async (item: DropItem, from: Origin) => {
    try {
      const { blob, name } = await dropToBlob(item);
      const st = await blobToImageState(blob, name);
      setMode('from');
      setWorkflow({ inputImage: st });
      rememberOrigin(slot, from, st.dataUrl);
    } catch (e) { clip.say(`Could not use that picture: ${e instanceof Error ? e.message : String(e)}`); }
  };
  useRegisterDropTarget(newMode ? { id: `input:${step.id}`, label: `Input of ${label}`, group: 'input', onDrop: (item) => void takeNew(item, originOfDrop(item)) } : null, [newMode, label]);
  const clip = usePaste({ onItem: (item) => void takeNew(item, item.kind === 'url' && item.payload ? originOfDrop(item) : 'paste'), anywhere: true, disabled: !newMode });

  let body: ReactNode;
  if (!isImage) body = <StepImageInput step={step} own={zone} />;
  else if (mode === 'new') body = <><ModeSwitch value={mode} onChange={switchMode} /><PasteNote note={clip.note} /><NewImageSize /></>;
  else body = (
    <>
      <ModeSwitch value={mode} onChange={switchMode} />
      <div style={card}>{zone}</div>
      <HowMuch />
      <FromImageSize input={inputImage} />
    </>
  );

  return (
    <>
      {body}
      {editing && inputImage && <EditImageModal image={inputImage} onClose={() => setEditing(false)} />}
    </>
  );
}
