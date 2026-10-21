/**
 * Style tab: "Add a reference" — big type tiles with a one-line explanation (mockup A). With no
 * references they ARE the empty state. A type no online server can run is a dashed, dimmed tile
 * saying what is missing ("Needs IP-Adapter nodes on winold"), never a broken queue; types that
 * do not fit the model family are not shown at all.
 */
import { IconX } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import type { StyleRefType } from '@/lib/styleRefs';
import { TypeIcon } from './typeIcons';
import type { TileState } from './styleTabLogic';

export function TypeTiles({ tiles, onPick, onClose }: { tiles: TileState[]; onPick: (t: StyleRefType) => void; onClose?: () => void }) {
  const phone = useIsPhone();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: phone ? 40 : 24 }}>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--il-muted)' }}>Add a reference</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" title="Close"
            style={{ width: phone ? 40 : 26, height: phone ? 40 : 26, display: 'grid', placeItems: 'center', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-muted)', cursor: 'pointer' }}>
            <IconX size={15} stroke={2.4} />
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {tiles.map((t) => (
          <button key={t.type} type="button" disabled={!t.ok} onClick={() => onPick(t.type)}
            style={{
              textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, padding: 10, minHeight: phone ? 0 : 96, borderRadius: T.radius.lg,
              background: 'var(--il-card)', border: `1px ${t.ok ? 'solid' : 'dashed'} var(--il-line-strong)`, color: 'var(--il-fg)',
              cursor: t.ok ? 'pointer' : 'not-allowed', opacity: t.ok ? 1 : 0.6, font: 'inherit',
            }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)' }}>
              <TypeIcon type={t.type} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{t.title}</span>
            <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.35, color: t.ok ? 'var(--il-muted)' : 'var(--il-warn)' }}>{t.ok ? t.line : t.note}</span>
            {t.ok && t.note && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-dim)' }}>{t.note}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
