/**
 * Width / Height in manual mode (rule 5): a label, a number box (snaps to 8) and a slider
 * (steps of 64), as the old DimensionsField did. The slider is Mantine's with the phone rules
 * (track pan-y, thumb none).
 */
import { useEffect, useState } from 'react';
import { Slider } from '@mantine/core';
import { BOX_MAX, BOX_MIN, BOX_STEP, SLIDER_MAX, SLIDER_MIN, SLIDER_STEP, snap } from './size';

export function DimRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const v = snap(Number(draft), BOX_MIN, BOX_MAX, BOX_STEP);
    setDraft(String(v));
    if (v !== value) onChange(v);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>
        <span>{label}</span>
        <input
          aria-label={label}
          type="number"
          inputMode="numeric"
          min={BOX_MIN}
          max={BOX_MAX}
          step={BOX_STEP}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
          style={{ width: 64, height: 26, border: '1px solid var(--il-line-strong)', borderRadius: 8, background: 'var(--il-panel)', color: 'var(--il-fg)', fontSize: 12, fontWeight: 700, textAlign: 'right', padding: '0 8px', outline: 'none', fontVariantNumeric: 'tabular-nums' }}
        />
      </div>
      <Slider value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value))} min={SLIDER_MIN} max={SLIDER_MAX} step={SLIDER_STEP} onChange={onChange} label={null} size="sm" color="ember"
        thumbProps={{ 'aria-label': `${label} slider` }} styles={{ track: { touchAction: 'pan-y' }, thumb: { touchAction: 'none', borderWidth: 2 } }} />
    </div>
  );
}
