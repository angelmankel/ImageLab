/**
 * The Models screen (rule 13): a full CivitAI browser.
 *   Desktop: filter rows above a tile grid (or list), a 380px collapsible detail panel on the right.
 *   Phone:   browse list + Filters sheet + a model opened full screen; one centred Back pill, no dock.
 * Logic from the main app (`@/`): the CivitAI key + IDB caches, the servers' hashes / file lists for
 * "installed", the download manager. Everything on screen is new, in this folder.
 */
import { useCallback, useEffect } from 'react';
import { Panel } from '~/ui';
import { T } from '~/theme/tokens';
import { useDownloads } from '@/hooks/useDownloads';
import type { CivitaiModel } from '@/lib/civitai';
import { useModels } from './modelsStore';
import { useShown } from './useShown';
import { useInstalled } from './useInstalled';
import { useModelActions } from './useModelActions';
import { FilterBar } from './FilterBar';
import { ModelList } from './ModelList';
import { Detail } from './Detail';
import { PhoneBrowse } from './PhoneBrowse';
import { PhoneModel } from './PhoneModel';

/** First page on first visit (and after a reload); later visits keep what was loaded. */
function useFirstLoad() {
  const refresh = useModels((s) => s.refresh);
  useEffect(() => {
    const s = useModels.getState();
    if (s.items.length === 0 && !s.loading && !s.error) void refresh();
  }, [refresh]);
}

export function ModelsScreen() {
  useDownloads();
  useFirstLoad();
  const f = useModels((s) => s.filters);
  const view = useModels((s) => s.view);
  const selectedId = useModels((s) => s.selectedId);
  const open = useModels((s) => s.open);
  const reveal = useModels((s) => s.reveal);
  const revealed = useModels((s) => s.revealed);
  const refresh = useModels((s) => s.refresh);
  const loadMore = useModels((s) => s.loadMore);
  const panelOpen = useModels((s) => s.panelOpen);
  const panelWidth = useModels((s) => s.panelWidth);
  const setPanelOpen = useModels((s) => s.setPanelOpen);
  const setPanelWidth = useModels((s) => s.setPanelWidth);
  const shown = useShown();
  const installed = useInstalled();
  const actions = useModelActions();

  const onOpen = useCallback((m: CivitaiModel) => open(m.id), [open]);
  const onUse = useCallback((m: CivitaiModel) => {
    const v = m.modelVersions.find((x) => installed.version(x)) ?? m.modelVersions[0];
    if (v) actions.useInStep(v, m.type);
  }, [installed, actions]);
  const onLoadMore = useCallback(() => void loadMore(), [loadMore]);

  const count = shown.total != null ? `${shown.total} models` : `${shown.items.length}${shown.hasMore ? '+' : ''} models`;

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <FilterBar count={count} />
        <ModelList
          scroll
          items={shown.items} view={view} selectedId={selectedId} mask={f.nsfwMask} revealed={revealed} installed={installed}
          loading={shown.loading} loadingMore={shown.loadingMore} error={shown.error} hasMore={shown.hasMore} hidden={shown.hidden}
          onOpen={onOpen} onReveal={reveal} onUse={onUse} onLoadMore={onLoadMore} onRetry={() => void refresh()}
          minTile={view === 'grid' ? 200 : 320}
        />
      </main>
      <Panel side="right" width={panelWidth} min={320} max={560} open={panelOpen} onResize={setPanelWidth} onToggle={() => setPanelOpen(!panelOpen)} tabLabel="Model">
        <div className="il-scroll" style={{ flex: 1, minHeight: 0 }}>
          {selectedId != null ? (
            <Detail modelId={selectedId} size="desktop" />
          ) : (
            <div style={{ padding: T.pad.panel, paddingTop: 40, textAlign: 'center', color: 'var(--il-muted)', fontSize: 12, fontWeight: 700 }}>Open a model to see its versions, files, trigger words and samples</div>
          )}
        </div>
      </Panel>
    </div>
  );
}

export function ModelsPhoneScreen() {
  useDownloads();
  useFirstLoad();
  const selectedId = useModels((s) => s.selectedId);
  return selectedId != null ? <PhoneModel modelId={selectedId} /> : <PhoneBrowse />;
}
