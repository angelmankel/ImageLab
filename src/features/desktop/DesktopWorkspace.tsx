/**
 * The desktop workspace: one layout for Image, Video and Workflow.
 *
 *   ┌ Image · Video · Workflow │ Simple · Advanced │ status · server · queue · jobs │ ‹ › ┐
 *   ├──────────────┬──────────────────────────────────────────────┬───────────────────┤
 *   │ settings     │                                              │ history / results │
 *   │ cards        │          the latest result, big              │ grid              │
 *   │ (one scroll) │          live preview + progress while busy  │                   │
 *   ├──────────────┤                                              │                   │
 *   │ seed         ├──────────────────────────────────────────────┤                   │
 *   │ [ Generate ] │ ▫ ▫ ▫ ▫ ▫  recent results                    │                   │
 *   └──────────────┴──────────────────────────────────────────────┴───────────────────┘
 *
 * The two side columns are the docked, resizable panels the canvas view has (`panelLayout.ts`
 * widths, `PanelResizeHandle`: drag, fold past the minimum, double-click to reset); whether each
 * is open is remembered here. The mode is `canvasStore.mainView` (`lib/workspace.ts`), so every
 * old "go to video" path still lands in the right mode. Each mode's run store outlives the mode,
 * so an image can be made while a video renders, and the top bar's job tray shows both.
 */
import { useEffect } from 'react';
import { Stack, Text } from '@mantine/core';
import { useCanvasStore } from '@/lib/canvasStore';
import { modeOfView, type WorkspaceMode } from '@/lib/workspace';
import { PanelResizeHandle } from '@/features/layout/PanelResizeHandle';
import { SidePanel } from '@/features/layout/SidePanel';
import { usePanelLayout } from '@/features/layout/panelLayout';
import { TOOLBAR_TRANSITION } from '@/features/layout/constants';
import { HistoryPanel } from '@/features/history/HistoryPanel';
import { useModeHost } from '@/features/workspace/modeHost';
import { usePanelScope } from '@/features/workspace/imageScope';
import { useObjectInfo } from '@/features/studio/useStudioRun';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useDesktopLayout } from './desktopLayoutStore';
import { ImageSettingsColumn, VideoSettingsColumn, WorkflowSettingsColumn } from './SettingsColumn';
import { ImageFooter, VideoFooter, WorkflowFooter } from './WorkspaceFooter';
import { ResultsArea } from './ResultsArea';
import { ResultsGrid } from './ResultsGrid';
import { WorkspaceTopBar } from './WorkspaceTopBar';

export function DesktopWorkspace() {
  const mainView = useCanvasStore(s => s.mainView);
  const mode: WorkspaceMode = modeOfView(mainView) ?? 'image';
  const leftOpen = useDesktopLayout(s => s.leftOpen);
  const rightOpen = useDesktopLayout(s => s.rightOpen);
  const setLeftOpen = useDesktopLayout(s => s.setLeftOpen);
  const setRightOpen = useDesktopLayout(s => s.setRightOpen);
  const leftW = usePanelLayout(s => s.left);
  const rightW = usePanelLayout(s => s.right);
  const dragging = usePanelLayout(s => s.dragging);

  // The video and workflow hosts, and their run stores pointed at them. Attaching holds the
  // socket open while the workspace is on screen, whichever mode is showing, so a run in another
  // mode keeps reporting into the job tray.
  const videoHost = useModeHost('video');
  const workflowHost = useModeHost('workflow');
  useEffect(() => { useVideoRun.getState().setHost(videoHost); }, [videoHost]);
  useEffect(() => { useWorkflowRun.getState().setHost(workflowHost); }, [workflowHost]);
  useEffect(() => useVideoRun.getState().attach(), []);
  useEffect(() => useWorkflowRun.getState().attach(), []);
  const { info, error: infoError } = useObjectInfo(mode === 'workflow' ? workflowHost : null);

  const leftInset = leftOpen ? leftW : 0;
  const rightInset = rightOpen ? rightW : 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-base">
      <WorkspaceTopBar mode={mode} leftOpen={leftOpen} rightOpen={rightOpen} setLeftOpen={setLeftOpen} setRightOpen={setRightOpen}
        videoHost={videoHost} workflowHost={workflowHost} info={info} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Centre: dodges the open columns; snaps while a handle is dragged. */}
        <main
          className="absolute inset-y-0"
          style={{ left: leftInset, right: rightInset, transition: dragging ? 'none' : TOOLBAR_TRANSITION }}
        >
          <ResultsArea mode={mode} />
        </main>

        <SidePanel side="left" open={leftOpen} isDesktop width={leftW}>
          <SettingsForMode mode={mode} videoHost={videoHost} workflowHost={workflowHost} info={info} infoError={infoError} />
        </SidePanel>
        <SidePanel side="right" open={rightOpen} isDesktop width={rightW}>
          {mode === 'image'
            ? <HistoryPanel tileClickMode="select-then-open" />
            : <RunGrid mode={mode} />}
        </SidePanel>

        <PanelResizeHandle side="left" open={leftOpen} setOpen={setLeftOpen} />
        <PanelResizeHandle side="right" open={rightOpen} setOpen={setRightOpen} />
      </div>
    </div>
  );
}

/** The settings column and its footer for the mode on screen. */
function SettingsForMode({ mode, videoHost, workflowHost, info, infoError }: {
  mode: WorkspaceMode; videoHost: string | null; workflowHost: string | null;
  info: ReturnType<typeof useObjectInfo>['info']; infoError: string | null;
}) {
  const { scope, empty, note } = usePanelScope();
  if (mode === 'image') {
    return (
      <div className="flex h-full min-h-0 flex-col" aria-label="Image settings">
        <ImageSettingsColumn scope={scope} note={note} empty={empty} />
        <ImageFooter />
      </div>
    );
  }
  if (mode === 'video') {
    if (!videoHost) return <Dead title="No ComfyUI server" body="Add one in Settings, then come back." />;
    return (
      <div className="flex h-full min-h-0 flex-col" aria-label="Video settings">
        <VideoSettingsColumn host={videoHost} />
        <VideoFooter host={videoHost} />
      </div>
    );
  }
  if (!workflowHost) return <Dead title="No ComfyUI server" body="Add one in Settings, then come back." />;
  if (infoError) return <Dead title="Cannot reach ComfyUI" body={infoError} />;
  if (!info) return <Dead title="Reading the server…" body="Fetching the node catalogue." />;
  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Workflow settings">
      <WorkflowSettingsColumn host={workflowHost} info={info} />
      <WorkflowFooter host={workflowHost} info={info} />
    </div>
  );
}

/** The right column's grid picks what the hero shows, through the run store's own selection. */
function RunGrid({ mode }: { mode: WorkspaceMode }) {
  const picked = useDesktopLayout(s => s.picked[mode]);
  const setPicked = useDesktopLayout(s => s.setPicked);
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
