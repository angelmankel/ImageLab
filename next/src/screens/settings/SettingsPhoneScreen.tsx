/**
 * Settings on the phone (rule 11: no dock, the centred Back pill leaves Settings).
 *
 *   list page:   Settings · [🔍 Search settings] · one big row per category (icon, name, the
 *                current values in one line, chevron); typing shows the matching rows inline.
 *   category:    a "‹ Back" bar with the title, then the rows, full screen.
 *
 * Opening a category pushes `#/settings/<id>` (settingsLogic.categoryOfHash), so Android back
 * pops it; a swipe to the right (`@/hooks/useSwipe`, as the other phone pages) goes back too.
 */
import { useEffect, useRef, useState } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { useSwipe } from '@/hooks/useSwipe';
import { useRoute } from '~/app/routeStore';
import { T } from '~/theme/tokens';
import { BackPill } from '~/ui';
import { CATEGORIES, categoryById, type CategoryId } from './categories';
import { CategoryPane } from './CategoryPane';
import { CategorySummary } from './CategorySummary';
import { SearchResults } from './SearchResults';
import { SettingsSearch } from './SettingsSearch';
import { categoryOfHash, hashOfCategory } from './settingsLogic';
import { useSettingsUi } from './settingsStore';
import { useSettingsKeys } from './useSettingsKeys';

const TOP = `calc(${T.pad.panel}px + env(safe-area-inset-top, 0px))`;

/** The open category, from the hash: `open(id)` pushes a history entry, `close()` pops it. */
function useOpenCategory() {
  const read = () => (typeof location === 'undefined' ? null : categoryOfHash(location.hash));
  const [open, setOpen] = useState<CategoryId | null>(read);
  const pushed = useRef(false);
  useEffect(() => {
    const onHash = () => setOpen(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return {
    open,
    show: (id: CategoryId) => { pushed.current = true; location.hash = hashOfCategory(id); },
    close: () => {
      if (pushed.current) { pushed.current = false; history.back(); return; }
      history.replaceState(null, '', hashOfCategory(null));
      setOpen(null);
    },
  };
}

function CategoryRow({ id, onOpen }: { id: CategoryId; onOpen: () => void }) {
  const c = categoryById(id);
  return (
    <button type="button" onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60, padding: '8px 10px', border: 0, borderRadius: 14, background: 'transparent', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer' }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--il-card)', color: 'var(--il-ember)', display: 'grid', placeItems: 'center', flex: 'none' }}>
        <c.icon size={19} stroke={2.1} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{c.label}</span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><CategorySummary id={id} /></span>
      </span>
      <IconChevronRight size={18} stroke={2.2} style={{ color: 'var(--il-dim)', flex: 'none' }} />
    </button>
  );
}

function CategoryPage({ id, onBack }: { id: CategoryId; onBack: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useSwipe(root, { dir: 1, enabled: true, onSwipe: onBack });
  const c = categoryById(id);
  return (
    <div ref={root} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)', touchAction: 'pan-y' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: `${TOP} 8px 8px`, borderBottom: '1px solid var(--il-line)' }}>
        <button type="button" onClick={onBack} data-pad-back aria-label="Back to Settings"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: '0 10px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-ember)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
          <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>‹</span>Back
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: `10px 14px calc(24px + var(--il-safe-bottom))`, touchAction: 'pan-y' }}>
        <CategoryPane id={id} header={false} />
      </div>
    </div>
  );
}

export function SettingsPhoneScreen() {
  const go = useRoute((s) => s.go);
  const query = useSettingsUi((s) => s.query);
  const setQuery = useSettingsUi((s) => s.setQuery);
  const input = useRef<HTMLInputElement>(null);
  useSettingsKeys(input);
  const { open, show, close } = useOpenCategory();

  if (open) return <CategoryPage key={open} id={open} onBack={close} />;

  const searching = !!query.trim();
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ flex: 'none', padding: `${TOP} 14px 8px`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 18, lineHeight: '36px' }}>Settings</span>
        <SettingsSearch ref={input} />
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: `4px ${searching ? 14 : 6}px calc(84px + var(--il-safe-bottom))`, touchAction: 'pan-y' }}>
        {searching
          ? <SearchResults onOpen={(c) => { setQuery(''); show(c); }} />
          : CATEGORIES.map((c) => <CategoryRow key={c.id} id={c.id} onOpen={() => show(c.id)} />)}
      </div>
      <BackPill onClick={() => go('step')} />
    </div>
  );
}
