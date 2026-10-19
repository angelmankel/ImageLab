/**
 * The phone's Create tab, one per mode, all on the same settings list (`components/SettingsPager`):
 * Simple / Advanced on top, one big row per section with its live summary, the simple mode's quick
 * tweaks, then the mode's own extras (presets, reset). Advanced lists every section.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { Text } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconMessageCircle, IconPin, IconRoute } from '@tabler/icons-react';
import { DetailToggle } from '@/components/blocks';
import { SettingsPager, type PagerRow, type PagerStatus } from '@/components/SettingsPager';
import { PanelToolbar } from '@/features/controls/PanelToolbar';
import { SECTION_META, SectionBody, availableSections, useSectionStatus, type PanelScope } from '@/features/panel/sections';
import { usePanelTabs } from '@/features/panel/panelTabsStore';
import { ParamList, PromptPanel, ResetAllButton, WorkflowPicker } from '@/features/studio/StudioPanels';
import { exposedParams, useStudio } from '@/features/studio/studioStore';
import type { useWorkflowLibrary } from '@/features/studio/useWorkflowLibrary';
import { MissingFiles, VIDEO_SECTION_META, VideoSectionBody, useVideoSectionStatus } from '@/features/video/sections';
import { VideoPresetRow, VideoResetRow, VideoSweepRow } from '@/features/video/videoControls';
import { VIDEO_SECTIONS, type VideoSectionId } from '@/lib/videoSections';
import type { SectionId } from '@/lib/panelTabs';
import { sectionTier, videoSectionTier, visibleSections } from '@/lib/workspace';
import { ImageQuickTweaks, VideoQuickTweaks } from './QuickTweaks';
import { useWorkspace } from './workspaceStore';

const NO_IDS: string[] = [];

/** The top of every Create menu: Simple / Advanced, full width, thumb-sized. */
function DetailRow({ hidden }: { hidden: number }) {
  const detail = useWorkspace(s => s.detail);
  const setDetail = useWorkspace(s => s.setDetail);
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      <DetailToggle size="sm" fullWidth />
      {detail === 'simple' && hidden > 0 && (
        <button type="button" onClick={() => setDetail('advanced')} className="self-end text-[12px] text-accent-fg outline-none active:opacity-60">
          {hidden} more {hidden === 1 ? 'setting' : 'settings'} in Advanced ›
        </button>
      )}
    </div>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mt-3 rounded-xl border border-border-default bg-bg-panel px-3 py-2 ${className}`}>{children}</div>;
}

const hint = (to: string) => (
  <p className="mt-3 px-1 text-[11px] leading-relaxed text-fg-muted">Swipe right on a page to come back here. Swipe left here for the {to}.</p>
);

// ── Image ───────────────────────────────────────────────────────────────────

export function ImageCreate({ scope, empty, note, onSwipeToResult }: { scope: PanelScope; empty: boolean; note?: string; onSwipeToResult: () => void }) {
  const detail = useWorkspace(s => s.detail);
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
  const shown = visibleSections(order, detail, sectionTier);
  const rows: PagerRow<SectionId>[] = shown.map(id => ({ id, ...SECTION_META[id], status: status[id] }));
  // The quick search asks for a section Simple hides: show Advanced, then the page opens.
  const setDetail = useWorkspace(s => s.setDetail);
  useEffect(() => { if (reveal && order.includes(reveal) && !shown.includes(reveal)) setDetail('advanced'); }, [reveal, order, shown, setDetail]);

  return (
    <SettingsPager
      rows={rows}
      renderPage={id => <SectionBody id={id} scope={scope} />}
      pageIdPrefix="panel-section-"
      reveal={reveal && !shown.includes(reveal) ? null : reveal}
      onRevealed={clearReveal}
      onMenuSwipeLeft={onSwipeToResult}
      menu={nav => (
        <>
          {note && <div className="mb-2 truncate px-1 text-[12px] text-fg-muted">Editing layer: {note}</div>}
          {empty ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-fg-muted">
              Select a canvas layer to edit its prompt and settings.
            </div>
          ) : (
            <>
              <DetailRow hidden={order.length - shown.length} />
              {nav}
              {detail === 'simple' && <Card><ImageQuickTweaks /></Card>}
              <Card><PanelToolbar big /></Card>
              {hint('image')}
            </>
          )}
        </>
      )}
    />
  );
}

// ── Video ───────────────────────────────────────────────────────────────────

export function VideoCreate({ host, onSwipeToResult }: { host: string; onSwipeToResult: () => void }) {
  const detail = useWorkspace(s => s.detail);
  const status = useVideoSectionStatus();
  const shown = visibleSections(VIDEO_SECTIONS, detail, videoSectionTier);
  const rows: PagerRow<VideoSectionId>[] = shown.map(id => ({ id, ...VIDEO_SECTION_META[id], status: status[id] }));
  return (
    <SettingsPager
      rows={rows}
      renderPage={id => <VideoSectionBody id={id} host={host} />}
      pageIdPrefix="video-section-"
      onMenuSwipeLeft={onSwipeToResult}
      menu={nav => (
        <>
          <DetailRow hidden={VIDEO_SECTIONS.length - shown.length} />
          <div className="mb-3 empty:hidden"><MissingFiles /></div>
          <Card className="mb-3"><VideoPresetRow large /></Card>
          {nav}
          {detail === 'simple' && <Card><VideoQuickTweaks /></Card>}
          <Card><VideoSweepRow host={host} /></Card>
          <Card><VideoResetRow /></Card>
          {hint('video')}
        </>
      )}
    />
  );
}

// ── Workflow ────────────────────────────────────────────────────────────────

type WorkflowRow = 'workflow' | 'prompt' | 'controls';
type Library = ReturnType<typeof useWorkflowLibrary>;

export function WorkflowCreate({ host, library, onSwipeToResult }: { host: string; library: Library; onSwipeToResult: () => void }) {
  const detail = useWorkspace(s => s.detail);
  const path = useStudio(s => s.path);
  const params = useStudio(s => s.params);
  const exposed = useStudio(s => (s.path ? s.exposed[s.path] ?? NO_IDS : NO_IDS));
  const targetId = useStudio(s => s.targetId());
  const prompt = useStudio(s => (s.path && s.useShared[s.path] === false ? s.ownPrompt[s.path] ?? '' : s.sharedPrompt));
  const name = path ? library.workflows.find(w => w.path === path)?.name ?? path.replace(/^.*\//, '').replace(/\.json$/i, '') : null;

  const pinned = exposedParams(params, exposed).length;
  const controls: PagerStatus = !path
    ? { summary: 'Pick a workflow first' }
    : detail === 'simple'
      ? (pinned ? { summary: `${pinned} pinned of ${params.length}`, badge: String(pinned) } : { summary: `Nothing pinned · ${params.length} in Advanced` })
      : { summary: `${params.length} controls`, badge: String(params.length) };
  const rows: PagerRow<WorkflowRow>[] = [
    { id: 'workflow', title: 'Workflow', icon: IconRoute, status: name ? { summary: name } : { summary: library.workflows.length ? 'None open' : 'Save one in ComfyUI', tone: 'warn', note: 'Pick a workflow first' } },
    ...(path && targetId ? [{ id: 'prompt' as const, title: 'Prompt', icon: IconMessageCircle, status: { summary: prompt.trim().split('\n')[0]?.slice(0, 48) || 'Empty' } }] : []),
    { id: 'controls', title: detail === 'simple' ? 'Pinned controls' : 'All controls', icon: detail === 'simple' ? IconPin : IconAdjustmentsHorizontal, status: controls },
  ];

  return (
    <SettingsPager
      rows={rows}
      renderPage={id => {
        switch (id) {
          case 'workflow': return (
            <div className="flex flex-col gap-3">
              <WorkflowPicker workflows={library.workflows} onOpen={p => { void library.open(p); }} onRefresh={library.refresh} large />
              {library.error && <Text size="xs" c="red.4">{library.error}</Text>}
            </div>
          );
          case 'prompt': return <PromptPanel large />;
          case 'controls': return (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <Text size="xs" c="dimmed">{detail === 'simple' ? 'Advanced shows every control, with a pin to keep it here.' : 'Pin a control to keep it in Simple.'}</Text>
                <ResetAllButton />
              </div>
              <ParamList large host={host} />
            </div>
          );
        }
      }}
      pageIdPrefix="workflow-section-"
      onMenuSwipeLeft={onSwipeToResult}
      menu={nav => (
        <>
          <DetailRow hidden={detail === 'simple' ? Math.max(0, params.length - pinned) : 0} />
          {nav}
          {hint('result')}
        </>
      )}
    />
  );
}
