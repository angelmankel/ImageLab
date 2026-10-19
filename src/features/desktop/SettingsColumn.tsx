/**
 * The desktop's settings column: the active mode's sections as folding cards in one scroll, no
 * tabs and no nested menus. Simple shows the few cards that matter (`sectionTier` /
 * `videoSectionTier` in `lib/workspace.ts`) plus Quick tweaks and a row saying how many more
 * settings Advanced holds; Advanced shows every card. Nothing is lost between the two — a card
 * keeps its state while hidden because the detail level only filters what is rendered.
 *
 * Image cards follow the user's tab layout (`panelTabsStore`: order, hidden tabs), so the order
 * agrees with the phone. Alt+1…9 opens and scrolls to the Nth card on screen; the quick search's
 * "show section" (`usePanelTabs.reveal`) does the same, switching to Advanced when it has to.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Switch, Text } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconExternalLink, IconRefresh, IconRoute, IconSettings, IconSparkles } from '@tabler/icons-react';
import { SectionCard } from '@/components/blocks/SectionCard';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { useCanvasStore } from '@/lib/canvasStore';
import { nthSection } from '@/lib/desktopLayout';
import { sectionTier, videoSectionTier, visibleSections, type WorkspaceMode } from '@/lib/workspace';
import { VIDEO_SECTIONS, type VideoSectionId } from '@/lib/videoSections';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { useWorkspace } from '@/features/workspace/workspaceStore';
import { ImageQuickTweaks, VideoQuickTweaks } from '@/features/workspace/QuickTweaks';
import { usePanelTabs } from '@/features/panel/panelTabsStore';
import { SECTION_META, SectionBody, availableSections, useSectionStatus, type PanelScope } from '@/features/panel/sections';
import { CustomizeTabsModal } from '@/features/panel/CustomizeTabsModal';
import { PanelToolbar } from '@/features/controls/PanelToolbar';
import { MissingFiles, VIDEO_SECTION_META, VideoSectionBody, useVideoSectionStatus } from '@/features/video/sections';
import { ParamList, PromptPanel, ResetAllButton, WorkflowPicker } from '@/features/studio/StudioPanels';
import { useWorkflowLibrary } from '@/features/studio/useWorkflowLibrary';
import { useStudio } from '@/features/studio/studioStore';
import { useDesktopLayout } from './desktopLayoutStore';

/** Alt+1…9. macOS turns Option+digit into these characters, so they are listed too (US layout). */
const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const MAC_OPTION_DIGITS = ['¡', '™', '£', '¢', '∞', '§', '¶', '•', 'ª'];
const CARD_SHORTCUTS = [...DIGIT_KEYS, ...MAC_OPTION_DIGITS].map(k => `alt+${k}`);

const cardId = (id: string) => `panel-section-${id}`;

