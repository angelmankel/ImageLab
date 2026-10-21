/**
 * THE slider (item 1), one for the whole app, two kinds:
 *   - `Slider`: the bare track (Simple) — a big handle (20px, 26 on touch), 6px track, ember fill.
 *     For volume, tile size and other "feel" settings.
 *   - `SliderRow`: a labelled parameter row. `variant="advanced"` (the default — every parameter
 *     where exact numbers matter: Steps, CFG, denoise, strengths…) adds − / +, a visible typeable
 *     number box (`NumberField`) and a cog that opens the slider's own Step / Min / Max (saved per
 *     slider in this browser). `variant="simple"` keeps the plain value text.
 * Presets stay as tap chips under the label (rule 4). `id` = the hint id (item 26): the label's
 * tooltip shows that parameter's hint, and the cog's range is saved under it. `hint` (text) is the
 * small "← less · more →" line under the track, as before.
 */
import { useState, type ReactNode } from 'react';
import { Popover, Slider as MSlider } from '@mantine/core';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { useIsPhone } from '~/app/useIsPhone';
import { Chip } from './Chip';
import { IconBtn } from './IconBtn';
import { NumberField } from './NumberField';
import { Tip } from './Tip';
import { Button } from './Button';
import { effectiveRange, isOverridden } from './numberLogic';
import { useSliderRanges } from './sliderStore';
import { useHints } from './hints';
import { ResetButton, resetWithUndo, sameValue } from './ResetButton';
import { motionScale } from '~/theme/motion';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Fires once on release (heavy work: saving, previews). */
  onChangeEnd?: (v: number) => void;
  'aria-label'?: string;
  disabled?: boolean;
  /** How the value bubble over the handle reads (item 24); default = the number at the step's precision. */
  format?: (v: number) => string;
  /** Double-click on the handle (item 8). */
  onReset?: () => void;
}

/** The value at the step's precision: step 0.05 → "0.50", step 1 → "7" (no float noise). */
export function stepFormat(step: number): (v: number) => string {
  const s = String(step);
  const d = s.includes('e-') ? Number(s.split('e-')[1]) : (s.split('.')[1]?.length ?? 0);
  return (v: number) => (d ? v.toFixed(Math.min(d, 6)) : String(Math.round(v)));
}

/**
 * The bare track: Mantine's slider in the `.il-slider` dress (styles/next.css). Hover, drag or
 * keyboard focus shows the value in a small ember pin over the handle (item 24) — never the name.
 */
export function Slider({ value, min, max, step = 1, onChange, onChangeEnd, disabled, format, onReset, ...aria }: SliderProps) {
  return (
    <MSlider
      className="il-slider"
      value={Math.min(max, Math.max(min, value))}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      onChangeEnd={onChangeEnd}
      disabled={disabled}
      label={format ?? stepFormat(step)}
      labelTransitionProps={{ transition: 'pop', duration: Math.round(110 * motionScale()) }}
      color="ember"
      thumbProps={{ 'aria-label': aria['aria-label'], onDoubleClick: onReset }}
    />
  );
}

