/**
 * Item 13: the Edit mode's tool bar. Desktop: a floating glass bar on the LEFT of the canvas
 * (Donny's ask; Fit keeps the picture clear of it), a tool's options open as a small flyout beside
 * it. Phone: the same tools as a sideways row of 52 px tiles in their own row under the canvas,
 * the options in a row above them (nothing over the picture).
 *   Transform: Rotate · Flip H · Flip V · Crop
 *   Look (live, GPU): Adjust (sliders) · Invert · Grayscale
 *   ComfyUI (only what the server can run): Remove BG (BiRefNet) · Upscale · More (Resize / Pad,
 *     Sharpen, Posterize, Edges, Lineart, Depth, Face restore)
 *   Undo · Redo · Reset to original · Use as input · Save (a new result in the history)
 */
import { useRef, useState, type ReactNode } from 'react';
import { Loader } from '@mantine/core';
import {
  IconAdjustments, IconArrowBackUp, IconArrowForwardUp, IconBackground, IconCheck, IconContrast2, IconCrop, IconDots, IconFlipHorizontal,
  IconFlipVertical, IconPhotoUp, IconRestore, IconRotateClockwise, IconArrowsDiagonal, IconX, IconColorFilter,
} from '@tabler/icons-react';
import { Button, Chip, IconBtn, NumberField, Slider } from '~/ui';
import { CROP_RATIOS, ratioRect, isNeutralLook, NEUTRAL_LOOK, type Look } from './editLogic';
import { cropRatioValue } from './cropRatio';
import { exitEdit, isDirty, redoEdit, resetEdit, setLook, setTool, undoEdit, useEdit, type EditToolId } from './editStore';
import {
  cropEdit, edgesEdit, faceEdit, flipEdit, mapEdit, padEdit, posterizeEdit, removeBgEdit, resizeEdit, rotateEdit, saveEdit, sharpenEdit,
  upscaleEdit, useAsInputEdit, useServerTools, type ServerTools,
} from './editTools';
import type { NodeSpec } from './toolGraphs';
import { dvh } from '~/theme/uiScale';

/** Left inset (px) that keeps a fitted picture clear of the desktop bar. */
export const EDIT_BAR_INSET = 12 + 52 + 12;
const BTN = 40;

