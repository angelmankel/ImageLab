/**
 * The desktop filter rows above the grid (Models board, rule 13; Donny's 10-20 layout):
 *   row 1 (52) search · [SORT ▾ · PERIOD ▾ · MAX RATING ▾] one grouped control · grid/list
 *   row 2 (44) Source ▾ · Type ▾ · Base ▾ · Tags ▾ · More ▾ (FilterMenus) · the count when row 3 is hidden
 *   row 3 (32) the active filters and picked tags, each removable · Clear all · "128 models"
 * Every setting the old chip wall and Filters panel had now lives in one of row 2's menus.
 * `SearchBox` and `SourceChips` are shared with the phone's browse page.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconLayoutGrid, IconList, IconSearch, IconX } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import type { CivitaiModel } from '@/lib/civitai';
import { SORTS, PERIODS, PERIOD_LABEL, NSFW_LEVELS, maskForLevel, levelForMask, type Sort, type Period, type NsfwLevelKey } from './civitaiQuery';
import { activeChips, type ActiveChip } from './filterSummary';
import { useModels } from './modelsStore';
import { FChip, MenuPill } from './bits';
import { SourceMenu, TypeMenu, BaseMenu, TagsMenu, MoreMenu } from './FilterMenus';
import { SelectedTagChips } from './TagsRow';

/** Sideways scrollers never page the phone shell and keep both pan axes. */
const SIDEWAYS = { touchAction: 'pan-x pan-y' } as const;

/** The search box: local text, the store's `query` after 350 ms of quiet. Matches names, tags and creators. */
export function SearchBox({ height = 36, fontSize = 12, autoFocus }: { height?: number; fontSize?: number; autoFocus?: boolean }) {
  const query = useModels((s) => s.filters.query);
  const setFilters = useModels((s) => s.setFilters);
  const [text, setText] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setText(query), [query]);
  const commit = (v: string) => { if (timer.current) clearTimeout(timer.current); if (v.trim() !== query) setFilters({ query: v.trim() }); };
  return (
    <label style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 160, height, borderRadius: 999, background: 'var(--il-elev)', padding: '0 12px', gap: 8, color: 'var(--il-muted)' }}>
      <IconSearch size={15} stroke={2.4} />
      <input
        value={text}
        autoFocus={autoFocus}
        placeholder="Search CivitAI — name, tag, creator…"
        aria-label="Search CivitAI"
        onChange={(e) => { setText(e.target.value); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => commit(e.target.value), 350); }}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(text); if (e.key === 'Escape') { setText(''); commit(''); } }}
        style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize, fontWeight: 600, outline: 'none', padding: 0 }}
      />
      {text && <button type="button" aria-label="Clear search" onClick={() => { setText(''); commit(''); }} style={{ border: 0, background: 'transparent', color: 'var(--il-muted)', padding: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={14} stroke={2.4} /></button>}
    </label>
  );
}

/** Downloaded (what is on the pod) · ★ Favourites — the two chips every surface starts with. */
export function SourceChips({ size = 'desktop' as const }: { size?: 'desktop' | 'phone' }) {
  const source = useModels((s) => s.source);
  const setSource = useModels((s) => s.setSource);
  const favorites = useModels((s) => s.filters.favorites);
  const set = useModels((s) => s.setFilters);
  const favCount = useModels((s) => s.favourites.length);
  return (
    <>
      <FChip size={size} dot={size === 'desktop'} tall on={source === 'installed'} onClick={() => setSource(source === 'installed' ? 'civitai' : 'installed')} title="Only what is on the pod">Downloaded</FChip>
      <FChip size={size} dot={size === 'desktop'} tall on={favorites} onClick={() => set({ favorites: !favorites })} title="Models you ♥ here (kept in this browser, across pods)">★ Favourites{favCount ? ` · ${favCount}` : ''}</FChip>
    </>
  );
}

