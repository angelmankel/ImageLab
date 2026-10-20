/**
 * One category's settings: its title and one-line description (optional: the phone's top bar
 * carries the title), then its rows, under small group titles when the category has many.
 */
import { categoryById, type CategoryId } from './categories';
import { groupedRows, rowsOf } from './registry';
import { RowGroup, SettingRow } from './SettingRow';

export function CategoryPane({ id, header = true }: { id: CategoryId; header?: boolean }) {
  const cat = categoryById(id);
  const groups = groupedRows(rowsOf(id));
  return (
    <div>
      {header ? (
        <div style={{ padding: '0 0 14px' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.2px' }}>{cat.label}</h2>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', marginTop: 3, lineHeight: 1.45 }}>{cat.description}</div>
        </div>
      ) : (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', padding: '0 0 10px', lineHeight: 1.45 }}>{cat.description}</div>
      )}
      {groups.map((g, gi) => (
        <RowGroup key={g.title ?? `_${gi}`} title={g.title}>
          {g.rows.map((r, i) => <SettingRow key={r.id} def={r} first={i === 0} />)}
        </RowGroup>
      ))}
    </div>
  );
}
