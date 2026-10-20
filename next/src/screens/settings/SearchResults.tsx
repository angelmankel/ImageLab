/**
 * What a search shows: the matching rows grouped under their category name (click the name to
 * open that category), the hits lit in the label and hint. Nothing matching → a quiet note.
 */
import { IconChevronRight } from '@tabler/icons-react';
import { categoryById, type CategoryId } from './categories';
import { ALL_ROWS } from './registry';
import { groupByCategory, searchRows } from './settingsLogic';
import { SettingRow } from './SettingRow';
import { useSettingsUi } from './settingsStore';

export function SearchResults({ onOpen }: { onOpen: (c: CategoryId) => void }) {
  const query = useSettingsUi((s) => s.query);
  const groups = groupByCategory(searchRows(ALL_ROWS, query));
  if (!groups.length) {
    return <div style={{ padding: '24px 0', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', textAlign: 'center' }}>No setting matches “{query.trim()}”.</div>;
  }
  return (
    <div>
      {groups.map((g) => {
        const cat = categoryById(g.category);
        return (
          <section key={g.category} style={{ marginBottom: 18 }}>
            <button type="button" onClick={() => onOpen(g.category)} aria-label={`Open ${cat.label}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '0 0 6px', border: 0, borderBottom: '1px solid var(--il-line-strong)', background: 'transparent', color: 'var(--il-ember)', fontSize: 12, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>
              <cat.icon size={14} stroke={2.2} />
              {cat.label}
              <IconChevronRight size={14} stroke={2.4} />
            </button>
            {g.rows.map((r, i) => <SettingRow key={r.id} def={r} query={query} first={i === 0} />)}
          </section>
        );
      })}
    </div>
  );
}
