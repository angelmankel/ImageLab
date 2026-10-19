/**
 * The phone's Parameters tab: a settings list, not the desktop's tab bar.
 *
 *   ┌ ✎ Prompts        1girl, beach…     › ┐   the menu: one big row per section, with its live
 *   │ ▣ Models         waiIllustrious  2 › │   summary and badge, in the user's tab order
 *   │ ⚙ Parameters     Euler a · 28 steps › │   (hidden tabs stay hidden)
 *   │ …                                    │
 *   │ [Clear all]          Presets 1 2 3 4 5 │
 *   ├ Seed [ 12345 ] 🎲 Auto       (+)(▶)   ┤   footer under both menu and page
 *
 * Tapping a row slides its section in full screen, with Back and the previous / next section in
 * the header. Back is also: a swipe to the right anywhere on the page that does not start on a
 * control of its own (slider, text box, sideways-scrolling row), and the phone's own back button
 * or gesture (the open page holds one history entry). On the menu, a swipe to the left goes to
 * the Image tab. Sections mount on first open and stay mounted, so a half-written prompt or an
 * open editor survives a trip back to the list. The quick search's "show section" opens the page.
 * The list and its pages are `components/SettingsPager`, shared with the Video view.
 */
import { useMemo } from 'react';
import { emitApp } from '@/lib/appEvents';
import { SettingsPager } from '@/components/SettingsPager';
import { PanelToolbar } from '@/features/controls/PanelToolbar';
import { GenerationProgress } from '@/features/generate/GenerationProgress';
import { SeedRow, usePanelScope } from '@/features/layout/LeftPanel';
import { usePanelTabs } from './panelTabsStore';
import { SECTION_META, SectionBody, availableSections, useSectionStatus } from './sections';

export function MobileParameters() {
  const { scope, empty, note } = usePanelScope();
  const tabs = usePanelTabs(s => s.tabs);
  const reveal = usePanelTabs(s => s.reveal);
  const clearReveal = usePanelTabs(s => s.clearReveal);
  const status = useSectionStatus(scope);

  // The rows follow the user's tab layout, so the phone and the desktop agree on the order.
  const available = useMemo(() => availableSections(scope), [scope.layerScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const order = useMemo(
    () => tabs.filter(t => !t.hidden).flatMap(t => t.sections).filter(s => available.includes(s)),
    [tabs, available],
  );
  const rows = order.map(id => ({ id, ...SECTION_META[id], status: status[id] }));

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Generation workspace">
      <SettingsPager
        rows={rows}
        renderPage={id => <SectionBody id={id} scope={scope} />}
        pageIdPrefix="panel-section-"
        reveal={reveal}
        onRevealed={clearReveal}
        onMenuSwipeLeft={() => emitApp('mobile-tab', 'image')}
        menu={nav => (
          <>
            {note && <div className="mb-2 truncate px-1 text-[12px] text-fg-muted">Editing layer: {note}</div>}
            {empty ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-fg-muted">
                Select a canvas layer to edit its prompt and settings.
              </div>
            ) : (
              <>
                {nav}
                <div className="mt-3 rounded-xl border border-border-default bg-bg-panel px-3 py-2">
                  <PanelToolbar big />
                </div>
                <p className="mt-3 px-1 text-[11px] leading-relaxed text-fg-muted">
                  Swipe right on a page to come back here. Swipe left here for the image.
                </p>
              </>
            )}
          </>
        )}
      />

      {/* Under both: the run's progress and the seed, clear of the floating Generate buttons. */}
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-border-default bg-bg-panel py-2 pl-3 pr-[150px]" style={{ minHeight: 80 }}>
        <GenerationProgress />
        {!empty && <SeedRow />}
      </div>
    </div>
  );
}