function Tool({ icon, label, onClick, on, disabled, busy, phone, primary }: { icon: ReactNode; label: string; onClick: () => void; on?: boolean; disabled?: boolean; busy?: boolean; phone: boolean; primary?: boolean }) {
  if (phone) {
    return (
      <button type="button" className="il-btn" onClick={onClick} disabled={disabled} aria-pressed={on} aria-label={label}
        style={{ flex: 'none', width: 56, height: 56, borderRadius: 12, border: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 0,
          background: primary ? 'var(--il-ember)' : on ? 'var(--il-ember-soft)' : 'var(--il-elev)', color: primary ? 'var(--il-on-accent, #0F0F11)' : on ? 'var(--il-ember-hi)' : 'var(--il-fg2)',
          boxShadow: on ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined, opacity: disabled ? 0.4 : 1, fontSize: 10, fontWeight: 700 }}>
        {busy ? <Loader size={16} color="var(--il-ember)" /> : icon}
        <span style={{ maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label.split(' · ')[0]}</span>
      </button>
    );
  }
  return <IconBtn icon={busy ? <Loader size={14} color="var(--il-ember)" /> : icon} label={label} onClick={onClick} on={on} disabled={disabled} size={BTN} tipPos="right" tone={primary ? 'primary' : 'ghost'} />;
}

const Hr = ({ phone }: { phone: boolean }) => <span aria-hidden style={phone ? { width: 1, alignSelf: 'stretch', margin: '6px 2px', background: 'var(--il-line-strong)', flex: 'none' } : { width: 26, height: 1, background: 'var(--il-line-strong)', margin: '4px 0', flex: 'none' }} />;

export function EditBar({ phone }: { phone: boolean }) {
  const hist = useEdit((s) => s.hist);
  const tool = useEdit((s) => s.tool);
  const busy = useEdit((s) => s.busy);
  const askLeave = useEdit((s) => s.askLeave);
  const tools = useServerTools();
  const ready = !!hist && !busy;
  const look = hist?.present.look ?? NEUTRAL_LOOK;
  const ico = (n: ReactNode) => n;
  const s = phone ? 20 : 18;
  const b = (label: string) => busy === label;

  const items = (
    <>
      <Tool phone={phone} icon={ico(<IconRotateClockwise size={s} />)} label="Rotate 90°" onClick={() => void rotateEdit(1)} disabled={!ready} busy={b('Rotate')} />
      <Tool phone={phone} icon={ico(<IconFlipHorizontal size={s} />)} label="Flip horizontally" onClick={() => void flipEdit('h')} disabled={!ready} busy={b('Flip')} />
      <Tool phone={phone} icon={ico(<IconFlipVertical size={s} />)} label="Flip vertically" onClick={() => void flipEdit('v')} disabled={!ready} />
      <Tool phone={phone} icon={ico(<IconCrop size={s} />)} label="Crop" on={tool === 'crop'} onClick={() => setTool('crop')} disabled={!ready} busy={b('Crop')} />
      <Hr phone={phone} />
      <Tool phone={phone} icon={ico(<IconAdjustments size={s} />)} label="Adjust" on={tool === 'adjust' || (!isNeutralLook({ ...look, invert: false, gray: false }))} onClick={() => setTool('adjust')} disabled={!ready} />
      <Tool phone={phone} icon={ico(<IconContrast2 size={s} />)} label="Invert" on={look.invert} onClick={() => setLook({ invert: !look.invert })} disabled={!ready} />
      <Tool phone={phone} icon={ico(<IconColorFilter size={s} />)} label="Grayscale" on={look.gray} onClick={() => setLook({ gray: !look.gray })} disabled={!ready} />
      {(tools.removebg || tools.upscale) && <Hr phone={phone} />}
      {tools.removebg && <Tool phone={phone} icon={ico(<IconBackground size={s} />)} label={`Remove BG · ${modelLabel(tools.removebg.model)}`} onClick={() => void removeBgEdit(tools.removebg!.model)} disabled={!ready} busy={b('Remove BG')} />}
      {tools.upscale && <Tool phone={phone} icon={ico(<IconArrowsDiagonal size={s} />)} label="Upscale" on={tool === 'upscale'} onClick={() => setTool('upscale')} disabled={!ready} busy={!!busy?.startsWith('Upscale')} />}
      {hasMore(tools) && <Tool phone={phone} icon={ico(<IconDots size={s} />)} label="More tools" on={MORE.includes(tool as EditToolId)} onClick={() => setTool(MORE.includes(tool as EditToolId) ? null : 'size')} disabled={!ready} busy={!!busy && MORE_LABELS.includes(busy)} />}
      {!phone && <span style={{ flex: 1, minHeight: 6 }} />}
      <Hr phone={phone} />
      <Tool phone={phone} icon={ico(<IconArrowBackUp size={s} />)} label={`Undo${hist?.past.length ? ` · ${hist.present.label}` : ''}`} onClick={undoEdit} disabled={!ready || !hist?.past.length} />
      <Tool phone={phone} icon={ico(<IconArrowForwardUp size={s} />)} label="Redo" onClick={redoEdit} disabled={!ready || !hist?.future.length} />
      <Tool phone={phone} icon={ico(<IconRestore size={s} />)} label="Reset to original" onClick={resetEdit} disabled={!ready || !hist?.past.length} />
      <Tool phone={phone} icon={ico(<IconPhotoUp size={s} />)} label="Use as input image" onClick={() => void useAsInputEdit()} disabled={!ready} busy={b('Use as input')} />
      <Tool phone={phone} icon={ico(<IconCheck size={s} stroke={2.6} />)} label="Save as a new result" primary onClick={() => void saveEdit()} disabled={!ready || !isDirty()} busy={b('Save')} />
    </>
  );

  const flyout = tool && tool !== 'save' ? <Flyout tool={tool} tools={tools} phone={phone} /> : null;

  if (phone) {
    return (
      <div style={{ flex: 'none', borderTop: '1px solid var(--il-line)', background: 'var(--il-panel)' }}>
        {askLeave && <LeaveAsk phone />}
        {flyout && <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--il-line)', maxHeight: dvh(38), overflowY: 'auto', touchAction: 'pan-y' }}>{flyout}</div>}
        <div className="il-scroll" style={{ display: 'flex', gap: 6, padding: '8px 10px calc(8px + var(--il-safe-bottom, 0px))', overflowX: 'auto', touchAction: 'pan-x', scrollbarWidth: 'none' }}>
          <Tool phone icon={<IconX size={20} />} label="Close" onClick={() => exitEdit()} />
          {items}
        </div>
      </div>
    );
  }
  return (
    <>
      <div role="toolbar" aria-orientation="vertical" aria-label="Edit tools" className="il-scroll" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}
        style={{ position: 'absolute', left: 12, top: 12, bottom: 12, width: 52, borderRadius: 16, padding: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', background: 'color-mix(in srgb, var(--il-elev) 88%, transparent)', backdropFilter: 'var(--il-blur)',
          boxShadow: 'inset 0 0 0 1px var(--il-line-strong), 0 8px 30px rgba(0,0,0,.35)', zIndex: 2, cursor: 'default' }}>
        {items}
      </div>
      {flyout && (
        <div role="dialog" aria-label="Tool options" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} className="il-pop-in"
          style={{ position: 'absolute', left: 76, top: 12, width: 264, maxHeight: 'calc(100% - 24px)', overflowY: 'auto', borderRadius: 14, padding: 12, zIndex: 3, cursor: 'default',
            background: 'color-mix(in srgb, var(--il-elev) 94%, transparent)', backdropFilter: 'var(--il-blur)', boxShadow: 'inset 0 0 0 1px var(--il-line-strong), 0 8px 30px rgba(0,0,0,.35)' }}>
          {flyout}
        </div>
      )}
      {askLeave && <LeaveAsk phone={false} />}
    </>
  );
}

