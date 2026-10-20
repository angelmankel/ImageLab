/**
 * The new workspace (Donny's spec, 10-19): three steps — Image · Video · Workflow — that are
 * `mainView` generate / video / studio underneath (`lib/workspace.ts`), each with its own full
 * interface, free movement between them.
 *
 *   Desktop                                              Phone
 *   ┌──────────┬──── stage ────────────────┬─────────┐   ┌ Image · Video · Workflow · ● jobs ┐
 *   │ Generate │ ▸ steps · status · jobs ▸ │ history │   │ ┌──── stage, full width ───────┐  │
 *   │ seed     │                           │ /       │   │ │   the result, its own shape  │  │
 *   │ prompt   │   the result, full height │ results │   │ └──────────────────────────────┘  │
 *   │ hub      │   no padding, centred     │ grid    │   │ prompt hub                        │
 *   │ chips    │                           │         │   │ chips …                 (scrolls) │
 *   │          │ ▫ ▫ ▫ filmstrip (floats)  │         │   ├───────────────────────────────────┤
 *   └──────────┴───────────────────────────┴─────────┘   └ Seed · [ ▶ Generate ]   (pinned) ┘
 *
 * Nothing in the centre column takes height from the stage: the bar, the filmstrip, the result
 * actions and the progress float over it (`Stage.tsx`). The two side columns are the docked,
 * resizable panels every desktop view has (`layout/panelLayout`, `PanelResizeHandle`); open state
 * is shared with the classic shell (`desktop/desktopLayoutStore`). Settings → Workspace →
 * "Classic workspace" goes back to the old `WorkspaceView` shells.
 */
import { useEffect, type ReactNode } from 'react';
import { onApp } from '@/lib/appEvents';
import { ActionIcon, Stack, Text, Tooltip } from '@mantine/core';
import { IconLayoutGrid, IconPencil } from '@tabler/icons-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useCanvasStore } from '@/lib/canvasStore';
import { modeOfView, type WorkspaceMode } from '@/lib/workspace';
import { PanelResizeHandle } from '@/features/layout/PanelResizeHandle';
import { SidePanel } from '@/features/layout/SidePanel';
import { usePanelLayout } from '@/features/layout/panelLayout';
import { TOOLBAR_TRANSITION } from '@/features/layout/constants';
import { HistoryPanel } from '@/features/history/HistoryPanel';
import { useModeHost } from '@/features/workspace/modeHost';
import { useObjectInfo } from '@/features/studio/useStudioRun';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useDesktopLayout } from '@/features/desktop/desktopLayoutStore';
import { ResultsGrid } from '@/features/desktop/ResultsGrid';
import { useWorkflowLibrary } from '@/features/studio/useWorkflowLibrary';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { Stage } from './Stage';
import { StageBar } from './StageBar';
import { ImageStep, ImageStepBody } from './ImageStep';
import { VideoStep, VideoStepBody } from './VideoStep';
import { WorkflowStep, WorkflowStepBody } from './WorkflowStep';
import { ImageRunBar, VideoRunBar, WorkflowRunBar } from './RunBars';
import { useNext } from './nextStore';

export function NextWorkspace() {
  const isDesktop = useIsDesktop();
  const mainView = useCanvasStore(s => s.mainView);
  const mode: WorkspaceMode = modeOfView(mainView) ?? 'image';

  // The video and workflow hosts, and their run stores pointed at them. Attaching holds the
  // socket open while the workspace is on screen, whichever step is showing, so a run in another
  // step keeps reporting into the job tray.
  const videoHost = useModeHost('video');
  const workflowHost = useModeHost('workflow');
  useEffect(() => { useVideoRun.getState().setHost(videoHost); }, [videoHost]);
  useEffect(() => { useWorkflowRun.getState().setHost(workflowHost); }, [workflowHost]);
  useEffect(() => useVideoRun.getState().attach(), []);
  useEffect(() => useWorkflowRun.getState().attach(), []);
  const { info, error: infoError } = useObjectInfo(mode === 'workflow' ? workflowHost : null);

  const hosts = { videoHost, workflowHost, info, infoError };
  return (
    <ErrorBoundary label="Workspace">
      {isDesktop ? <Desktop mode={mode} {...hosts} /> : <Mobile mode={mode} {...hosts} />}
    </ErrorBoundary>
  );
}

interface Hosts { videoHost: string | null; workflowHost: string | null; info: ObjectInfo | null; infoError: string | null }

// ── Desktop ─────────────────────────────────────────────────────────────────

function Desktop({ mode, ...hosts }: { mode: WorkspaceMode } & Hosts) {
  const leftOpen = useDesktopLayout(s => s.leftOpen);
  const rightOpen = useDesktopLayout(s => s.rightOpen);
  const setLeftOpen = useDesktopLayout(s => s.setLeftOpen);
  const setRightOpen = useDesktopLayout(s => s.setRightOpen);
  const leftW = usePanelLayout(s => s.left);
  const rightW = usePanelLayout(s => s.right);
  const dragging = usePanelLayout(s => s.dragging);
  const leftInset = leftOpen ? leftW : 0;
  const rightInset = rightOpen ? rightW : 0;

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-bg-base">
      {/* The stage: the full height of the window between the columns; snaps while a handle is dragged. */}
      <main className="absolute inset-y-0" style={{ left: leftInset, right: rightInset, transition: dragging ? 'none' : TOOLBAR_TRANSITION }}>
        <Stage mode={mode} />
      </main>
      <SidePanel side="left" open={leftOpen} isDesktop width={leftW}>
        <StepPanel mode={mode} {...hosts} />
      </SidePanel>
      <SidePanel side="right" open={rightOpen} isDesktop width={rightW}>
        <Gallery mode={mode} />
      </SidePanel>
      <PanelResizeHandle side="left" open={leftOpen} setOpen={setLeftOpen} />
      <PanelResizeHandle side="right" open={rightOpen} setOpen={setRightOpen} />
    </div>
  );
}