/** Sort · Period · NSFW as one rounded control: three compact selects, hairlines between. */
function SortGroup() {
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const line = <span aria-hidden style={{ width: 1, height: 18, background: 'var(--il-line-strong)', flex: 'none' }} />;
  return (
    <div role="group" aria-label="Sort and limits" style={{ height: 36, flex: 'none', display: 'flex', alignItems: 'center', borderRadius: T.radius.pill, background: 'var(--il-elev)', overflow: 'hidden' }}>
      <MenuPill<Sort> bare label="Sort" value={f.sort} onChange={(sort) => set({ sort })} options={SORTS.map((s) => ({ key: s, label: s }))} />
      {line}
      <MenuPill<Period> bare label="Period" value={f.period} onChange={(period) => set({ period })} options={PERIODS.map((p) => ({ key: p, label: PERIOD_LABEL[p] }))} />
      {line}
      <MenuPill<NsfwLevelKey> bare label="Max rating" value={levelForMask(f.nsfwMask)} onChange={(k) => set({ nsfwMask: maskForLevel(k) })} options={NSFW_LEVELS.map((l) => ({ key: l.key, label: l.label }))} />
    </div>
  );
}

function ViewToggle() {
  const view = useModels((s) => s.view);
  const setView = useModels((s) => s.setView);
  return (
    <div role="group" aria-label="View" style={{ height: 36, display: 'flex', alignItems: 'center', gap: 2, background: 'var(--il-elev)', borderRadius: T.radius.pill, padding: 3, flex: 'none' }}>
      {(['grid', 'list'] as const).map((v) => (
        <button key={v} type="button" aria-label={`${v} view`} aria-pressed={view === v} onClick={() => setView(v)} style={{ width: 30, height: 30, border: 0, borderRadius: '50%', background: view === v ? 'var(--il-card-on)' : 'transparent', color: view === v ? 'var(--il-fg)' : 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          {v === 'grid' ? <IconLayoutGrid size={15} stroke={2.2} /> : <IconList size={15} stroke={2.4} />}
        </button>
      ))}
    </div>
  );
}

/** One removable active filter: "Downloaded ×". */
function ActivePill({ chip, onRemove }: { chip: ActiveChip; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: T.gap.xs, height: 22, padding: '0 4px 0 9px', borderRadius: T.radius.pill, background: 'var(--il-card)', border: '1px solid var(--il-line-strong)', color: 'var(--il-fg2)', fontSize: 11, fontWeight: 700, flex: 'none' }}>
      <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{chip.label}</span>
      <button type="button" aria-label={`Remove ${chip.label} filter`} onClick={onRemove} style={{ width: 16, height: 16, padding: 0, border: 0, borderRadius: '50%', background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <IconX size={10} stroke={3} />
      </button>
    </span>
  );
}

function Count({ children }: { children: ReactNode }) {
  return <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', whiteSpace: 'nowrap' }}>{children}</span>;
}

export function FilterBar({ count, pool }: { count: string; pool: CivitaiModel[] }) {
  const f = useModels((s) => s.filters);
  const source = useModels((s) => s.source);
  const setSource = useModels((s) => s.setSource);
  const kind = useModels((s) => s.kind);
  const clearAll = useModels((s) => s.clearAll);
  const clearOne = useModels((s) => s.clearOne);
  const tagCount = useModels((s) => s.selectedTags.length);
  const active = activeChips(f, source, kind);
  const any = active.length + tagCount > 0;
  const remove = (c: ActiveChip) => (c.key === 'source' ? setSource('civitai') : clearOne(c.key));
  const clearEverything = () => { if (source === 'installed') setSource('civitai'); clearAll(); };

  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: T.gap.md, padding: '0 12px' }}>
        <SearchBox />
        <SortGroup />
        <ViewToggle />
      </div>

      <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: T.gap.md, padding: '0 12px' }}>
        <div className="il-scroll-x" data-no-swipe style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: T.gap.sm, whiteSpace: 'nowrap', ...SIDEWAYS }}>
          <SourceMenu />
          <TypeMenu />
          <BaseMenu />
          <TagsMenu pool={pool} />
          <MoreMenu />
        </div>
        {!any && <Count>{count}</Count>}
      </div>

      {any && (
        <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: T.gap.md, padding: '0 12px' }}>
          <div className="il-scroll-x" data-no-swipe style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: T.gap.sm, whiteSpace: 'nowrap', ...SIDEWAYS }}>
            {active.map((c) => <ActivePill key={c.key} chip={c} onRemove={() => remove(c)} />)}
            <SelectedTagChips />
            <button type="button" onClick={clearEverything} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 11, fontWeight: 700, marginLeft: T.gap.xs, flex: 'none', cursor: 'pointer', padding: 0 }}>Clear all</button>
          </div>
          <Count>{count}</Count>
        </div>
      )}
    </div>
  );
}
