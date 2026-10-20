/**
 * Row 2 of the desktop filter bar (Donny's 10-20 layout): Source · Type · Base · Tags · More, each a
 * labelled `FilterMenu` chip whose value comes from `filterSummary.ts`. Every setting the old chip
 * wall and the Filters panel had is in one of these menus, on the same store fields:
 *   Source  a segmented control, not a menu (Donny 10-20): CivitAI · Downloaded · ★ Favourites ·
 *           Account ★ — one at a time (`source` + `filters.favorites` / `accountFavorites`)
 *   Type    the row types + other types; fixed with a lock when the step asked for a kind
 *   Base    the main base models, the long tail folded under "More base models"
 *   Tags    the tag groups of the loaded models (`TagGroups`)
 *   More    Followed creators · Early access · Made on-site, then "More filters" = `FilterFields`
 */
import { useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import type { CivitaiModel } from '@/lib/civitai';
import { T } from '~/theme/tokens';
import { MAIN_BASE_MODELS, MORE_BASE_MODELS, typeLabel, baseModelShort, toggleIn } from './civitaiQuery';
import { ROW_TYPES, OTHER_TYPES, typeChip, baseChip, tagsChip, moreChip, hasMoreBase } from './filterSummary';
import { useModels } from './modelsStore';
import { hasApiKey } from './civitaiApi';
import { FilterMenu, MenuHead, MenuSep, CheckRow, CheckGrid } from './FilterMenu';
import { FilterFields } from './FilterFields';
import { TagGroups } from './TagsRow';

/** A folding section inside a menu ("More base models", "More filters"). */
function Fold({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} style={{ width: '100%', height: 30, padding: '0 8px', border: 0, borderRadius: T.radius.xs, background: 'transparent', color: 'var(--il-fg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
      {label}
      <IconChevronDown size={13} stroke={2.6} style={{ color: 'var(--il-muted)', transform: open ? 'rotate(180deg)' : undefined }} />
    </button>
  );
}

type SourcePick = 'civitai' | 'installed' | 'favourites' | 'account';

export function SourceMenu() {
  const source = useModels((s) => s.source);
  const setSource = useModels((s) => s.setSource);
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const favCount = useModels((s) => s.favourites.length);
  const keyed = hasApiKey();
  const value: SourcePick = source === 'installed' ? 'installed' : f.accountFavorites ? 'account' : f.favorites ? 'favourites' : 'civitai';
  const pick = (v: SourcePick) => {
    setSource(v === 'installed' ? 'installed' : 'civitai');
    set({ favorites: v === 'favourites', accountFavorites: v === 'account' });
  };
  const items: Array<{ key: SourcePick; label: string; title: string }> = [
    { key: 'civitai', label: 'CivitAI', title: 'Everything on CivitAI' },
    { key: 'installed', label: 'Downloaded', title: 'What is on the server' },
    { key: 'favourites', label: `★ Favourites${favCount ? ` ${favCount}` : ''}`, title: 'Models you ♥ here (this browser, across pods)' },
    { key: 'account', label: 'Account ★', title: keyed ? "The key's favourites on civitai.com" : 'Needs the API key (Settings → CivitAI)' },
  ];
  return (
    <div role="radiogroup" aria-label="Source" style={{ display: 'flex', gap: 2, padding: 3, height: 36, boxSizing: 'border-box', borderRadius: 999, background: 'var(--il-bg-deep)', flex: 'none' }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button key={it.key} type="button" role="radio" aria-checked={on} title={it.title} onClick={() => pick(it.key)}
            style={{ height: 30, padding: '0 12px', border: 0, borderRadius: 999, background: on ? 'var(--il-ember)' : 'transparent', color: on ? 'var(--il-bg)' : 'var(--il-muted)', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function TypeMenu() {
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const kind = useModels((s) => s.kind);
  const chip = typeChip(f, kind);
  if (chip.locked) {
    return (
      <FilterMenu label="Type" value={chip.value} on locked width={240} title="The step asked for this kind">
        <MenuHead>TYPE</MenuHead>
        <CheckRow label={chip.value} on disabled hint="Locked: the step asked for this kind" />
      </FilterMenu>
    );
  }
  const row = (t: (typeof ROW_TYPES)[number]) => <CheckRow key={t} label={typeLabel(t)} on={f.types.includes(t)} onChange={() => set({ types: toggleIn(f.types, t) })} />;
  return (
    <FilterMenu label="Type" value={chip.value} on={chip.on} width={300}>
      <MenuHead onClear={chip.count ? () => set({ types: [] }) : undefined}>TYPE</MenuHead>
      <CheckGrid>{ROW_TYPES.map(row)}</CheckGrid>
      <MenuSep />
      <MenuHead>OTHER TYPES</MenuHead>
      <CheckGrid>{OTHER_TYPES.map(row)}</CheckGrid>
    </FilterMenu>
  );
}

export function BaseMenu() {
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const chip = baseChip(f);
  const [more, setMore] = useState(() => hasMoreBase(f));
  const row = (b: string) => <CheckRow key={b} label={baseModelShort(b)} on={f.baseModels.includes(b)} onChange={() => set({ baseModels: toggleIn(f.baseModels, b) })} />;
  return (
    <FilterMenu label="Base" value={chip.value} on={chip.on} width={300}>
      <MenuHead onClear={chip.count ? () => set({ baseModels: [] }) : undefined}>BASE MODEL</MenuHead>
      <CheckGrid>{MAIN_BASE_MODELS.map(row)}</CheckGrid>
      <MenuSep />
      <Fold label={`More base models · ${MORE_BASE_MODELS.length}`} open={more || hasMoreBase(f)} onToggle={() => setMore(!(more || hasMoreBase(f)))} />
      {(more || hasMoreBase(f)) && <div className="il-scroll" style={{ maxHeight: 240 }}><CheckGrid>{MORE_BASE_MODELS.map(row)}</CheckGrid></div>}
    </FilterMenu>
  );
}

export function TagsMenu({ pool }: { pool: CivitaiModel[] }) {
  const selected = useModels((s) => s.selectedTags);
  const clearTags = useModels((s) => s.clearTags);
  const chip = tagsChip(selected);
  return (
    <FilterMenu label="Tags" value={chip.value} on={chip.on} width={420}>
      <MenuHead onClear={chip.count ? clearTags : undefined}>TAGS OF THE LOADED MODELS</MenuHead>
      <div style={{ padding: `${T.gap.xs}px ${T.gap.sm}px ${T.gap.sm}px` }}>
        <TagGroups pool={pool} size="desktop" autoOpen />
      </div>
    </FilterMenu>
  );
}

export function MoreMenu() {
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const kind = useModels((s) => s.kind);
  const open = useModels((s) => s.moreOpen);
  const setOpen = useModels((s) => s.setMoreOpen);
  const chip = moreChip(f);
  const keyed = hasApiKey();
  return (
    <FilterMenu label="More" value={chip.value} on={chip.on} width={open ? 540 : 300}>
      <MenuHead>MORE</MenuHead>
      <CheckRow label="Followed creators" hint={keyed ? 'Creators you follow on CivitAI' : 'Creators you follow here (no API key: local list)'} on={f.followed} onChange={(followed) => set({ followed })} />
      <CheckRow label="Early access" hint="Only models still in early access" on={f.earlyAccess === 'only'} onChange={(on) => set({ earlyAccess: on ? 'only' : 'any' })} />
      <CheckRow label="Made on-site" hint="Models CivitAI can generate with" on={f.supportsGeneration} onChange={(supportsGeneration) => set({ supportsGeneration })} />
      <MenuSep />
      <Fold label="More filters… licence, files, rating, creator" open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div className="il-scroll" style={{ maxHeight: '52vh', padding: `${T.gap.xs}px ${T.gap.md}px ${T.gap.md}px` }}>
          <FilterFields f={f} set={set} size="desktop" inline lockedKind={kind} />
        </div>
      )}
    </FilterMenu>
  );
}
