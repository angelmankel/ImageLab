import { Slider as MSlider } from '@mantine/core';
import { Chip } from './Chip';

/**
 * A labelled slider row with optional tap presets (rule 4: "Strength with tap presets 0.5 · 0.8
 * · 1.0 · 1.2 + slider") and a number box. One line of label + value, presets under, track under.
 */
export function SliderRow({ label, value, min, max, step = 1, onChange, presets, format, hint }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
  presets?: number[]; format?: (v: number) => string; hint?: string;
}) {
  const fmt = format ?? ((v: number) => String(v));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</span>
      </div>
      {presets && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {presets.map((p) => <Chip key={p} small on={Math.abs(p - value) < step / 2} onClick={() => onChange(p)}>{fmt(p)}</Chip>)}
        </div>
      )}
      <MSlider value={value} min={min} max={max} step={step} onChange={onChange} label={null} size="sm" color="ember"
        styles={{ track: { touchAction: 'pan-y' }, thumb: { touchAction: 'none', borderWidth: 2 } }} />
      {hint && <span style={{ fontSize: 10, color: 'var(--il-muted)' }}>{hint}</span>}
    </div>
  );
}
