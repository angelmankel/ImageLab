/**
 * Settings, desktop: the category list under the search (icon + name; the open one is an ember
 * pill like the rail). While searching, categories with no match dim and the others show their
 * count. A small ember dot marks a category that wants attention (the AI helper's active provider not
 * set up; no server online).
 */
import { useStore } from '@/lib/store';
import { aiReady } from '@/lib/aiProviders';
import { Count, Dot } from '~/ui';
import { CATEGORIES, type CategoryId } from './categories';
import { countByCategory } from './settingsLogic';
import { ALL_ROWS } from './registry';
import { useSettingsUi } from './settingsStore';
import { useServersUp } from './useServersUp';

/** Which categories want attention right now. Servers: none answering; AI: the picked provider is not usable. */
export function useAttention(): Partial<Record<CategoryId, boolean>> {
  const servers = useStore((s) => s.servers);
  const up = useServersUp(servers);
  const ai = useStore((s) => s.ai);
  const anyUp = servers.some((s) => s.enabled !== false && up[s.id]);
  return { servers: !anyUp, ai: !aiReady(ai) };
}

export function CategoryList() {
  const category = useSettingsUi((s) => s.category);
  const setCategory = useSettingsUi((s) => s.setCategory);
  const query = useSettingsUi((s) => s.query);
  const setQuery = useSettingsUi((s) => s.setQuery);
  const attention = useAttention();
  const counts = query.trim() ? countByCategory(ALL_ROWS, query) : null;
  return (
    <nav aria-label="Settings categories" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {CATEGORIES.map((c) => {
        const on = !counts && c.id === category;
        const n = counts ? counts[c.id] : 0;
        const dim = !!counts && n === 0;
        return (
          <button
            key={c.id}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => { setCategory(c.id); if (counts) setQuery(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 10px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
              border: `1px solid ${on ? 'var(--il-ember-line)' : 'transparent'}`, background: on ? 'var(--il-ember-soft)' : 'transparent',
              color: on ? 'var(--il-ember-hi)' : 'var(--il-fg2)', fontSize: 13, fontWeight: on ? 800 : 700, opacity: dim ? 0.4 : 1,
            }}
          >
            <c.icon size={17} stroke={2.1} />
            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
            {counts ? (n > 0 && <Count n={n} tone="muted" />) : attention[c.id] && <Dot color="var(--il-ember)" size={6} />}
          </button>
        );
      })}
    </nav>
  );
}
