/** Library (rule 12): the search pill — prompts, negatives, models, seeds, file names, tags. */
import type { CSSProperties } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useLibrary } from './libraryStore';

export function SearchBox({ style }: { style?: CSSProperties }) {
  const search = useLibrary((s) => s.search);
  const setSearch = useLibrary((s) => s.setSearch);
  return (
    <label className="lib-search" style={style}>
      <IconSearch size={15} stroke={2.4} style={{ flex: 'none' }} />
      <input type="search" value={search} onChange={(e) => setSearch(e.currentTarget.value)} placeholder="Search prompts, models…" aria-label="Search"
        onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); e.currentTarget.blur(); } }} />
      {search && (
        <button type="button" aria-label="Clear search" onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: 'var(--il-muted)', padding: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <IconX size={14} stroke={2.4} />
        </button>
      )}
    </label>
  );
}
