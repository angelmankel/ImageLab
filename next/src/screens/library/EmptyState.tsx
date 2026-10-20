/** Library (rule 12): what the grid says when nothing matches. */
import { useLibrary } from './libraryStore';

export function EmptyState({ total }: { total: number }) {
  const search = useLibrary((s) => s.search);
  const filtered = total > 0;
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '64px 16px', textAlign: 'center', color: 'var(--il-muted)', fontSize: 13, fontWeight: 600 }}>
      {filtered ? (search ? `Nothing matches “${search}”.` : 'Nothing here with these filters.') : 'Nothing generated yet. What you make shows up here.'}
    </div>
  );
}
