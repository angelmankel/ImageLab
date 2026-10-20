/**
 * Settings → Themes → Make your own (item 35): ONE colour → the whole palette. The big well opens
 * the colour picker; the dots are quick seeds around the wheel; the dice shuffles a pleasant
 * one. Tint (how much the greys lean toward the accent), Darkness, Contrast and the second colour
 * (for gradients) refine it. The strip under it shows every token; a tap on one opens Fine-tune.
 */
import type { ReactNode } from 'react';
import { IconDice5 } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { useTheme } from '~/theme/themeStore';
import { PALETTE_KEYS, QUICK_SEEDS, shuffleGen, type Contrast, type Depth, type Harmony } from '~/theme/themeModel';
import { Button } from '~/ui';
import { ColorWell, Seg, ThemeSlider } from './bits';

const DEPTHS: ReadonlyArray<{ value: Depth; label: string }> = [
  { value: 'deep', label: 'Deep' }, { value: 'dark', label: 'Dark' }, { value: 'dim', label: 'Dim' },
];
const CONTRASTS: ReadonlyArray<{ value: Contrast; label: string }> = [
  { value: 'soft', label: 'Soft' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' },
];
const HARMONIES: ReadonlyArray<{ value: Harmony; label: string }> = [
  { value: 'near', label: 'Near' }, { value: 'opposite', label: 'Opposite' }, { value: 'triad', label: 'Triad' }, { value: 'custom', label: 'Pick' },
];

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 36 }}>
      <span style={{ width: 74, flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)' }}>{label}</span>
      <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  );
}

export function Generator({ onFineTune }: { onFineTune?: () => void }) {
  const phone = useIsPhone();
  const gen = useTheme((s) => s.theme.gen);
  const palette = useTheme((s) => s.theme.palette);
  const setGen = useTheme((s) => s.setGen);
  const dot = phone ? 34 : 26;
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <ColorWell value={palette.ember} onChange={(seed) => setGen({ seed })} label="Pick the accent colour" size={phone ? 76 : 92}
          style={{ borderRadius: 'calc(18px * var(--il-corners, 1))', alignItems: 'end', paddingBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', color: 'var(--il-on-accent)', pointerEvents: 'none' }}>PICK</span>
        </ColorWell>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div role="radiogroup" aria-label="Quick accent colours" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {QUICK_SEEDS.map((c) => {
              const on = gen.seed.toUpperCase() === c.toUpperCase();
              return (
                <button key={c} type="button" role="radio" aria-checked={on} aria-label={`Accent ${c}`} onClick={() => setGen({ seed: c })} className="il-btn"
                  style={{ width: dot, height: dot, borderRadius: '50%', padding: 0, border: '2px solid var(--il-panel)', background: c, boxShadow: on ? '0 0 0 2px var(--il-fg)' : '0 0 0 1px var(--il-line-strong)' }} />
              );
            })}
            <Button size="sm" h={phone ? 36 : 28} icon={<IconDice5 size={14} />} onClick={() => setGen(shuffleGen(gen))} tooltip="A random palette that works">Shuffle</Button>
          </div>
          <Line label="Tint">
            <ThemeSlider value={Math.round(gen.tint * 100)} min={0} max={100} step={5} onChange={(v) => setGen({ tint: v / 100 })} label="Tint" fmt={(v) => `${v}%`} />
            <span style={{ width: 34, textAlign: 'right', fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Math.round(gen.tint * 100)}%</span>
          </Line>
        </div>
      </div>
      <Line label="Darkness"><Seg label="Darkness" value={gen.depth} options={DEPTHS} onChange={(depth) => setGen({ depth })} /></Line>
      <Line label="Contrast"><Seg label="Contrast" value={gen.contrast} options={CONTRASTS} onChange={(contrast) => setGen({ contrast })} /></Line>
      <Line label="2nd colour">
        <Seg label="Second colour" value={gen.harmony} options={HARMONIES} onChange={(harmony) => setGen({ harmony, ...(harmony === 'custom' && !gen.second ? { second: palette.accent2 } : {}) })} />
        {gen.harmony === 'custom'
          ? <ColorWell value={palette.accent2} onChange={(second) => setGen({ harmony: 'custom', second })} label="Pick the second colour" size={30} />
          : <span aria-hidden style={{ width: 30, height: 30, flex: 'none', borderRadius: 'calc(10px * var(--il-corners, 1))', background: `linear-gradient(135deg, ${palette.ember}, ${palette.accent2})` }} />}
      </Line>
      <button type="button" onClick={onFineTune} aria-label="Fine-tune each colour" title="Fine-tune each colour" className="il-btn"
        style={{ display: 'flex', gap: 3, padding: 0, border: 0, background: 'transparent', width: '100%', cursor: onFineTune ? 'pointer' : 'default' }}>
        {PALETTE_KEYS.slice(0, 18).map((k) => <span key={k} style={{ flex: 1, height: 18, borderRadius: 5, background: palette[k], boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' }} />)}
      </button>
    </div>
  );
}
