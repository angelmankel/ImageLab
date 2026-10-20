/**
 * Rule 6: the Style thumbs row. A style is one positive layer tagged "Style" (made, replaced or
 * removed here), so it rides along in the compiled prompt like any part. Thumbs are gradients
 * (never a generated picture). The pure list is `styles.ts`.
 */
import { useStore } from '@/lib/store';
import { useWheelSideways } from '~/ui';
import { STYLES, STYLE_TAG, type StyleDef } from './styles';

function useStyleLayer() {
  return useStore((s) => s.layers.find((l) => l.kind === 'positive' && l.tag === STYLE_TAG));
}

export function applyStyle(style: StyleDef) {
  const st = useStore.getState();
  const cur = st.layers.find((l) => l.kind === 'positive' && l.tag === STYLE_TAG);
  if (!style.text) { if (cur) st.removeLayer(cur.id); return; }
  if (cur) st.updateLayer(cur.id, { text: style.text, on: true });
  else st.addLayer('positive', { tag: STYLE_TAG, text: style.text });
}

export function StyleRow() {
  const layer = useStyleLayer();
  const wheelRef = useWheelSideways<HTMLDivElement>();
  const current = STYLES.find((s) => s.text && layer?.text === s.text)?.id ?? (layer?.text ? 'custom' : 'none');
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 2px 8px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>Style</span>
        {current === 'custom' && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-ember-hi)' }} title={layer?.text}>custom</span>}
      </div>
      <div ref={wheelRef} className="il-scroll-x" data-no-swipe style={{ display: 'flex', gap: 10, touchAction: 'pan-x pan-y' }}>
        {STYLES.map((s) => {
          const on = s.id === current;
          return (
            <button key={s.id} type="button" onClick={() => applyStyle(s)} aria-pressed={on} title={s.text || 'No style'} style={{ flex: '1 0 0', minWidth: 72, border: 0, background: 'transparent', padding: 0, textAlign: 'center', cursor: 'pointer', color: on ? 'var(--il-fg)' : 'var(--il-fg2)' }}>
              <div aria-hidden style={{ height: 66, borderRadius: 16, background: s.thumb, border: on ? '2px solid var(--il-ember)' : '2px solid transparent', boxSizing: 'border-box' }} />
              <div style={{ fontSize: 11, fontWeight: on ? 700 : 600, marginTop: 6 }}>{s.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
