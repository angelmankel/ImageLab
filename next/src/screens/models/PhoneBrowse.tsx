/**
 * Phone 1 of the Models-Phone board (rules 11, 13): "Models" + Installed | CivitAI, then one
 * scroll with the search, SORT · PERIOD · NSFW · Filters (badge), the type chip row, the count
 * line and the list. Everything a thumb needs is at the bottom: the centred Back pill.
 */
import { useCallback } from 'react';
import { IconFilter } from '@tabler/icons-react';
import { BackPill } from '~/ui';
import { useRoute } from '~/app/routeStore';
import type { CivitaiModel } from '@/lib/civitai';
import { MODEL_TYPES, SORTS, SORT_SHORT, PERIODS, PERIOD_LABEL, NSFW_LEVELS, typeLabel, toggleIn, maskForLevel, levelForMask, activeFilters, baseModelShort, type Sort, type Period, type NsfwLevelKey } from './civitaiQuery';
import { useModels } from './modelsStore';
import { useShown } from './useShown';
import { useInstalled } from './useInstalled';
import { FChip, MenuPill, SegPill } from './bits';
import { SearchBox } from './FilterBar';
import { ModelList } from './ModelList';
import { PhoneFilters } from './PhoneFilters';

const ROW_TYPES = MODEL_TYPES.filter((t) => ['Checkpoint', 'LORA', 'LoCon', 'TextualInversion', 'Controlnet', 'VAE', 'Upscaler', 'MotionModule', 'Workflows'].includes(t));

export function PhoneBrowse() {
  const go = useRoute((s) => s.go);
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const source = useModels((s) => s.source);
  const setSource = useModels((s) => s.setSource);
  const open = useModels((s) => s.open);
  const reveal = useModels((s) => s.reveal);
  const revealed = useModels((s) => s.revealed);
  const refresh = useModels((s) => s.refresh);
  const loadMore = useModels((s) => s.loadMore);
  const setSheetOpen = useModels((s) => s.setSheetOpen);
  const shown = useShown();
  const installed = useInstalled();
  const active = activeFilters(f);
  const onOpen = useCallback((m: CivitaiModel) => open(m.id), [open]);
  const onLoadMore = useCallback(() => void loadMore(), [loadMore]);

  const summary = [
    shown.total != null ? `${shown.total} models` : `${shown.items.length}${shown.hasMore ? '+' : ''} models`,
    ...f.baseModels.map(baseModelShort), f.period !== 'AllTime' ? PERIOD_LABEL[f.period] : '', NSFW_LEVELS.find((l) => l.key === levelForMask(f.nsfwMask))?.label ?? '',
  ].filter(Boolean).join(' · ');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0' }}>
        <span style={{ fontWeight: 800, fontSize: 18 }}>Models</span>
        <SegPill label="Source" value={source} onChange={setSource} items={[{ key: 'installed', label: 'Installed' }, { key: 'civitai', label: 'CivitAI' }]} />
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '10px 16px 100px', display: 'flex', flexDirection: 'column', gap: 8, touchAction: 'pan-y' }}>
        <SearchBox height={44} fontSize={13} />
        <div style={{ display: 'flex', gap: 6 }}>
          <MenuPill<Sort> size="phone" grow label="Sort" value={f.sort} onChange={(sort) => set({ sort })} options={SORTS.map((s) => ({ key: s, label: SORT_SHORT[s] }))} />
          <MenuPill<Period> size="phone" grow label="Period" value={f.period} onChange={(period) => set({ period })} options={PERIODS.map((p) => ({ key: p, label: PERIOD_LABEL[p] }))} />
          <MenuPill<NsfwLevelKey> size="phone" grow label="NSFW" value={levelForMask(f.nsfwMask)} onChange={(k) => set({ nsfwMask: maskForLevel(k) })} options={NSFW_LEVELS.map((l) => ({ key: l.key, label: l.label }))} />
          <button type="button" onClick={() => setSheetOpen(true)} style={{ flex: 'none', height: 44, padding: '0 12px', border: '1px solid var(--il-ember)', borderRadius: 14, background: 'transparent', color: 'var(--il-ember)', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IconFilter size={15} stroke={2.2} />Filters
            {active.length > 0 && <span style={{ background: 'var(--il-ember)', color: 'var(--il-bg)', borderRadius: 999, padding: '1px 7px', fontSize: 11 }}>{active.length}</span>}
          </button>
        </div>
        <div className="il-scroll-x" style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap', flex: 'none', margin: '0 -16px', padding: '0 16px' }}>
          {ROW_TYPES.map((t) => <FChip key={t} size="phone" tall on={f.types.includes(t)} onClick={() => set({ types: toggleIn(f.types, t) })} style={{ padding: '0 14px' }}>{typeLabel(t)}</FChip>)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', padding: '0 2px' }}>{summary}</div>
        <ModelList
          items={shown.items} view="list" selectedId={null} mask={f.nsfwMask} revealed={revealed} installed={installed}
          loading={shown.loading} loadingMore={shown.loadingMore} error={shown.error} hasMore={shown.hasMore} hidden={shown.hidden}
          onOpen={onOpen} onReveal={reveal} onUse={onOpen} onLoadMore={onLoadMore} onRetry={() => void refresh()}
        />
      </div>
      <BackPill onClick={() => go('step')} />
      <PhoneFilters count={shown.total ?? shown.items.length} />
    </div>
  );
}