const MORE: EditToolId[] = ['size', 'sharpen', 'posterize', 'edges', 'lineart', 'depth', 'face'];
const MORE_LABELS = ['Resize', 'Pad', 'Sharpen', 'Posterize', 'Edges', 'Lineart', 'Depth', 'Face restore'];
const hasMore = (t: ServerTools) => !!(t.resize || t.pad || t.sharpen || t.posterize || t.edges || t.lineart || t.depth || t.face);
const modelLabel = (m: string) => {
  const base = m.split(/[\\/]/).pop()!.replace(/\.(safetensors|pth|pt|ckpt|bin|onnx)$/i, '');
  return /birefnet/i.test(base) ? 'BiRefNet' : base;
};

function Head({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)' }}>{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {right}
        <IconBtn icon={<IconX size={14} />} label="Close" size={28} onClick={() => setTool(null)} />
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)', marginBottom: 4 }}>
        <span>{label}</span>{value != null && <span style={{ color: 'var(--il-muted)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>}
      </div>
      {children}
    </div>
  );
}

const Chips = ({ children }: { children: ReactNode }) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>;

function RunBtn({ label, onClick, phone }: { label: string; onClick: () => void; phone: boolean }) {
  const busy = useEdit((s) => s.busy);
  return <Button tone="primary" size={phone ? 'lg' : 'md'} grow onClick={onClick} disabled={!!busy} style={{ marginTop: 10 }}>{busy === label ? `${label}…` : label}</Button>;
}

/** A look slider: the first move of a drag is one undo step, the rest of the drag merges into it. */
function LookSlider({ k, label, min, max, unit = '' }: { k: keyof Omit<Look, 'invert' | 'gray'>; label: string; min: number; max: number; unit?: string }) {
  const v = useEdit((s) => s.hist?.present.look[k] ?? 0);
  const dragging = useRef(false);
  return (
    <Row label={label} value={`${v > 0 && min < 0 ? '+' : ''}${v}${unit}`}>
      <Slider value={v} min={min} max={max} aria-label={label}
        onChange={(n) => { setLook({ [k]: n } as Partial<Look>, dragging.current); dragging.current = true; }}
        onChangeEnd={() => { dragging.current = false; }} />
    </Row>
  );
}

function Flyout({ tool, tools, phone }: { tool: EditToolId; tools: ServerTools; phone: boolean }) {
  if (tool === 'crop') return <CropPanel phone={phone} />;
  if (tool === 'adjust') {
    return (
      <div>
        <Head title="Adjust" right={<Button size="sm" tone="ghost" onClick={() => setLook({ brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0 })}>Reset</Button>} />
        <LookSlider k="brightness" label="Brightness" min={-100} max={100} />
        <LookSlider k="contrast" label="Contrast" min={-100} max={100} />
        <LookSlider k="saturation" label="Saturation" min={-100} max={100} />
        <LookSlider k="hue" label="Hue" min={-180} max={180} unit="°" />
        <LookSlider k="blur" label="Blur" min={0} max={40} unit=" px" />
      </div>
    );
  }
  if (tool === 'upscale' && tools.upscale) return <UpscalePanel models={tools.upscale.models} phone={phone} />;
  return <MorePanel tool={tool} tools={tools} phone={phone} />;
}

function CropPanel({ phone }: { phone: boolean }) {
  const ratio = useEdit((s) => s.cropRatio);
  const crop = useEdit((s) => s.crop);
  const pic = useEdit((s) => s.hist?.present.pic);
  const pick = (id: string) => {
    if (!pic) return;
    useEdit.setState({ cropRatio: id, crop: ratioRect(pic.w, pic.h, cropRatioValue(id, pic.w, pic.h)) });
  };
  return (
    <div>
      <Head title="Crop" right={crop && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', fontVariantNumeric: 'tabular-nums' }}>{crop.w} × {crop.h}</span>} />
      <Chips>{CROP_RATIOS.map((r) => <Chip key={r.id} small={!phone} tall={phone} on={ratio === r.id} onClick={() => pick(r.id)}>{r.label}</Chip>)}</Chips>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <Button size={phone ? 'lg' : 'md'} tone="ghost" grow onClick={() => setTool(null)}>Cancel</Button>
        <Button size={phone ? 'lg' : 'md'} tone="primary" grow disabled={!crop} onClick={() => { if (crop) void cropEdit(crop); }}>Apply</Button>
      </div>
    </div>
  );
}

function UpscalePanel({ models, phone }: { models: string[]; phone: boolean }) {
  const [by, setBy] = useState(2);
  const [useModel, setUseModel] = useState(models.length > 0);
  const pic = useEdit((s) => s.hist?.present.pic);
  return (
    <div>
      <Head title="Upscale" right={pic && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>→ {Math.round(pic.w * by)} × {Math.round(pic.h * by)}</span>} />
      <Chips>{[1.5, 2, 4].map((n) => <Chip key={n} small={!phone} tall={phone} on={by === n} onClick={() => setBy(n)}>×{n}</Chip>)}</Chips>
      <Row label="How">
        <Chips>
          <Chip small={!phone} tall={phone} on={useModel} disabled={!models.length} onClick={() => setUseModel(true)}>Upscale model</Chip>
          <Chip small={!phone} tall={phone} on={!useModel} onClick={() => setUseModel(false)}>Lanczos</Chip>
        </Chips>
      </Row>
      <RunBtn label={`Upscale ×${by}`} phone={phone} onClick={() => void upscaleEdit(by, models, useModel)} />
    </div>
  );
}

function MorePanel({ tool, tools, phone }: { tool: EditToolId; tools: ServerTools; phone: boolean }) {
  const tabs: { id: EditToolId; label: string; ok: boolean }[] = [
    { id: 'size', label: 'Size', ok: !!(tools.resize || tools.pad) },
    { id: 'sharpen', label: 'Sharpen', ok: !!tools.sharpen },
    { id: 'posterize', label: 'Posterize', ok: !!tools.posterize },
    { id: 'edges', label: 'Edges', ok: !!tools.edges },
    { id: 'lineart', label: 'Lineart', ok: !!tools.lineart },
    { id: 'depth', label: 'Depth', ok: !!tools.depth },
    { id: 'face', label: 'Face restore', ok: !!tools.face },
  ];
  const shown = tabs.filter((t) => t.ok);
  const cur = shown.find((t) => t.id === tool) ?? shown[0];
  if (!cur) return null;
  return (
    <div>
      <Head title="More tools" />
      <Chips>{shown.map((t) => <Chip key={t.id} small={!phone} tall={phone} on={t.id === cur.id} onClick={() => useEdit.setState({ tool: t.id })}>{t.label}</Chip>)}</Chips>
      <div style={{ height: 1, background: 'var(--il-line)', margin: '10px 0 4px' }} />
      {cur.id === 'size' && <SizePanel tools={tools} phone={phone} />}
      {cur.id === 'sharpen' && <SharpenPanel phone={phone} />}
      {cur.id === 'posterize' && <PosterizePanel phone={phone} />}
      {cur.id === 'edges' && <EdgesPanel phone={phone} />}
      {cur.id === 'lineart' && tools.lineart && <MapPanel label="Lineart" node={tools.lineart} phone={phone} />}
      {cur.id === 'depth' && tools.depth && <MapPanel label="Depth" node={tools.depth} phone={phone} />}
      {cur.id === 'face' && tools.face && <FacePanel face={tools.face} phone={phone} />}
    </div>
  );
}

function SizePanel({ tools, phone }: { tools: ServerTools; phone: boolean }) {
  const pic = useEdit((s) => s.hist?.present.pic);
  const [mode, setMode] = useState<'resize' | 'pad'>(tools.resize ? 'resize' : 'pad');
  const [w, setW] = useState(pic?.w ?? 1024);
  const [h, setH] = useState(pic?.h ?? 1024);
  const [lock, setLock] = useState(true);
  const [fill, setFill] = useState(false);
  const [pad, setPad] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  const aspect = pic ? pic.w / pic.h : 1;
  const size = phone ? 'lg' : 'sm';
  return (
    <div>
      <Chips>
        {tools.resize && <Chip small={!phone} tall={phone} on={mode === 'resize'} onClick={() => setMode('resize')}>Resize</Chip>}
        {tools.pad && <Chip small={!phone} tall={phone} on={mode === 'pad'} onClick={() => setMode('pad')}>Pad (outpaint)</Chip>}
      </Chips>
      {mode === 'resize' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
            <NumberField label="Width" value={w} min={16} max={8192} step={8} unit="px" size={size} onChange={(v) => { setW(v); if (lock) setH(Math.round(v / aspect)); }} />
            <NumberField label="Height" value={h} min={16} max={8192} step={8} unit="px" size={size} onChange={(v) => { setH(v); if (lock) setW(Math.round(v * aspect)); }} />
          </div>
          <Chips>
            <span style={{ height: 8, width: '100%' }} />
            <Chip small={!phone} tall={phone} on={lock} onClick={() => setLock(!lock)}>Keep ratio</Chip>
            <Chip small={!phone} tall={phone} on={fill} onClick={() => setFill(!fill)}>Fill (crop)</Chip>
            {pic && [0.5, 2].map((k) => <Chip key={k} small={!phone} tall={phone} onClick={() => { setW(Math.round(pic.w * k)); setH(Math.round(pic.h * k)); }}>×{k}</Chip>)}
          </Chips>
          <RunBtn label="Resize" phone={phone} onClick={() => void resizeEdit(w, h, fill && !lock)} />
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
            {(['left', 'right', 'top', 'bottom'] as const).map((k) => (
              <NumberField key={k} label={k[0].toUpperCase() + k.slice(1)} value={pad[k]} min={0} max={2048} step={8} unit="px" size={size} onChange={(v) => setPad((p) => ({ ...p, [k]: v }))} />
            ))}
          </div>
          <Chips>
            <span style={{ height: 8, width: '100%' }} />
            {[64, 128, 256].map((n) => <Chip key={n} small={!phone} tall={phone} onClick={() => setPad({ left: n, top: n, right: n, bottom: n })}>{n} all round</Chip>)}
          </Chips>
          <RunBtn label="Pad" phone={phone} onClick={() => void padEdit(pad)} />
        </>
      )}
    </div>
  );
}

function SharpenPanel({ phone }: { phone: boolean }) {
  const [amount, setAmount] = useState(1);
  const [radius, setRadius] = useState(1);
  return (
    <div>
      <Row label="Amount" value={amount.toFixed(1)}><Slider value={amount} min={0.1} max={3} step={0.1} onChange={setAmount} aria-label="Amount" /></Row>
      <Row label="Radius" value={`${radius} px`}><Slider value={radius} min={1} max={5} onChange={setRadius} aria-label="Radius" /></Row>
      <RunBtn label="Sharpen" phone={phone} onClick={() => void sharpenEdit(amount, radius)} />
    </div>
  );
}

function PosterizePanel({ phone }: { phone: boolean }) {
  const [colors, setColors] = useState(8);
  const [dither, setDither] = useState('none');
  return (
    <div>
      <Row label="Colours" value={String(colors)}><Slider value={colors} min={2} max={64} onChange={setColors} aria-label="Colours" /></Row>
      <Chips>{['none', 'floyd-steinberg', 'bayer-4'].map((d) => <Chip key={d} small={!phone} tall={phone} on={dither === d} onClick={() => setDither(d)}>{d === 'none' ? 'No dither' : d === 'bayer-4' ? 'Bayer' : 'Floyd–Steinberg'}</Chip>)}</Chips>
      <RunBtn label="Posterize" phone={phone} onClick={() => void posterizeEdit(colors, dither)} />
    </div>
  );
}

function EdgesPanel({ phone }: { phone: boolean }) {
  const [low, setLow] = useState(0.4);
  const [high, setHigh] = useState(0.8);
  return (
    <div>
      <Row label="Low threshold" value={low.toFixed(2)}><Slider value={low} min={0.01} max={0.99} step={0.01} onChange={(v) => { setLow(v); if (v > high) setHigh(v); }} aria-label="Low threshold" /></Row>
      <Row label="High threshold" value={high.toFixed(2)}><Slider value={high} min={0.01} max={0.99} step={0.01} onChange={(v) => { setHigh(v); if (v < low) setLow(v); }} aria-label="High threshold" /></Row>
      <RunBtn label="Edges" phone={phone} onClick={() => void edgesEdit(low, high)} />
    </div>
  );
}

function MapPanel({ label, node, phone }: { label: string; node: { cls: string; spec: NodeSpec | null }; phone: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--il-muted)', fontWeight: 600, marginTop: 6 }}>{node.cls}</div>
      <RunBtn label={label} phone={phone} onClick={() => void mapEdit(label, node.cls, node.spec)} />
    </div>
  );
}

