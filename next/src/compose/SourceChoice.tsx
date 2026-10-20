/**
 * Where a step 2+ gets its picture (fix list 41 + the step I/O standard of item 24): three equal
 * tap targets that say what they do — "My image" (upload / drop) · "Last from 1" (the previous
 * step's newest result, the default) · "Pick from 1" (one result you choose). Was Off / Auto · last
 * / Pick. ≥ 40 px high on every screen.
 */
import { btnRadius } from '~/theme/tokens';
import { sourceChoices, type SourceMode } from './inputLogic';

export function SourceChoice({ from, value, onChange }: { from: number; value: SourceMode; onChange: (m: SourceMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Where the picture comes from" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, padding: 4, borderRadius: `calc(${btnRadius(40)} + 4px)`, background: 'var(--il-bg-deep)' }}>
      {sourceChoices(from).map((c) => {
        const on = c.key === value;
        return (
          <button key={c.key} type="button" role="radio" aria-checked={on} title={c.title} onClick={() => onChange(c.key)}
            style={{
              minHeight: 42, minWidth: 0, padding: '3px 4px', border: 0, borderRadius: btnRadius(40), cursor: 'pointer',
              background: on ? 'var(--il-ember-soft)' : 'transparent', boxShadow: on ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined,
              color: on ? 'var(--il-ember-hi)' : 'var(--il-fg2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, lineHeight: 1.15,
            }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{c.label}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: on ? 'var(--il-ember-hi)' : 'var(--il-muted)', opacity: on ? 0.8 : 1, whiteSpace: 'nowrap' }}>{c.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