/** Open the card and bring it into view; the column is the scroll container. */
function revealCard(id: string) {
  requestAnimationFrame(() => document.getElementById(cardId(id))?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}

/** Alt+N → the Nth card on screen. Shared by the three modes' columns. */
function useCardShortcuts(mode: WorkspaceMode, shown: readonly string[]) {
  const unfold = useDesktopLayout(s => s.unfold);
  useShortcut(CARD_SHORTCUTS, (e) => {
    const digit = /^Digit([1-9])$/.exec(e.code)?.[1] ?? String(MAC_OPTION_DIGITS.indexOf(e.key) + 1 || e.key);
    const id = nthSection(shown, Number(digit));
    if (!id) return false;
    e.preventDefault();
    unfold(mode, id);
    revealCard(id);
  }, { priority: ShortcutPriority.Panel, skipTyping: false });
}

/** "4 more settings · Advanced": the way from Simple to everything, right where the cards end. */
function MoreSettingsRow({ hidden }: { hidden: number }) {
  const setDetail = useWorkspace(s => s.setDetail);
  if (!hidden) return null;
  return (
    <button
      type="button"
      onClick={() => setDetail('advanced')}
      className="flex min-h-10 w-full shrink-0 items-center justify-between gap-2 rounded-lg border border-dashed border-border-default px-3 py-2 text-left text-[12.5px] text-fg-muted outline-none transition-colors hover:border-border-strong hover:text-fg-secondary focus-visible:ring-1 focus-visible:ring-accent"
    >
      <span className="flex items-center gap-2"><IconAdjustmentsHorizontal size={15} stroke={1.6} />{hidden} more setting{hidden === 1 ? '' : 's'}</span>
      <span className="text-accent-fg">Advanced</span>
    </button>
  );
}

// ── Image ───────────────────────────────────────────────────────────────────

/** The image sections, in the user's tab order, filtered by scope and detail. */
export function useImageSections(scope: PanelScope) {
  const tabs = usePanelTabs(s => s.tabs);
  const detail = useWorkspace(s => s.detail);
  const available = useMemo(() => availableSections(scope), [scope.layerScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const order = useMemo(
    () => tabs.filter(t => !t.hidden).flatMap(t => t.sections).filter(s => available.includes(s)),
    [tabs, available],
  );
  const shown = useMemo(() => visibleSections(order, detail, sectionTier), [order, detail]);
  return { order, shown, hidden: order.length - shown.length };
}

/**
 * The image mode's cards. `mode` is 'image' in the workspace; the canvas view passes a layer
 * scope and the same column edits the active layer. `note` names what is being edited.
 */
export function ImageSettingsColumn({ scope, note, empty }: { scope: PanelScope; note?: string; empty?: boolean }) {
  const { shown, hidden } = useImageSections(scope);
  const status = useSectionStatus(scope);
  const detail = useWorkspace(s => s.detail);
  const setDetail = useWorkspace(s => s.setDetail);
  const folded = useDesktopLayout(s => s.folded.image);
  const toggleFold = useDesktopLayout(s => s.toggleFold);
  const unfold = useDesktopLayout(s => s.unfold);
  const [customizing, setCustomizing] = useState(false);
  useCardShortcuts('image', shown);

  // The quick search asked for a section: show it even if it sits behind Advanced.
  const reveal = usePanelTabs(s => s.reveal);
  const clearReveal = usePanelTabs(s => s.clearReveal);
  useEffect(() => {
    if (!reveal) return;
    if (!shown.includes(reveal)) { if (sectionTier(reveal) === 'advanced' && detail === 'simple') { setDetail('advanced'); return; } clearReveal(); return; }
    unfold('image', reveal);
    revealCard(reveal);
    clearReveal();
  }, [reveal, shown, detail, setDetail, unfold, clearReveal]);

  if (empty) {
    return <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-fg-muted">Select a canvas layer to edit its prompt and settings.</div>;
  }

  return (
    <Column
      toolbar={<PanelToolbar note={note} />}
      customize={<CustomizeTabsModal opened={customizing} onClose={() => setCustomizing(false)} />}
    >
      {shown.map(id => (
        <Card key={id} id={id} title={SECTION_META[id].title} icon={SECTION_META[id].icon} status={status[id]}
          open={!folded.includes(id)} onToggle={() => toggleFold('image', id)}>
          <SectionBody id={id} scope={scope} />
        </Card>
      ))}
      {detail === 'simple' && !scope.layerScope && (
        <Card id="quick" title="Quick tweaks" icon={IconSparkles} status={{ summary: 'steps · CFG' }}
          open={!folded.includes('quick')} onToggle={() => toggleFold('image', 'quick')}>
          <ImageQuickTweaks />
        </Card>
      )}
      <MoreSettingsRow hidden={hidden} />
      <button type="button" onClick={() => setCustomizing(true)}
        className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-[11.5px] text-fg-muted outline-none transition-colors hover:bg-bg-elev hover:text-fg-secondary focus-visible:ring-1 focus-visible:ring-accent">
        <IconSettings size={14} stroke={1.6} /> Order and hide sections
      </button>
    </Column>
  );
}

// ── Video ───────────────────────────────────────────────────────────────────

export function VideoSettingsColumn({ host }: { host: string }) {
  const detail = useWorkspace(s => s.detail);
  const status = useVideoSectionStatus();
  const folded = useDesktopLayout(s => s.folded.video);
  const toggleFold = useDesktopLayout(s => s.toggleFold);
  const shown = useMemo(() => visibleSections(VIDEO_SECTIONS, detail, videoSectionTier), [detail]);
  useCardShortcuts('video', shown);

  return (
    <Column>
      <div className="empty:hidden"><MissingFiles /></div>
      {shown.map((id: VideoSectionId) => (
        <Card key={id} id={id} title={VIDEO_SECTION_META[id].title} icon={VIDEO_SECTION_META[id].icon} status={status[id]}
          open={!folded.includes(id)} onToggle={() => toggleFold('video', id)}>
          <VideoSectionBody id={id} host={host} />
        </Card>
      ))}
      {detail === 'simple' && (
        <Card id="quick" title="Quick tweaks" icon={IconSparkles} status={{ summary: 'fast · length' }}
          open={!folded.includes('quick')} onToggle={() => toggleFold('video', 'quick')}>
          <VideoQuickTweaks />
        </Card>
      )}
      <MoreSettingsRow hidden={VIDEO_SECTIONS.length - shown.length} />
    </Column>
  );
}

// ── Workflow ────────────────────────────────────────────────────────────────

/**
 * The workflow mode: which saved ComfyUI workflow, its prompt, its knobs. `ParamList` reads the
 * detail level itself (pinned knobs in Simple, every knob with pin stars in Advanced). Focus mode
 * and the way into ComfyUI sit under the picker, Advanced only.
 */
export function WorkflowSettingsColumn({ host, info }: { host: string; info: ObjectInfo | null }) {
  const library = useWorkflowLibrary(host, info);
  const detail = useWorkspace(s => s.detail);
  const path = useStudio(s => s.path);
  const paramCount = useStudio(s => s.params.length);
  const focusMode = useStudio(s => s.focusMode);
  const setFocusMode = useStudio(s => s.setFocusMode);
  const setMainView = useCanvasStore(s => s.setMainView);
  const folded = useDesktopLayout(s => s.folded.workflow);
  const toggleFold = useDesktopLayout(s => s.toggleFold);
  const shown = ['workflow', 'prompt', 'knobs'];
  useCardShortcuts('workflow', shown);

  const open = path ? library.workflows.find(w => w.path === path)?.name ?? path : 'nothing open';
  return (
    <Column>
      <Card id="workflow" title="Workflow" icon={IconRoute} status={{ summary: open, badge: library.workflows.length ? String(library.workflows.length) : undefined }}
        open={!folded.includes('workflow')} onToggle={() => toggleFold('workflow', 'workflow')}
        actions={<Button size="compact-xs" variant="subtle" leftSection={<IconRefresh size={12} />} onClick={library.refresh}>Refresh</Button>}>
        <WorkflowPicker workflows={library.workflows} onOpen={library.open} onRefresh={library.refresh} />
        {library.error && <Text size="xs" c="red.4" mt="xs">{library.error}</Text>}
        {detail === 'advanced' && (
          <div className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3">
            <Switch size="sm" label="Focus mode" labelPosition="left" checked={focusMode}
              onChange={e => setFocusMode(e.currentTarget.checked)}
              classNames={{ body: 'justify-between', labelWrapper: 'flex-1' }}
              description="Hides ComfyUI from the rail so this is the only place to be." />
            {!focusMode && (
              <Button variant="default" size="xs" fullWidth rightSection={<IconExternalLink size={13} />} onClick={() => setMainView('comfy')}>
                Open ComfyUI
              </Button>
            )}
          </div>
        )}
      </Card>
      <Card id="prompt" title="Prompt" icon={SECTION_META.prompts.icon} status={{ summary: '' }}
        open={!folded.includes('prompt')} onToggle={() => toggleFold('workflow', 'prompt')}>
        <PromptPanel />
      </Card>
      <Card id="knobs" title="Controls" icon={SECTION_META.parameters.icon}
        status={{ summary: path ? `${paramCount} control${paramCount === 1 ? '' : 's'}` : 'open a workflow' }}
        open={!folded.includes('knobs')} onToggle={() => toggleFold('workflow', 'knobs')}
        actions={<ResetAllButton />}>
        <ParamList host={host} />
      </Card>
    </Column>
  );
}

// ── Frame ───────────────────────────────────────────────────────────────────

/** Block, not flex: a flex column would squash each card to fit instead of scrolling. */
function Column({ toolbar, customize, children }: { toolbar?: ReactNode; customize?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {toolbar}
      <div className="scroll-y min-h-0 flex-1 px-2.5 py-2.5">
        <div className="flex flex-col gap-2">{children}</div>
      </div>
      {customize}
    </div>
  );
}

/** One section as a card, with the DOM id the shortcuts and the quick search scroll to. */
function Card({ id, ...rest }: { id: string } & Omit<Parameters<typeof SectionCard>[0], 'id'>) {
  return <SectionCard id={cardId(id)} {...rest} />;
}
