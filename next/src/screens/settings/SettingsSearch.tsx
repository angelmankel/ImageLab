/**
 * The settings search pill (the library's look): filters every category at once. Esc clears it;
 * Ctrl/⌘+F or "/" focus it while the page is open (useSettingsKeys).
 */
import { forwardRef, type CSSProperties } from 'react';
import { SearchField } from '~/ui/SearchField';
import { useSettingsUi } from './settingsStore';

export const SettingsSearch = forwardRef<HTMLInputElement, { style?: CSSProperties; autoFocus?: boolean }>(function SettingsSearch({ style, autoFocus }, ref) {
  const query = useSettingsUi((s) => s.query);
  const setQuery = useSettingsUi((s) => s.setQuery);
  return <SearchField ref={ref} value={query} onChange={setQuery} placeholder="Search settings" autoFocus={autoFocus} style={style} />;
});