/** The step's full interface. */
function StepPanel({ mode, videoHost, workflowHost, info, infoError }: { mode: WorkspaceMode } & Hosts) {
  if (mode === 'image') return <ImageStep />;
  if (mode === 'video') {
    if (!videoHost) return <Dead title="No ComfyUI server" body="Add one in Settings, then come back." />;
    return <VideoStep host={videoHost} />;
  }
  if (!workflowHost) return <Dead title="No ComfyUI server" body="Add one in Settings, then come back." />;
  if (infoError) return <Dead title="Cannot reach ComfyUI" body={infoError} />;
  return <WorkflowStep host={workflowHost} info={info} />;
}

/** The right column: the image history, or the run store's results grid. The stage renders the viewer. */
function Gallery({ mode }: { mode: WorkspaceMode }) {
  const picked = useDesktopLayout(s => s.picked[mode]);
  const setPicked = useDesktopLayout(s => s.setPicked);
  if (mode === 'image') return <HistoryPanel tileClickMode="select-then-open" viewer={false} />;
  return <ResultsGrid mode={mode} currentKey={picked} onPick={key => setPicked(mode, key)} />;
}

function Dead({ title, body }: { title: string; body: string }) {
  return (
    <Stack h="100%" align="center" justify="center" gap={6} px="xl" ta="center">
      <Text size="sm" fw={500}>{title}</Text>
      <Text size="xs" c="dimmed">{body}</Text>
    </Stack>
  );
}

// ── Phone ───────────────────────────────────────────────────────────────────

function Mobile({ mode, ...hosts }: { mode: WorkspaceMode } & Hosts) {
  const pane = useNext(s => s.mobilePane);
  const setPane = useNext(s => s.setMobilePane);
  const gallery = pane === 'gallery';
  // The quick search sends the phone to a tab; the controller's ZL / ZR flip between the step and the gallery.
  useEffect(() => onApp('mobile-tab', (t) => setPane(t === 'gallery' ? 'gallery' : 'step')), [setPane]);
  useEffect(() => onApp('pad-tab', () => setPane(useNext.getState().mobilePane === 'gallery' ? 'step' : 'gallery')), [setPane]);
  return (
    <div className="absolute inset-0 flex flex-col bg-bg-base" style={{ overscrollBehavior: 'none', touchAction: 'manipulation' }}>
      <div className="shrink-0 bg-bg-panel" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <StageBar floating={false} extra={
          <Tooltip label={gallery ? 'Back to the step' : 'Gallery'} withArrow>
            <ActionIcon variant={gallery ? 'light' : 'subtle'} color="gray" size="lg" onClick={() => setPane(gallery ? 'step' : 'gallery')} aria-label={gallery ? 'Back to the step' : 'Gallery'} aria-pressed={gallery}>
              {gallery ? <IconPencil size={18} /> : <IconLayoutGrid size={18} />}
            </ActionIcon>
          </Tooltip>
        } />
      </div>
      {gallery ? (
        <div className="min-h-0 flex-1 overflow-hidden"><Gallery mode={mode} /></div>
      ) : (
        <MobileStep key={mode} mode={mode} {...hosts} />
      )}
    </div>
  );
}

/** The stage at the top of one scroll with the step's controls under it; the run bar pinned below. */
function MobileStep({ mode, videoHost, workflowHost, info, infoError }: { mode: WorkspaceMode } & Hosts) {
  const library = useWorkflowLibrary(mode === 'workflow' ? workflowHost : null, info);
  let body: ReactNode;
  let footer: ReactNode;
  if (mode === 'image') {
    body = <ImageStepBody large />;
    footer = <ImageRunBar large />;
  } else if (mode === 'video') {
    if (!videoHost) return <Dead title="No ComfyUI server" body="Add one in Settings, then come back." />;
    body = <VideoStepBody host={videoHost} large />;
    footer = <VideoRunBar host={videoHost} large />;
  } else {
    if (!workflowHost) return <Dead title="No ComfyUI server" body="Add one in Settings, then come back." />;
    if (infoError) return <Dead title="Cannot reach ComfyUI" body={infoError} />;
    body = <WorkflowStepBody host={workflowHost} library={library} large />;
    footer = <WorkflowRunBar host={workflowHost} info={info} large />;
  }
  return (
    <>
      <div className="scroll-y min-h-0 flex-1" style={{ touchAction: 'pan-y' }} data-pad-start>
        <Stage mode={mode} mobile />
        <div className="p-3">{body}</div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-border-default bg-bg-panel px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
        {footer}
      </div>
    </>
  );
}
