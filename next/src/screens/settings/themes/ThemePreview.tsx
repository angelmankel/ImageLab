/**
 * Settings → Themes, the live preview (item 35). A tiny mock of the app drawn ONLY from the
 * --il-* vars, so it always shows exactly what the theme does (the whole app changes too; this
 * keeps a sample in view while you scroll). Placeholder picture only. Desktop: a sticky card
 * beside the settings. Phone: `PreviewStrip`, a slim sticky band of the main colours.
 */
import { Stripes } from './bits';

const R = (px: number) => `calc(${px}px * var(--il-corners, 1))`;
const B = (h: number) => `calc(${h / 2}px * var(--il-btn-round, .85))`;

function Chip({ on, children }: { on?: boolean; children: string }) {
  return (
    <span style={{
      height: 20, padding: '0 8px', display: 'inline-grid', placeItems: 'center', fontSize: 9, fontWeight: 700, borderRadius: B(20),
      background: on ? 'var(--il-ember-soft)' : 'var(--il-card)', border: `1px solid ${on ? 'var(--il-ember-line)' : 'var(--il-line-soft)'}`,
      color: on ? 'var(--il-ember-hi)' : 'var(--il-fg2)',
    }}>{children}</span>
  );
}

export function ThemePreview() {
  return (
    <div aria-label="Live preview" role="img" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span className="il-eyebrow">Live preview</span>
      <div style={{ borderRadius: R(14), border: '1px solid var(--il-line-soft)', overflow: 'hidden', background: 'var(--il-bg)', backgroundImage: 'var(--il-bg-art)', boxShadow: 'var(--il-shadow-md)', fontFamily: 'var(--il-font)' }}>
        <div style={{ height: 32, background: 'var(--il-panel)', borderBottom: '1px solid var(--il-line)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundImage: 'var(--il-accent-fill)' }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--il-fg)' }}>ImageLab</span>
          <span style={{ flex: 1 }} />
          <span style={{ height: 18, width: 46, borderRadius: B(18), background: 'var(--il-elev)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '128px 1fr', height: 236 }}>
          <div style={{ background: 'var(--il-panel)', borderRight: '1px solid var(--il-line)', padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}><Chip on>Prompt</Chip><Chip>Model</Chip></div>
            <div style={{ height: 44, borderRadius: R(10), background: 'var(--il-elev)', border: '1px solid var(--il-line-strong)', padding: 6, fontSize: 9, fontWeight: 600, color: 'var(--il-muted)', fontFamily: 'var(--il-font-prompt)' }}>a lighthouse at dusk…</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}><Chip>portrait</Chip><Chip on>soft light</Chip></div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--il-line-strong)', position: 'relative' }}>
              <span style={{ position: 'absolute', inset: '0 40% 0 0', borderRadius: 3, backgroundImage: 'var(--il-accent-fill)' }} />
            </div>
            <span style={{ flex: 1 }} />
            <span style={{ height: 28, borderRadius: B(28), backgroundImage: 'var(--il-accent-fill)', color: 'var(--il-bg)', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', boxShadow: '0 4px 14px color-mix(in srgb, var(--il-ember) var(--il-glow, 35%), transparent)' }}>Generate</span>
          </div>
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ flex: 1, borderRadius: R(12), background: 'linear-gradient(135deg, #3a3a44, #24242a)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: B(30), background: 'color-mix(in srgb, var(--il-bg) var(--il-glass-pct, 72%), transparent)', backdropFilter: 'var(--il-blur)', border: '1px solid color-mix(in srgb, var(--il-fg) 8%, transparent)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--il-ok)' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--il-fg2)' }}>Done · 3.2 s</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 10, borderRadius: R(12), background: 'var(--il-card)', border: '1px solid var(--il-line-soft)', fontSize: 12 }}>
        <b style={{ color: 'var(--il-fg)', fontWeight: 800 }}>Primary text</b>
        <span style={{ color: 'var(--il-fg2)', fontWeight: 600 }}>Secondary text</span>
        <span style={{ color: 'var(--il-muted)', fontWeight: 600 }}>Muted hint</span>
        <span style={{ color: 'var(--il-ember)', fontWeight: 700 }}>Accent link</span>
        <span style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {['--il-ok', '--il-warn', '--il-err', '--il-info'].map((v) => <span key={v} style={{ width: 14, height: 14, borderRadius: 4, background: `var(${v})` }} />)}
        </span>
      </div>
    </div>
  );
}

/** Phone: the main colours, always in view at the top of the Themes page. */
export function PreviewStrip() {
  return (
    <div style={{ position: 'sticky', top: -10, zIndex: 2, margin: '-10px -14px 10px', padding: '10px 14px 8px', background: 'var(--il-bg)', borderBottom: '1px solid var(--il-line)' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ flex: 3 }}><Stripes colors={['var(--il-bg)', 'var(--il-panel)', 'var(--il-card)', 'var(--il-fg2)']} h={36} radius={10} /></span>
        <span style={{ flex: 2, height: 36, borderRadius: B(36), backgroundImage: 'var(--il-accent-fill)', color: 'var(--il-bg)', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center' }}>Generate</span>
      </div>
    </div>
  );
}
