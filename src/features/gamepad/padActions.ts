/**
 * What the controller's buttons do in the app, per workspace mode: generate, stop, seed, mode,
 * Simple / Advanced, favourite. Results and the viewers are `padViewer.ts`.
 */
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { WORKSPACE_MODES, modeOfView, viewOfMode, type WorkspaceMode } from '@/lib/workspace';
import { fireFromStore } from '@/features/generate/GenerateButton';
import { modeHostNow } from '@/features/workspace/modeHost';
import { useWorkspace } from '@/features/workspace/workspaceStore';
import { startVideoRun, useVideoRun } from '@/features/video/videoRun';
import { useVideo } from '@/features/video/videoStore';
import { startWorkflowRun, useWorkflowRun } from '@/features/studio/studioRun';
import { useStudio } from '@/features/studio/studioStore';
import { objectInfoNow } from '@/features/studio/useStudioRun';

const toast = (message: string, color?: string) =>
  notifications.show({ message, color, autoClose: 1600, withCloseButton: false });

/** The mode on screen; the canvas view generates images too. Null in the other views. */
export function modeNow(): WorkspaceMode | null {
  const view = useCanvasStore.getState().mainView;
  return modeOfView(view) ?? (view === 'canvas' ? 'image' : null);
}

const runningImageJob = () => {
  const jobs = useStore.getState().jobs;
  return jobs.find(j => j.status === 'running') ?? jobs.find(j => j.status === 'queued') ?? null;
};

export function modeBusy(mode: WorkspaceMode): boolean {
  if (mode === 'image') return !!runningImageJob() || useStore.getState().isSubmitting;
  return (mode === 'video' ? useVideoRun : useWorkflowRun).getState().busy;
}

export function generate(mode: WorkspaceMode) {
  if (mode === 'image') {
    const before = useStore.getState().jobs.length;
    void fireFromStore().then(() => {
      const st = useStore.getState();
      // The desktop shows a refusal by its button; a phone in a clip would never see it there.
      if (st.jobs.length === before && st.status.kind === 'error') toast(st.status.text, 'red');
    });
    return;
  }
  if (modeBusy(mode)) return;
  const host = modeHostNow(mode);
  if (!host) { toast('Add a ComfyUI server in Settings first.', 'red'); return; }
  if (mode === 'video') { void startVideoRun(host); return; }
  const info = objectInfoNow(host);
  if (!useStudio.getState().path) toast('Open a workflow first.', 'red');
  else if (!info) toast('Still reading the server…');
  else void startWorkflowRun(host, info);
}

/** Stop the mode's running job. False when nothing runs. */
export function stop(mode: WorkspaceMode): boolean {
  if (mode === 'image') {
    const job = runningImageJob();
    if (!job) return false;
    useStore.getState().cancelJob(job.id);
  } else {
    const store = mode === 'video' ? useVideoRun : useWorkflowRun;
    if (!store.getState().busy) return false;
    void store.getState().cancel();
  }
  toast('Stopped');
  return true;
}

/** Plus: what the big run button shows — Generate, or Stop while the mode runs. */
export function runOrStop(mode: WorkspaceMode) {
  if (modeBusy(mode) && stop(mode)) return;
  generate(mode);
}

/** X: a new random seed, in the range each mode's seed row uses (Workflow: every seed). */
export function newSeed(mode: WorkspaceMode) {
  if (mode !== 'workflow') {
    const seed = Math.floor(Math.random() * 0xFFFFFFFF);
    if (mode === 'image') useStore.getState().setWorkflow({ seed });
    else useVideo.getState().set({ seed });
    toast(`Seed ${seed}`);
  } else {
    useStudio.getState().rerollSeeds();
    toast('New seeds');
  }
}

/** L / R: the previous or next mode, wrapping. Only inside the workspace. */
export function stepMode(dir: 1 | -1) {
  const cur = modeOfView(useCanvasStore.getState().mainView);
  if (!cur) return;
  const i = WORKSPACE_MODES.findIndex(m => m.mode === cur);
  const next = WORKSPACE_MODES[(i + dir + WORKSPACE_MODES.length) % WORKSPACE_MODES.length];
  useCanvasStore.getState().setMainView(viewOfMode(next.mode));
}

export const toggleDetail = () => useWorkspace.getState().toggleDetail();

/** Y: star or unstar the image on screen (the hero's, or the viewer's — the same selection). */
export function favouriteShown() {
  const st = useStore.getState();
  const entry = st.selectedEntry ?? st.history[0];
  if (!entry) return;
  st.toggleHistoryLiked(entry.id);
  toast(entry.liked ? 'Removed from favourites' : 'Added to favourites');
}
