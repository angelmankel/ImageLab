/**
 * An equal-width choice row for the Composition tab (Model default · Custom; Model default ·
 * Picture size · Custom; the denoise presets): ember tint on the chosen one, 36 px (44 on the
 * phone) high, never wraps its text. An item's `sub` (a second small line: S "smaller") makes
 * the row 42 px (48 on the phone).
 */
import type { ReactNode } from 'react';
import { useIsPhone } from '~/app/useIsPhone';
import { btnRadius } from '~/theme/tokens';

export function Seg<K extends string>({ items, value, onChange, label }: {
  items: ReadonlyArray<{ key: K; label: ReactNode; title?: string; sub?: ReactNode }>; value: K | null; onChange: (k: K) => void; label: string;
}) {
  const phone = useIsPhone();
  const tall = items.some((it) => it.sub != null);
  const h = tall ? (phone ? 48 : 42) : phone ? 40 : 32;
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 4, padding: 4, borderRadius: `calc(${btnRadius(h)} + 4px)`, background: 'var(--il-bg-deep)' }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button key={it.key} type="button" role="radio" aria-checked={on} title={it.title} onClick={() => onChange(it.key)}
            style={{
              height: h, minWidth: 0, padding: '0 6px', border: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, lineHeight: 1.1, borderRadius: btnRadius(h), cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              background: on ? 'var(--il-ember-soft)' : 'transparent', boxShadow: on ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined,
              color: on ? 'var(--il-ember-hi)' : 'var(--il-fg2)', fontSize: 11.5, fontWeight: 800,
            }}>
            <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
            {it.sub != null && <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 9.5, fontWeight: 700, color: on ? 'var(--il-ember-hi)' : 'var(--il-muted)', opacity: on ? 0.85 : 1 }}>{it.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
