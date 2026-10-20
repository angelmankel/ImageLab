/**
 * Phone 1 of the Models-Phone board (rules 11, 13 + the picker brief): "Models", then one scroll
 * with the search, SORT · PERIOD · NSFW · Filters (badge), the Downloaded · ★ Favourites · type
 * chip row, the picked tags, the count line and a 2-per-row tile grid. On the route the centred
 * Back pill leaves the screen; in the modal the modal's top Back closes it.
 */
import { useCallback } from 'react';
import { IconFilter } from '@tabler/icons-react';
import { BackPill } from '~/ui';
import { useRoute } from '~/app/routeStore';
import type { CivitaiModel } from '@/lib/civitai';
import { MODEL_TYPES, SORTS, SORT_SHORT, PERIODS, PERIOD_LABEL, NSFW_LEVELS, KIND_LABEL, typeLabel, toggleIn, maskForLevel, levelForMask, activeFilters, baseModelShort, type Sort, type Period, type NsfwLevelKey } from './civitaiQuery';
import { useModels } from './modelsStore';
import { useShown } from './useShown';
import { useInstalled } from './useInstalled';
import { useModelActions } from './useModelActions';
import { usePick } from './pickContext';
import { FChip, MenuPill } from './bits';
import { SearchBox, SourceChips } from './FilterBar';
import { ModelList } from './ModelList';
import { PhoneFilters } from './PhoneFilters';
import { SelectedTagChips } from './TagsRow';
import { useKeepScroll, modelsListKey } from './useKeepScroll';

const ROW_TYPES = MODEL_TYPES.filter((t) => ['Checkpoint', 'LORA', 'LoCon', 'TextualInversion', 'Controlnet', 'VAE', 'Upscaler', 'MotionModule', 'Workflows'].includes(t));

export function PhoneBrowse() {
  const go = useRoute((s) => s.go);
  const { close, kind } = usePick();
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const open = useModels((s) => s.open);
  const reveal = useModels((s) => s.reveal);
  const revealed = useModels((s) => s.revealed);
  const favourites = useModels((s) => s.favourites);
  const refresh = useModels((s) => s.refresh);
  const loadMore = useModels((s) => s.loadMore);
  const setSheetOpen = useModels((s) => s.setSheetOpen);
  const tagCount = useModels((s) => s.selectedTags.length);
  const source = useModels((s) => s.source);
  const storeKind = useModels((s) => s.kind);
  // No key until the store has taken the picker's kind (its effect runs after the first render).
  const keepScroll = useKeepScroll(storeKind === (kind ?? null) ? modelsListKey(source, storeKind, f.query, true) : null);
  const shown = useShown();
  const installed = useInstalled();
  const actions = useModelActions();
  const active = activeFilters(f).filter((a) => !(kind && a.key === 'types')).length + tagCount;
  const onOpen = useCallback((m: CivitaiModel) => open(m.id), [open]);
  const onUse = useCallback((m: CivitaiModel) => { const v = actions.versionToUse(m); if (v) actions.use(m, v); }, [actions]);
  const onLoadMore = useCallback(() => void loadMore(), [loadMore]);

  const summary = [
    shown.total != null ? `${shown.total} models` : `${shown.items.length}${shown.hasMore ? '+' : ''} models`,
    kind ? KIND_LABEL[kind] : '', ...f.baseModels.map(baseModelShort), f.period !== 'AllTime' ? PERIOD_LABEL[f.period] : '', NSFW_LEVELS.find((l) => l.key === levelForMask(f.nsfwMask))?.label ?? '',
  ].filter(Boolean).join(' · ');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      {!close && (
        <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0' }}>
          <span style={{ fontWeight: 800, fontSize: 18 }}>Models</span>
        </div>
      )}
      <div ref={keepScroll} className="il-scroll" style={{ flex: 1, minHeight: 0, padding: `10px 16px ${close ? 24 : 100}px`, display: 'flex', flexDirection: 'column', gap: 8, touchAction: 'pan-y' }}>
        <SearchBox height={44} fontSize={13} />
        <div style={{ display: 'flex', gap: 6 }}>
          <MenuPill<Sort> size="phone" grow label="Sort" value={f.sort} onChange={(sort) => set({ sort })} options={SORTS.map((s) => ({ key: s, label: SORT_SHORT[s] }))} />
          <MenuPill<Period> size="phone" grow label="Period" value={f.period} onChange={(period) => set({ period })} options={PERIODS.map((p) => ({ key: p, label: PERIOD_LABEL[p] }))} />
          <MenuPill<NsfwLevelKey> size="phone" grow label="NSFW" value={levelForMask(f.nsfwMask)} onChange={(k) => set({ nsfwMask: maskForLevel(k) })} options={NSFW_LEVELS.map((l) => ({ key: l.key, label: l.label }))} />
          <button type="button" onClick={() => setSheetOpen(true)} style={{ flex: 'none', height: 44, padding: '0 12px', border: '1px solid var(--il-ember)', borderRadius: 14, background: 'transparent', color: 'var(--il-ember)', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IconFilter size={15} stroke={2.2} />Filters
            {active > 0 && <span style={{ background: 'var(--il-ember)', color: 'var(--il-bg)', borderRadius: 999, padding: '1px 7px', fontSize: 11 }}>{active}</span>}
          </button>
        </div>
        <div className="il-scroll-x" style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap', flex: 'none', margin: '0 -16px', padding: '0 16px' }}>
          <SourceChips size="phone" />
          {kind
            ? <FChip size="phone" tall on>{KIND_LABEL[kind]}</FChip>
            : ROW_TYPES.map((t) => <FChip key={t} size="phone" tall on={f.types.includes(t)} onClick={() => set({ types: toggleIn(f.types, t) })} style={{ padding: '0 14px' }}>{typeLabel(t)}</FChip>)}
        </div>
        {tagCount > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}><SelectedTagChips size="phone" /></div>}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', padding: '0 2px' }}>{summary}</div>
        <ModelList
          items={shown.items} view="grid" columns={2} size="phone" selectedId={null} mask={f.nsfwMask} revealed={revealed} favourites={favourites} installed={installed} picking={actions.picking}
          loading={shown.loading} loadingMore={shown.loadingMore} error={shown.error} hasMore={shown.hasMore} hidden={shown.hidden}
          onOpen={onOpen} onReveal={reveal} onUse={onUse} onLoadMore={onLoadMore} onRetry={() => void refresh()}
        />
      </div>
      {!close && <BackPill onClick={() => go('step')} />}
      <PhoneFilters count={shown.total ?? shown.items.length} pool={shown.pool} />
    </div>
  );
}
