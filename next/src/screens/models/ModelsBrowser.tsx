/**
 * The browser itself (filters · tag groups · big tile grid · the 500px detail panel on desktop; the
 * phone's browse page / opened model), used by the route (`ModelsScreen`, full-bleed) and by
 * `ModelsModal` (every picker). `PickContext` says what it was opened for.
 */
import { HashProgressLine } from './HashProgressLine';
import { useCallback, useEffect } from 'react';
import { Panel } from '~/ui';
import { T } from '~/theme/tokens';
import { useDownloads } from '@/hooks/useDownloads';
import { useDownloadsStore } from '@/features/downloads';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { useModels, PANEL_W } from './modelsStore';
import { useShown } from './useShown';
import { useInstalled } from './useInstalled';
import { useModelActions } from './useModelActions';
import { usePick } from './pickContext';
import { useKeepScroll, modelsListKey } from './useKeepScroll';
import { FilterBar } from './FilterBar';
import { ModelList } from './ModelList';
import { Detail } from './Detail';
import { PhoneBrowse } from './PhoneBrowse';
import { PhoneModel } from './PhoneModel';

/** First page on first visit; the kind lock from the context; "downloaded once" from the manager. */
function useBrowserSetup() {
  const refresh = useModels((s) => s.refresh);
  const setKind = useModels((s) => s.setKind);
  const markDownloaded = useModels((s) => s.markDownloaded);
  const { kind } = usePick();
  const completed = useDownloadsStore((s) => s.rows.some((r) => r.status === 'completed' || r.status === 'downloading'));
  useDownloads();
  useEffect(() => { setKind(kind); }, [kind, setKind]);
  useEffect(() => {
    const s = useModels.getState();
    if (s.items.length === 0 && !s.loading && !s.error && s.source === 'civitai') void refresh();
  }, [refresh]);
  useEffect(() => { if (completed) markDownloaded(); }, [completed, markDownloaded]);
}

export function DesktopBrowser() {
  useBrowserSetup();
  const f = useModels((s) => s.filters);
  const view = useModels((s) => s.view);
  const selectedId = useModels((s) => s.selectedId);
  const open = useModels((s) => s.open);
  const reveal = useModels((s) => s.reveal);
  const revealed = useModels((s) => s.revealed);
  const favourites = useModels((s) => s.favourites);
  const refresh = useModels((s) => s.refresh);
  const loadMore = useModels((s) => s.loadMore);
  const panelOpen = useModels((s) => s.panelOpen);
  const panelWidth = useModels((s) => s.panelWidth);
  const setPanelOpen = useModels((s) => s.setPanelOpen);
  const setPanelWidth = useModels((s) => s.setPanelWidth);
  const source = useModels((s) => s.source);
  const kind = useModels((s) => s.kind);
  const pickKind = usePick().kind;
  const shown = useShown();
  const keepDetail = useKeepScroll(selectedId != null ? `detail:${selectedId}` : null);
  const installed = useInstalled();
  const actions = useModelActions();

  const onOpen = useCallback((m: CivitaiModel) => open(m.id), [open]);
  const onUse = useCallback((m: CivitaiModel, picked?: CivitaiModelVersion) => { const v = picked ?? actions.versionToUse(m); if (v) actions.use(m, v); }, [actions]);
  const onLoadMore = useCallback(() => void loadMore(), [loadMore]);

  const count = shown.total != null ? `${shown.total} models` : `${shown.items.length}${shown.hasMore ? '+' : ''} models`;

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <FilterBar count={count} pool={shown.pool} />
        <HashProgressLine style={{ padding: '2px 14px 4px' }} />
        <ModelList
          scroll scrollKey={kind === pickKind ? modelsListKey(source, kind, f.query) : null /* until the store has the picker's kind */}
          items={shown.items} view={view} selectedId={selectedId} mask={f.nsfwMask} revealed={revealed} favourites={favourites} installed={installed} picking={actions.picking}
          loading={shown.loading} loadingMore={shown.loadingMore} error={shown.error} hasMore={shown.hasMore} hidden={shown.hidden}
          onOpen={onOpen} onReveal={reveal} onUse={onUse} onLoadMore={onLoadMore} onRetry={() => void refresh()}
          minTile={view === 'grid' ? 240 : 320}
        />
      </main>
      <Panel side="right" width={panelWidth} min={420} max={760} defaultWidth={PANEL_W} open={panelOpen} onResize={setPanelWidth} onToggle={() => setPanelOpen(!panelOpen)} tabLabel="Model">
        <div ref={keepDetail} className="il-scroll" style={{ flex: 1, minHeight: 0, overflowX: 'hidden' }}>
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

export function PhoneBrowser() {
  useBrowserSetup();
  const selectedId = useModels((s) => s.selectedId);
  return selectedId != null ? <PhoneModel modelId={selectedId} /> : <PhoneBrowse />;
}