function FacePanel({ face, phone }: { face: NonNullable<ServerTools['face']>; phone: boolean }) {
  const [model, setModel] = useState(face.models[0]);
  const [fidelity, setFidelity] = useState(0.5);
  return (
    <div>
      <Row label="Model"><Chips>{face.models.map((m) => <Chip key={m} small={!phone} tall={phone} on={model === m} onClick={() => setModel(m)}>{modelLabel(m)}</Chip>)}</Chips></Row>
      <Row label="Fidelity" value={fidelity.toFixed(2)}><Slider value={fidelity} min={0} max={1} step={0.05} onChange={setFidelity} aria-label="Fidelity" /></Row>
      <RunBtn label="Face restore" phone={phone} onClick={() => void faceEdit(model, face.spec, fidelity)} />
    </div>
  );
}

/** Leaving with unsaved edits: Save / Discard / Keep editing. */
function LeaveAsk({ phone }: { phone: boolean }) {
  const size = phone ? 'lg' : 'md';
  return (
    <div role="alertdialog" aria-label="Unsaved edits" onPointerDown={(e) => e.stopPropagation()}
      style={phone
        ? { padding: '10px 14px', borderBottom: '1px solid var(--il-line)', display: 'flex', flexDirection: 'column', gap: 8 }
        : { position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)', zIndex: 4, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px', borderRadius: 14,
            background: 'var(--il-elev)', boxShadow: 'inset 0 0 0 1px var(--il-line-strong), 0 8px 30px rgba(0,0,0,.4)' }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', whiteSpace: 'nowrap' }}>Unsaved edits</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size={size} tone="ghost" onClick={() => useEdit.setState({ askLeave: false })}>Keep editing</Button>
        <Button size={size} tone="danger" onClick={() => exitEdit(true)}>Discard</Button>
        <Button size={size} tone="primary" onClick={() => { useEdit.setState({ askLeave: false }); void saveEdit(); }}>Save</Button>
      </div>
    </div>
  );
}
