/**
 * The desktop filter rows above the grid (Models-Desktop board + the picker brief):
 *   row 1 (52) search · SORT ▾ · PERIOD ▾ · NSFW ▾ · Filters (badge) · grid/list
 *   row 2 (44) Downloaded · ★ Favourites · TYPE chips (locked to the picker's kind) · BASE chips
 *              · Followed · Early access · Made on-site · Clear
 *   row 2b     every other filter (FilterFields), when "Filters" is open
 *   tags       the tag groups (TagsRow), an open group's tags
 *   row 3 (32) the active filters and picked tags, each removable · "128 models"
 */
import { useEffect, useRef, useState } from 'react';
import { IconFilter, IconLayoutGrid, IconList, IconSearch, IconX } from '@tabler/icons-react';
import { Sep } from '~/ui';
import type { CivitaiModel } from '@/lib/civitai';
import {
  MODEL_TYPES, MAIN_BASE_MODELS, SORTS, PERIODS, PERIOD_LABEL, NSFW_LEVELS, KIND_LABEL, typeLabel, baseModelShort, maskForLevel, levelForMask, toggleIn, activeFilters,
  type Sort, type Period, type NsfwLevelKey,
} from './civitaiQuery';
import { useModels } from './modelsStore';
import { FChip, Label, MenuPill } from './bits';
import { FilterFields } from './FilterFields';
import { TagsRow, SelectedTagChips } from './TagsRow';

export const ROW_TYPES = MODEL_TYPES.filter((t) => !['AestheticGradient', 'Detection', 'Other', 'DoRA'].includes(t));

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

export function FilterBar({ count, pool }: { count: string; pool: CivitaiModel[] }) {
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const clearAll = useModels((s) => s.clearAll);
  const clearOne = useModels((s) => s.clearOne);
  const kind = useModels((s) => s.kind);
  const view = useModels((s) => s.view);
  const setView = useModels((s) => s.setView);
  const moreOpen = useModels((s) => s.moreOpen);
  const setMoreOpen = useModels((s) => s.setMoreOpen);
  const tagCount = useModels((s) => s.selectedTags.length);
  const active = activeFilters(f).filter((a) => !(kind && a.key === 'types'));
  const total = active.length + tagCount;

  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px' }}>
        <SearchBox />
        <MenuPill<Sort> label="Sort" value={f.sort} onChange={(sort) => set({ sort })} options={SORTS.map((s) => ({ key: s, label: s }))} />
        <MenuPill<Period> label="Period" value={f.period} onChange={(period) => set({ period })} options={PERIODS.map((p) => ({ key: p, label: PERIOD_LABEL[p] }))} />
        <MenuPill<NsfwLevelKey> label="NSFW" value={levelForMask(f.nsfwMask)} onChange={(k) => set({ nsfwMask: maskForLevel(k) })} options={NSFW_LEVELS.map((l) => ({ key: l.key, label: l.label }))} />
        <button
          type="button"
          aria-pressed={moreOpen}
          onClick={() => setMoreOpen(!moreOpen)}
          style={{ height: 36, padding: '0 12px', border: `1px solid ${moreOpen ? 'var(--il-ember)' : 'var(--il-line-strong)'}`, borderRadius: 999, background: 'transparent', color: moreOpen ? 'var(--il-ember)' : 'var(--il-fg)', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flex: 'none', cursor: 'pointer' }}
        >
          <IconFilter size={15} stroke={2.2} />Filters
          {total > 0 && <span style={{ background: 'var(--il-ember)', color: 'var(--il-bg)', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{total}</span>}
        </button>
        <Sep />
        <div role="group" aria-label="View" style={{ display: 'flex', gap: 2, background: 'var(--il-elev)', borderRadius: 999, padding: 3, flex: 'none' }}>
          {(['grid', 'list'] as const).map((v) => (
            <button key={v} type="button" aria-label={`${v} view`} aria-pressed={view === v} onClick={() => setView(v)} style={{ width: 30, height: 30, border: 0, borderRadius: '50%', background: view === v ? 'var(--il-card-on)' : 'transparent', color: view === v ? 'var(--il-fg)' : 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              {v === 'grid' ? <IconLayoutGrid size={15} stroke={2.2} /> : <IconList size={15} stroke={2.4} />}
            </button>
          ))}
        </div>
      </div>

      <div className="il-scroll-x" style={{ height: 44, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', whiteSpace: 'nowrap' }}>
        <SourceChips />
        <Sep />
        <Label style={{ marginRight: 2 }}>TYPE</Label>
        {kind
          ? <FChip on title="The step asked for this kind">{KIND_LABEL[kind]}</FChip>
          : ROW_TYPES.map((t) => <FChip key={t} on={f.types.includes(t)} onClick={() => set({ types: toggleIn(f.types, t) })}>{typeLabel(t)}</FChip>)}
        <Sep />
        <Label style={{ marginRight: 2 }}>BASE</Label>
        {MAIN_BASE_MODELS.map((b) => <FChip key={b} on={f.baseModels.includes(b)} onClick={() => set({ baseModels: toggleIn(f.baseModels, b) })}>{baseModelShort(b)}</FChip>)}
        <Sep />
        <FChip dot on={f.followed} onClick={() => set({ followed: !f.followed })}>Followed creators</FChip>
        <FChip dot on={f.earlyAccess === 'only'} onClick={() => set({ earlyAccess: f.earlyAccess === 'only' ? 'any' : 'only' })}>Early access</FChip>
        <FChip dot on={f.supportsGeneration} onClick={() => set({ supportsGeneration: !f.supportsGeneration })}>Made on-site</FChip>
        {total > 0 && <button type="button" onClick={clearAll} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 11, fontWeight: 700, marginLeft: 4, flex: 'none', cursor: 'pointer', padding: 0 }}>Clear</button>}
      </div>

      {moreOpen && (
        <div className="il-scroll" style={{ margin: '0 12px 6px', padding: 10, borderRadius: 14, background: 'var(--il-panel)', border: '1px solid var(--il-line)', maxHeight: '42vh' }}>
          <FilterFields f={f} set={set} size="desktop" inline lockedKind={kind} />
        </div>
      )}

      <TagsRow pool={pool} />

      <div className="il-scroll-x" style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', whiteSpace: 'nowrap' }}>
        {total > 0 ? <span>{total} filter{total === 1 ? '' : 's'}</span> : <span>No filters</span>}
        <SelectedTagChips />
        {active.map((a) => (
          <span key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--il-fg2)' }}>
            <span style={{ color: 'var(--il-muted)' }}>·</span>
            <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</span>
            <button type="button" aria-label={`Remove ${a.label} filter`} onClick={() => clearOne(a.key)} style={{ width: 18, height: 18, padding: 0, border: 0, borderRadius: '50%', background: 'var(--il-card)', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <IconX size={9} stroke={3} />
            </button>
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ flex: 'none' }}>{count}</span>
      </div>
    </div>
  );
}