export function SliderRow({ label, value, min, max, step = 1, onChange, presets, format, hint, id, variant = 'advanced', unit, right, defaultValue }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
  presets?: number[]; format?: (v: number) => string;
  /** The small line under the track ("← keep · change →"). */
  hint?: string;
  /** Hint id (item 26) + the key the cog's range is saved under. */
  id?: string;
  variant?: 'advanced' | 'simple';
  unit?: string;
  /** Extra nodes at the right end of the label line (a lock…). */
  right?: ReactNode;
  /** The default (item 8): ↺ by the number while the value differs; double-click the handle too. */
  defaultValue?: number;
}) {
  const phone = useIsPhone();
  const key = id ?? `label:${label}`;
  const override = useSliderRanges((s) => s.ranges[key]);
  const base = { min, max, step };
  const r = variant === 'advanced' ? effectiveRange(base, override) : base;
  const fmt = format ?? ((v: number) => String(v));
  const canReset = defaultValue != null && !sameValue(value, defaultValue, step);
  const reset = canReset ? () => resetWithUndo(label, value, defaultValue!, onChange) : undefined;
  // The name's tooltip only when hints are on (it then explains the parameter); a bare repeat of
  // the visible name is noise (item 24).
  const hintsOn = useHints((s) => s.enabled);
  const name = <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: variant === 'advanced' ? (phone ? 44 : 30) : undefined }}>
        {id && hintsOn ? <Tip hint={id}><span style={{ display: 'inline-flex', minWidth: 0, cursor: 'help' }}>{name}</span></Tip> : name}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          <ResetButton shown={canReset} label={`Reset to ${defaultValue != null ? fmt(defaultValue) : ''}${unit ? ` ${unit}` : ''}`} onReset={() => reset?.()} size={phone ? 40 : 24} />
          {right}
          {variant === 'advanced' ? (
            <>
              <NumberField value={value} onChange={onChange} min={r.min} max={r.max} step={r.step} label={label} unit={unit} format={format} size={phone ? 'lg' : 'sm'} width={phone ? 156 : 118} />
              <RangeCog label={label} base={base} storeKey={key} size={phone ? 44 : 30} />
            </>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}{unit ? ` ${unit}` : ''}</span>
          )}
        </div>
      </div>
      {presets && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {presets.map((p) => <Chip key={p} small on={Math.abs(p - value) < r.step / 2} onClick={() => onChange(p)}>{fmt(p)}</Chip>)}
        </div>
      )}
      <Slider value={value} min={r.min} max={r.max} step={r.step} onChange={onChange} aria-label={`${label} slider`} onReset={reset} format={format ? (v) => `${format(v)}${unit ? ` ${unit}` : ''}` : unit ? (v) => `${stepFormat(r.step)(v)} ${unit}` : undefined} />
      {hint && <span style={{ fontSize: 10, color: 'var(--il-muted)' }}>{hint}</span>}
    </div>
  );
}

/** The cog: this slider's own Step / Min / Max, Reset to the app's. */
function RangeCog({ label, base, storeKey, size }: { label: string; base: { min: number; max: number; step: number }; storeKey: string; size: number }) {
  const [open, setOpen] = useState(false);
  const override = useSliderRanges((s) => s.ranges[storeKey]);
  const setRange = useSliderRanges((s) => s.setRange);
  const resetRange = useSliderRanges((s) => s.resetRange);
  const e = effectiveRange(base, override);
  const changed = isOverridden(base, override);
  const span = Math.max(1, Math.abs(base.max - base.min));
  const wide = { min: Math.min(base.min, -span * 10), max: base.max + span * 10 };
  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" shadow="lg" withinPortal zIndex={T.z.popover} trapFocus returnFocus
      classNames={{ dropdown: 'il-dd il-pop-in' }}>
      <Popover.Target>
        <IconBtn icon={<IconAdjustmentsHorizontal size={15} />} label={`${label}: step, min, max`} size={size} on={changed || open}
          onClick={() => setOpen((o) => !o)} tooltip={!open} aria-haspopup="dialog" aria-expanded={open} />
      </Popover.Target>
      <Popover.Dropdown style={{ width: 236, padding: 10 }}>
        <div className="il-eyebrow" style={{ marginBottom: 8 }}>{label} · slider</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: '6px 10px' }}>
          <CogLabel>Step</CogLabel>
          <NumberField label={`${label} step`} value={e.step} min={0} max={span} step={stepOfStep(base.step)} onChange={(step) => setRange(storeKey, { step })} size="sm" />
          <CogLabel>Min</CogLabel>
          <NumberField label={`${label} minimum`} value={e.min} min={wide.min} max={e.max - e.step} step={base.step} onChange={(v) => setRange(storeKey, { min: v })} size="sm" />
          <CogLabel>Max</CogLabel>
          <NumberField label={`${label} maximum`} value={e.max} min={e.min + e.step} max={wide.max} step={base.step} onChange={(v) => setRange(storeKey, { max: v })} size="sm" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)' }}>App: {base.min}–{base.max}, step {base.step}</span>
          <Button size="sm" tone="ghost" disabled={!changed} onClick={() => resetRange(storeKey)}>Reset</Button>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}

function CogLabel({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)' }}>{children}</span>;
}

/** The step the Step box itself moves by: a tenth of a decimal step, 1 for whole steps. */
function stepOfStep(step: number): number {
  return Number.isInteger(step) ? 1 : step / 10 >= 0.001 ? Number((step / 10).toPrecision(1)) : 0.001;
}
