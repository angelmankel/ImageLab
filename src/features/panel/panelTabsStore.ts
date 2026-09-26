/**
 * The left panel's tab layout and view preferences, kept across reloads. The layout logic itself
 * is pure and lives in `lib/panelTabs.ts`; this store only holds the result and remembers it.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  activeFromOldSections, addTab, defaultTabs, moveSection, moveSectionBy, moveTab, moveTabBy, normalizeTabs,
  removeTab, renameTab, setTabHidden, setTabIcon, tabOfSection, type PanelTab, type SectionId,
} from '@/lib/panelTabs';
import { uid } from '@/lib/storage';

/** `auto` shows every label while they fit and only the active tab's label when they do not. */
export type TabLabelMode = 'auto' | 'labels' | 'icons';

interface PanelTabsState {
  tabs: PanelTab[];
  active: string;
  labels: TabLabelMode;
  /** The model · sampler · steps · size · seed line under the tabs. */
  strip: boolean;
  /** Set by a summary-strip jump; the tab scrolls this section into view once and clears it. */
  reveal: SectionId | null;

  setActive: (id: string) => void;
  /** Opens the tab holding `section`, even a hidden one, and scrolls to it. */
  showSection: (section: SectionId) => void;
  clearReveal: () => void;
  setLabels: (labels: TabLabelMode) => void;
  setStrip: (strip: boolean) => void;

  moveTab: (fromId: string, toId: string) => void;
  moveTabBy: (id: string, delta: number) => void;
  renameTab: (id: string, label: string) => void;
  setTabIcon: (id: string, icon: string) => void;
  setTabHidden: (id: string, hidden: boolean) => void;
  addTab: () => string;
  removeTab: (id: string) => void;
  moveSection: (section: SectionId, toTabId: string) => void;
  moveSectionBy: (section: SectionId, delta: number) => void;
  resetLayout: () => void;
}

/** The accordion's saved open/closed map, read once for the first active tab. */
function oldCollapsed(): unknown {
  try {
    const raw = localStorage.getItem('imagelab.panelSections.v1');
    return raw ? JSON.parse(raw)?.state?.collapsed : undefined;
  } catch { return undefined; }
}

const firstTabs = defaultTabs();

export const usePanelTabs = create<PanelTabsState>()(
  persist(
    (set, get) => ({
      tabs: firstTabs,
      active: activeFromOldSections(oldCollapsed(), firstTabs),
      labels: 'auto',
      strip: true,
      reveal: null,

      setActive: (active) => set({ active }),
      showSection: (section) => {
        const tab = tabOfSection(get().tabs, section);
        if (tab) set({ active: tab.id, reveal: section });
      },
      clearReveal: () => set({ reveal: null }),
      setLabels: (labels) => set({ labels }),
      setStrip: (strip) => set({ strip }),

      moveTab: (fromId, toId) => set(s => ({ tabs: moveTab(s.tabs, fromId, toId) })),
      moveTabBy: (id, delta) => set(s => ({ tabs: moveTabBy(s.tabs, id, delta) })),
      renameTab: (id, label) => set(s => ({ tabs: renameTab(s.tabs, id, label) })),
      setTabIcon: (id, icon) => set(s => ({ tabs: setTabIcon(s.tabs, id, icon) })),
      setTabHidden: (id, hidden) => set(s => {
        const tabs = setTabHidden(s.tabs, id, hidden);
        // A hidden tab stays on the bar while it is active; hiding the one you are on moves off it.
        const active = hidden && s.active === id ? tabs.find(t => !t.hidden && t.sections.length)?.id ?? s.active : s.active;
        return { tabs, active };
      }),
      addTab: () => {
        const id = `custom-${uid()}`;
        set(s => ({ tabs: addTab(s.tabs, id) }));
        return id;
      },
      removeTab: (id) => set(s => ({ tabs: removeTab(s.tabs, id) })),
      moveSection: (section, toTabId) => set(s => ({ tabs: moveSection(s.tabs, section, toTabId) })),
      moveSectionBy: (section, delta) => set(s => ({ tabs: moveSectionBy(s.tabs, section, delta) })),
      resetLayout: () => set({ tabs: defaultTabs(), labels: 'auto', strip: true }),
    }),
    {
      name: 'imagelab.panelTabs.v1',
      partialize: (s) => ({ tabs: s.tabs, active: s.active, labels: s.labels, strip: s.strip }),
      // Stored data is repaired on the way in, so a hand-edited or older layout cannot break the panel.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PanelTabsState>;
        return {
          ...current,
          tabs: normalizeTabs(p.tabs),
          active: typeof p.active === 'string' ? p.active : current.active,
          labels: p.labels === 'labels' || p.labels === 'icons' ? p.labels : 'auto',
          strip: p.strip !== false,
        };
      },
    },
  ),
);
