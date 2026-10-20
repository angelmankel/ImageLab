/**
 * Settings → Themes (item 35): the small controls every Themes row uses. `Seg` = a segmented
 * choice (tap, 40px tall on the phone), `Tiles` = choices shown as a picture of the result,
 * `ColorWell` = a swatch that opens the system colour picker, `ThemeSlider` = the Ember slider
 * with tap presets.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Slider } from '@mantine/core';
import { useIsPhone } from '~/app/useIsPhone';
import { btnRadius } from '~/theme/tokens';
import { Chip } from '~/ui';

export function Seg<V extends string>({ value, options, onChange, label }: {
  value: V; options: ReadonlyArray<{ value: V; label: string }>; onChange: (v: V) => void; label: string;
}) {
  const phone = useIsPhone();
  const h = phone ? 36 : 28;
  return (
    <div role="radiogroup" aria-label={label}
      style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: `calc(${btnRadius(h)} + 3px)`, background: 'var(--il-elev)', maxWidth: '100%', overflowX: 'auto' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)} className="il-btn"
            style={{
              height: h, padding: `0 ${phone ? 14 : 11}px`, border: 0, borderRadius: btnRadius(h), whiteSpace: 'nowrap',
              background: on ? 'var(--il-card-on)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-muted)',
              fontSize: phone ? 12 : 11, fontWeight: on ? 800 : 700, flex: phone ? 1 : 'none',
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export interface TileOption<V extends string> { value: V; label: string; pic: ReactNode }

/** Choices as pictures. `min` = the narrowest a tile gets before the grid wraps. */
export function Tiles<V extends string>({ value, options, onChange, label, min = 92 }: {
  value: V; options: ReadonlyArray<TileOption<V>>; onChange: (v: V) => void; label: string; min?: number;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 8, width: '100%' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)} className="il-btn"
            style={{
              display: 'flex', flexDirection: 'column', gap: 6, padding: 7, minHeight: 44, textAlign: 'left',
              borderRadius: 'calc(12px * var(--il-corners, 1))', border: `1px solid ${on ? 'var(--il-ember-line)' : 'var(--il-line-soft)'}`,
              background: on ? 'var(--il-ember-soft)' : 'var(--il-card)', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg2)', fontSize: 11, fontWeight: 700,
            }}>
            <span aria-hidden style={{ display: 'block', height: 42, borderRadius: 'calc(8px * var(--il-corners, 1))', overflow: 'hidden', position: 'relative', background: 'var(--il-bg)' }}>{o.pic}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A swatch; a tap opens the system colour picker. Changes stream while the picker is dragged. */
export function ColorWell({ value, onChange, label, size = 36, style, children }: {
  value: string; onChange: (hex: string) => void; label: string; size?: number; style?: CSSProperties; children?: ReactNode;
}) {
  return (
    <label title={label} className="il-btn"
      style={{
        position: 'relative', display: 'grid', placeItems: 'center', width: size, height: size, flex: 'none', cursor: 'pointer',
        borderRadius: 'calc(10px * var(--il-corners, 1))', background: value, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)', ...style,
      }}>
      <input type="color" aria-label={label} value={value.toLowerCase()} onChange={(e) => onChange(e.currentTarget.value.toUpperCase())}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0 }} />
      {children}
    </label>
  );
}

export function ThemeSlider({ value, min, max, step, onChange, label, presets, fmt }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string;
  presets?: number[]; fmt: (v: number) => string;
}) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {presets && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {presets.map((p) => <Chip key={p} small on={Math.abs(p - value) < step / 2} onClick={() => onChange(p)}>{fmt(p)}</Chip>)}
        </div>
      )}
      <div className="il-slider"><Slider value={value} min={min} max={max} step={step} onChange={onChange} label={null} size="sm" color="ember" aria-label={label}
        styles={{ track: { touchAction: 'pan-y' }, thumb: { touchAction: 'none', borderWidth: 2 } }} /></div>
    </div>
  );
}

/** One row of colour bars, left to right (the palette cards, the phone strip). */
export function Stripes({ colors, h = 40, radius = 0 }: { colors: string[]; h?: number; radius?: number }) {
  return (
    <span aria-hidden style={{ display: 'flex', height: h, borderRadius: radius, overflow: 'hidden' }}>
      {colors.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
    </span>
  );
}
