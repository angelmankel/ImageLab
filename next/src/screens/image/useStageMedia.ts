/**
 * What the stage shows for a step: the list of results (newest first), the current one, the live
 * preview and progress while that step's job runs. Images = the main store's history with its
 * selection (the fullscreen viewer pages the same list); video / workflow results = their run
 * stores, picked by key in `stageStore`. A run result picked in the history panel shows on any
 * step's stage until an image is picked again.
 */
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/lib/store';
import { jobActivity } from '@/lib/jobActivity';
import type { ResultItem } from '@/lib/workspace';
import type { HistoryEntry } from '@/lib/types';
import type { ImageResultItem } from '@/features/workspace/results';
import { isJobOfSession, useOutputs, useSessionImageResults, useSessionVideoResults, useSessionWorkflowResults } from '~/app/outputs';
import { useSessions } from '~/app/sessionsStore';
import '~/app/sessionPick';
import { useLiveFrame } from '@/features/history/FullscreenViewer';
import { useViewerPrefs } from '@/features/history/viewerPrefs';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import type { Step } from '~/app/stepsStore';
import { useStage } from './stageStore';
import { OWN_KINDS } from './kinds/kindRun';
import { useStepResults } from './useStepOutput';

export interface StageMedia {
  /** 'image' = the history (fullscreen through the store's viewer); 'run' = a run store's results. */
  source: 'image' | 'run';
  items: ResultItem[];
  index: number;
  item: ResultItem | null;
  entry: HistoryEntry | null;
  /** The live preview frame while busy. */
  live: string | null;
  busy: boolean;
  progress: number | null;
  statusLine: string | null;
  pick: (index: number) => void;
}

const NONE: ResultItem[] = [];

export function useStageMedia(step: Step): StageMedia {
  // Fix list 2, items 9 + 15: only this session's outputs, previews and progress reach its stage.
  const images = useSessionImageResults();
  const videos = useSessionVideoResults();
  const runs = useSessionWorkflowResults();
  const sessionId = useSessions((s) => s.currentId);
  const owners = useOutputs((s) => s.jobs);
  const selected = useStore((s) => s.selectedEntry);
  const select = useStore((s) => s.selectHistoryEntry);
  const jobs = useStore((s) => s.jobs);
  const submitting = useStore((s) => s.isSubmitting);
  const online = useStore((s) => Object.keys(s.serverInfo).length > 0);
  /** The toolbar's Live toggle (shared with the viewer's): off, the last result stays while a job runs. */
  const livePreview = useViewerPrefs((s) => s.livePreview);
  const liveFrame = useLiveFrame();
  const runKey = useStage((s) => s.runKey);
  const showRun = useStage((s) => s.showRun);
  const videoRun = useVideoRun(useShallow((s) => ({ busy: s.busy, progress: s.progress, preview: s.preview, status: s.status, node: s.currentNode, queue: s.queueRemaining, jobs: s.jobs })));
  const workflowRun = useWorkflowRun(useShallow((s) => ({ busy: s.busy, progress: s.progress, preview: s.preview, status: s.status, node: s.currentNode, queue: s.queueRemaining, jobs: s.jobs })));
  const video = useMemo(() => mineOnly(videoRun, sessionId, owners), [videoRun, sessionId, owners]);
  const workflow = useMemo(() => mineOnly(workflowRun, sessionId, owners), [workflowRun, sessionId, owners]);
  const myJobs = useMemo(() => jobs.filter((j) => isJobOfSession(j.id, sessionId, owners)), [jobs, sessionId, owners]);

  // Refine / Upscale / Remove BG run on the workflow runner too, and show only their own results (fix list 15 / 22 / 43).
  const ownResults = useStepResults(OWN_KINDS.has(step.kind) ? step : null);
  const ownRuns = useMemo(() => { const keys = new Set(ownResults.map((r) => r.key)); return runs.filter((r) => keys.has(r.key)); }, [ownResults, runs]);
  const stepRuns = OWN_KINDS.has(step.kind) ? ownRuns : runs;
  const runItems = videos.find((v) => v.key === runKey) ? videos : stepRuns.find((r) => r.key === runKey) ? stepRuns : runs.find((r) => r.key === runKey) ? runs : step.kind === 'video' ? videos : step.kind === 'workflow' || OWN_KINDS.has(step.kind) ? stepRuns : NONE;
  const useRun = !!runKey || step.kind === 'video' || step.kind === 'workflow' || OWN_KINDS.has(step.kind);

  if (useRun) {
    const run = runItems === videos ? video : workflow;
    const index = runKey ? Math.max(0, runItems.findIndex((i) => i.key === runKey)) : runItems.length ? 0 : -1;
    const busy = step.kind === 'video' ? video.busy : step.kind === 'workflow' || OWN_KINDS.has(step.kind) ? workflow.busy : false;
    const line = busy ? `${run.node ?? run.status ?? 'Working…'}${run.queue ? ` · ${run.queue} queued` : ''}` : null;
    return {
      source: 'run', items: runItems, index, item: runItems[index] ?? null, entry: null,
      live: busy && livePreview ? run.preview : null, busy, progress: busy ? run.progress : null, statusLine: line,
      pick: (i) => { const it = runItems[i]; if (it) showRun(it.key); },
    };
  }

  const selIndex = selected ? images.findIndex((i) => i.key === selected.id) : -1;
  const index = selIndex >= 0 ? selIndex : images.length ? 0 : -1;
  const current = images[index]?.entry ?? null;
  const activity = jobActivity(myJobs, submitting && myJobs.length > 0, online);
  const runningMine = myJobs.some((j) => j.status === 'running');
  const item: ImageResultItem | null = images[index] ?? null;
  return {
    source: 'image', items: images, index, item, entry: item?.entry ?? current,
    live: activity.active && runningMine && livePreview ? liveFrame : null, busy: activity.active,
    progress: activity.percent != null ? activity.percent / 100 : null,
    statusLine: activity.active ? (activity.queued > 0 ? `${activity.label} · ${activity.queued} queued` : activity.label) : null,
    pick: (i) => { const it = images[i]; if (it) { select(it.entry); showRun(null); } },
  };
}

type RunView = { busy: boolean; progress: number | null; preview: string | null; status: string | null; node: string | null; queue: number; jobs: ReadonlyArray<{ promptId: string; running: boolean }> };

/** A run store as one session sees it: busy only with its own runs; another session's preview / progress never shows. */
function mineOnly(run: RunView, sessionId: string, owners: Parameters<typeof isJobOfSession>[2]): RunView {
  if (!run.busy || !run.jobs.length) return run;
  const mine = run.jobs.filter((j) => isJobOfSession(j.promptId, sessionId, owners));
  if (mine.length === run.jobs.length) return run;
  if (!mine.length) return { ...run, busy: false, progress: null, preview: null, status: null, node: null, queue: 0 };
  const runningMine = mine.some((j) => j.running);
  return runningMine ? run : { ...run, progress: null, preview: null, node: null, status: 'Queued' };
}
