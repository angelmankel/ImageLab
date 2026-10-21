/**
 * Settings in the phone map (mobile pass, m-shell; Donny 10-21). Three layers:
 *   'settings'          Settings · search · one big row per category (current values in a line)
 *   'settings-category' a category's rows on a card; swipe sideways = the next / previous category
 *   'settings-provider' one AI provider (from the AI helper category)
 * Pull the card down (or "‹" in the band) to go back out. No hash entries: the map is the history.
 */
import { useRef } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { providerSpec, isProviderId, type AiProviderId } from '@/lib/aiProviders';
import { phoneNav } from '~/phone/nav/navStore';
import { registerPhonePage } from '~/phone/nav/pages';
import { T } from '~/theme/tokens';
import { CATEGORIES, categoryById, type CategoryId } from './categories';
import { CategoryPane } from './CategoryPane';
import { CategorySummary } from './CategorySummary';
import { ProviderPage } from './ai/ProviderPage';
import { SearchResults } from './SearchResults';
import { SettingsSearch } from './SettingsSearch';
import { useSettingsUi } from './settingsStore';
import { useSettingsKeys } from './useSettingsKeys';

const openCategory = (id: CategoryId) => phoneNav.push('settings-category', { id });

function CategoryRow({ id }: { id: CategoryId }) {
  const c = categoryById(id);
  return (
    <button type="button" onClick={() => openCategory(id)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 64, padding: '8px 12px', border: '1px solid var(--il-line)', borderRadius: 16, background: 'var(--il-panel)', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--il-ember-soft)', color: 'var(--il-ember)', display: 'grid', placeItems: 'center', flex: 'none' }}>
        <c.icon size={20} stroke={2.1} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{c.label}</span>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><CategorySummary id={id} /></span>
      </span>
      <IconChevronRight size={18} stroke={2.2} style={{ color: 'var(--il-dim)', flex: 'none' }} />
    </button>
  );
}

function SettingsListPage() {
  const query = useSettingsUi((s) => s.query);
  const setQuery = useSettingsUi((s) => s.setQuery);
  const input = useRef<HTMLInputElement>(null);
  useSettingsKeys(input);
  const searching = !!query.trim();
  return (
    <div className="il-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', padding: '0 12px 16px' }}>
      <div style={{ padding: '4px 2px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SettingsSearch ref={input} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.sm }}>
        {searching
          ? <SearchResults onOpen={(c) => { setQuery(''); openCategory(c); }} />
          : CATEGORIES.map((c) => <CategoryRow key={c.id} id={c.id} />)}
      </div>
    </div>
  );
}

function CategoryPage({ params }: { params: { id: CategoryId } }) {
  return (
    <div className="il-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', padding: '4px 14px 20px' }}>
      <CategoryPane id={params.id} header={false} />
    </div>
  );
}

function ProviderCard({ params }: { params: { id: AiProviderId } }) {
  return (
    <div className="il-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', padding: '4px 14px 20px' }}>
      <ProviderPage id={params.id} onBack={() => phoneNav.pop()} header={false} />
    </div>
  );
}

const ids = CATEGORIES.map((c) => c.id);

registerPhonePage('settings', { Component: SettingsListPage, title: () => 'Settings', screen: 'settings' });
registerPhonePage<{ id: CategoryId }>('settings-category', {
  Component: CategoryPage,
  title: (p) => categoryById(p.id)?.label ?? 'Settings',
  screen: 'settings',
  siblings: (p) => ({ count: ids.length, index: ids.indexOf(p.id), at: (i) => ({ kind: 'settings-category', params: { id: ids[i] } }) }),
});
registerPhonePage<{ id: AiProviderId }>('settings-provider', {
  Component: ProviderCard,
  title: (p) => (isProviderId(p.id) ? providerSpec(p.id).name : 'AI provider'),
  screen: 'settings',
});
