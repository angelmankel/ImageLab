import { useEffect, useState } from 'react';
import { HistoryPanel } from '@/features/history/HistoryPanel';
import { CanvasLayersPanel } from './CanvasLayersPanel';
import { useCanvasStore } from '@/lib/canvasStore';
import { Tabs } from '@mantine/core';

const RIGHT_PANEL_TAB_KEY = 'imagelab.rightPanelTab.v1';

type RightTab = 'layers' | 'history';
const TABS: { id: RightTab; label: string }[] = [
  { id: 'layers',  label: 'Layers'  },
  { id: 'history', label: 'History' },
];

function loadTab(): RightTab {
  try {
    const v = localStorage.getItem(RIGHT_PANEL_TAB_KEY);
    if (v === 'layers' || v === 'history') return v;
  } catch { /* ignore */ }
  return 'history';
}

function saveTab(t: RightTab) {
  try { localStorage.setItem(RIGHT_PANEL_TAB_KEY, t); } catch { /* ignore */ }
}

/**
 * Tabbed right-panel shell: Layers (canvas-compositor list) / History
 * (existing per-server history), on v1's Mantine tab strip.
 */
export function RightPanel() {
  const mainView = useCanvasStore(s => s.mainView);
  const visibleTabs = mainView === 'canvas' ? TABS : TABS.filter(t => t.id !== 'layers');

  const [tab, setTabState] = useState<RightTab>(() => loadTab());
  const setTab = (next: RightTab) => {
    setTabState(next);
    saveTab(next);
  };

  // Force History tab whenever Layers isn't available (generate view).
  useEffect(() => {
    if (!visibleTabs.some(t => t.id === tab)) setTabState('history');
  }, [visibleTabs, tab]);

  const activeTab: RightTab = visibleTabs.some(t => t.id === tab) ? tab : 'history';
  const showTablist = visibleTabs.length > 1;

  return (
    <div className="flex h-full flex-col">
      {/* v1 tab strip: Mantine Tabs used for the list only — the panels render below so the
          inactive one unmounts, as before. */}
      {showTablist && (
        <Tabs value={activeTab} onChange={(v) => v && setTab(v as RightTab)} className="shrink-0">
          <Tabs.List grow>
            {visibleTabs.map(t => (
              <Tabs.Tab key={t.id} value={t.id} className="min-h-[44px]">
                {t.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}
      <div className="min-h-0 flex-1">
        {activeTab === 'layers'  && <CanvasLayersPanel />}
        {activeTab === 'history' && (
          <HistoryPanel
            tileClickMode={mainView === 'canvas' ? 'open-immediately' : 'select-then-open'}
          />
        )}
      </div>
    </div>
  );
}
