/**
 * Width / Height in manual mode (rule 5): a label, the shared number box (`ui/NumberField`:
 * − / + by 8, type any value, snaps to 8 on commit) and the shared slider (steps of 64).
 */
import { NumberField, Slider } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { BOX_MAX, BOX_MIN, BOX_STEP, SLIDER_MAX, SLIDER_MIN, SLIDER_STEP, snap } from './size';

export function DimRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const phone = useIsPhone();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>
        <span>{label}</span>
        <NumberField label={label} value={value} min={BOX_MIN} max={BOX_MAX} step={BOX_STEP} unit="px" size={phone ? 'lg' : 'sm'} width={phone ? 150 : 120}
          onChange={(v) => { const s = snap(v, BOX_MIN, BOX_MAX, BOX_STEP); if (s !== value) onChange(s); }} />
      </div>
      <Slider value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value))} min={SLIDER_MIN} max={SLIDER_MAX} step={SLIDER_STEP} onChange={onChange} aria-label={`${label} slider`} />
    </div>
  );
}
