/**
 * A first-round → last-round range for Loopback (rule 5, tap over type): a dual-handle slider in
 * the `~/ui` Slider look, the two values in the header ("0.6 → 0.3"), a swap button that turns a
 * rising ramp into a falling one, and the thumb names under the track. The handles always hold
 * [low, high]; which one is the first round is `isFalling(ramp)`.
 */
import { RangeSlider } from '@mantine/core';
import { IconArrowsExchange } from '@tabler/icons-react';
import { Chip, IconBtn } from '~/ui';
import { fmtNum, handlesOf, isFalling, rampFromHandles, type Ramp } from './loopback';

export function RangeRow({ label, ramp, min, max, step, digits = 2, onChange, onFixed, hint }: {
  label: string; ramp: Ramp; min: number; max: number; step: number; digits?: number;
  onChange: (r: Ramp) => void;
  /** Shown as a small "one value" chip: back to a fixed value for every round. */
  onFixed?: () => void;
  hint?: string;
}) {
  const falling = isFalling(ramp);
  const fmt = (v: number) => fmtNum(v, digits);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', flex: 1, minWidth: 0 }}>{label}</span>
        {onFixed && <Chip small onClick={onFixed} title="One value for every round">one value</Chip>}
        <IconBtn size={26} tone="card" icon={<IconArrowsExchange size={14} />} tooltip={false}
          label={falling ? 'Rise instead' : 'Fall instead'}
          onClick={() => onChange({ start: ramp.end, end: ramp.start })} />
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {fmt(ramp.start)} → {fmt(ramp.end)}
        </span>
      </div>
      <RangeSlider
        value={handlesOf(ramp)}
        min={min} max={max} step={step} minRange={0}
        onChange={([lo, hi]) => onChange(rampFromHandles(lo, hi, falling))}
        label={null} size="sm" color="ember" className="il-slider"
        thumbFromLabel={`${label} ${falling ? 'last' : 'first'} round`}
        thumbToLabel={`${label} ${falling ? 'first' : 'last'} round`}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--il-muted)' }}>
        <span>{falling ? 'last round' : 'first round'}</span>
        {hint && <span>{hint}</span>}
        <span>{falling ? 'first round' : 'last round'}</span>
      </div>
    </div>
  );
}
