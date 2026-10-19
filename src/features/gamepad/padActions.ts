/**
 * What the controller's buttons do in the app, per workspace mode. Everything that lives in a store
 * is reached directly; the Video and Workflow result picks live in each shell's own state, so those
 * shells register a small handle (`usePadResults`) while they are on screen.
 */
import { useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { stepResult } from '@/lib/desktopLayout';
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

// ── Results ─────────────────────────────────────────────────────────────────

/** A shell's results, for the modes whose pick lives in component state. */
export interface PadResults {
  /** +1 older, -1 newer, as ←/→ on the keyboard. */
  step: (dir: 1 | -1) => void;
  /** Open the shown result full screen. */
  open: () => void;
}

const handles: { current: PadResults }[] = [];

/** Register while mounted; the latest mounted wins. Handlers are read through a ref. */
export function usePadResults(target: PadResults) {
  const ref = useRef(target);
  ref.current = target;
  useEffect(() => {
    const h = { get current() { return ref.current; } };
    handles.push(h);
    return () => { handles.splice(handles.indexOf(h), 1); };
  }, []);
}

export function stepResults(mode: WorkspaceMode, dir: 1 | -1) {
  if (mode === 'image') {
    const st = useStore.getState();
    const cur = st.selectedEntry ?? st.history[0] ?? null;
    const i = stepResult(cur ? st.history.findIndex(h => h.id === cur.id) : -1, st.history.length, dir);
    if (st.history[i]) st.selectHistoryEntry(st.history[i]);
    return;
  }
  handles[handles.length - 1]?.current.step(dir);
}

export function openResult(mode: WorkspaceMode) {
  if (mode === 'image') { if (useStore.getState().history.length) useStore.getState().openViewer(); return; }
  handles[handles.length - 1]?.current.open();
}
