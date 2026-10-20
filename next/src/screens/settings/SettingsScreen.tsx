/**
 * Settings, desktop: fills the area right of the rail.
 *
 *   ┌ 240 ───────────────┬──────────────────────────────────────┐
 *   │ Settings           │ <category title + one line>          │
 *   │ [🔍 Search settings]│ rows: label + hint … control         │
 *   │ ▸ Servers          │ (grouped under small titles)         │
 *   │ ▸ AI helper   ●    │                                      │
 *   │ …                  │ searching: hits under category names │
 *   └────────────────────┴──────────────────────────────────────┘
 *
 * The pane scrolls on its own (max 760 wide, centred). The open category is remembered
 * (settingsStore); Esc clears the search, Ctrl/⌘+F or "/" focuses it (useSettingsKeys).
 */
import { useRef } from 'react';
import { T } from '~/theme/tokens';
import { CategoryList } from './CategoryList';
import { CategoryPane } from './CategoryPane';
import { SearchResults } from './SearchResults';
import { SettingsSearch } from './SettingsSearch';
import { useSettingsUi } from './settingsStore';
import { useSettingsKeys } from './useSettingsKeys';

const SIDE = 240;

export function SettingsScreen() {
  const category = useSettingsUi((s) => s.category);
  const setCategory = useSettingsUi((s) => s.setCategory);
  const query = useSettingsUi((s) => s.query);
  const setQuery = useSettingsUi((s) => s.setQuery);
  const input = useRef<HTMLInputElement>(null);
  useSettingsKeys(input);
  const searching = !!query.trim();

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <aside style={{ width: SIDE, flex: 'none', display: 'flex', flexDirection: 'column', gap: T.gap.lg, padding: '14px 12px', borderRight: '1px solid var(--il-line)', background: 'var(--il-panel)' }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.2px', padding: '0 2px' }}>Settings</span>
        <SettingsSearch ref={input} />
        <CategoryList />
      </aside>
      <div className="il-scroll" style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', touchAction: 'pan-y' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px 24px 48px', boxSizing: 'border-box' }}>
          {searching
            ? <SearchResults onOpen={(c) => { setCategory(c); setQuery(''); }} />
            : <CategoryPane key={category} id={category} />}
        </div>
      </div>
    </div>
  );
}
