/**
 * The settings search pill (the library's look): filters every category at once. Esc clears it;
 * Ctrl/⌘+F or "/" focus it while the page is open (useSettingsKeys).
 */
import { forwardRef, type CSSProperties } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useSettingsUi } from './settingsStore';

export const SettingsSearch = forwardRef<HTMLInputElement, { style?: CSSProperties; autoFocus?: boolean }>(function SettingsSearch({ style, autoFocus }, ref) {
  const query = useSettingsUi((s) => s.query);
  const setQuery = useSettingsUi((s) => s.setQuery);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-muted)', ...style }}>
      <IconSearch size={15} stroke={2.4} style={{ flex: 'none' }} />
      <input
        ref={ref}
        type="search"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Search settings"
        aria-label="Search settings"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); } }}
        style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 12, fontWeight: 600, outline: 'none', padding: 0 }}
      />
      {query && (
        <button type="button" aria-label="Clear search" onClick={() => setQuery('')} style={{ border: 0, background: 'transparent', color: 'var(--il-muted)', padding: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <IconX size={14} stroke={2.4} />
        </button>
      )}
    </label>
  );
});
