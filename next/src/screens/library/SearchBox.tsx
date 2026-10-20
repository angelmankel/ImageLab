/** Library (rule 12): the search pill — prompts, negatives, models, seeds, file names, tags. */
import type { CSSProperties } from 'react';
import { SearchField } from '~/ui/SearchField';
import { useLibrary } from './libraryStore';

export function SearchBox({ style }: { style?: CSSProperties }) {
  const search = useLibrary((s) => s.search);
  const setSearch = useLibrary((s) => s.setSearch);
  return <SearchField value={search} onChange={setSearch} placeholder="Search prompts, models…" label="Search" style={style} />;
}
