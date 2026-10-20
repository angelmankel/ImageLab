/**
 * What the stage shows for a step: the list of results (newest first), the current one, the live
 * preview and progress while that step's job runs. Images = the main store's history with its
 * selection (the fullscreen viewer pages the same list); video / workflow results = their run
 * stores, picked by key in `stageStore`. A run result picked in the history panel shows on any
 * step's stage until an image is picked again.
 */
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/lib/store';
import { jobActivity } from '@/lib/jobActivity';
import type { ResultItem } from '@/lib/workspace';
import type { HistoryEntry } from '@/lib/types';
import { useImageResults, useVideoResults, useWorkflowResults, type ImageResultItem } from '@/features/workspace/results';
import { useLiveFrame } from '@/features/history/FullscreenViewer';
import { useViewerPrefs } from '@/features/history/viewerPrefs';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import type { Step } from '~/app/stepsStore';
import { useStage } from './stageStore';

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
  const images = useImageResults();
  const videos = useVideoResults();
  const runs = useWorkflowResults();
  const history = useStore((s) => s.history);
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
  const video = useVideoRun(useShallow((s) => ({ busy: s.busy, progress: s.progress, preview: s.preview, status: s.status, node: s.currentNode, queue: s.queueRemaining })));
  const workflow = useWorkflowRun(useShallow((s) => ({ busy: s.busy, progress: s.progress, preview: s.preview, status: s.status, node: s.currentNode, queue: s.queueRemaining })));

  const runItems = videos.find((v) => v.key === runKey) ? videos : runs.find((r) => r.key === runKey) ? runs : step.kind === 'video' ? videos : step.kind === 'workflow' ? runs : NONE;
  const useRun = !!runKey || step.kind === 'video' || step.kind === 'workflow';

  if (useRun) {
    const run = runItems === videos ? video : workflow;
    const index = runKey ? Math.max(0, runItems.findIndex((i) => i.key === runKey)) : runItems.length ? 0 : -1;
    const busy = step.kind === 'video' ? video.busy : step.kind === 'workflow' ? workflow.busy : false;
    const line = busy ? `${run.node ?? run.status ?? 'Working…'}${run.queue ? ` · ${run.queue} queued` : ''}` : null;
    return {
      source: 'run', items: runItems, index, item: runItems[index] ?? null, entry: null,
      live: busy && livePreview ? run.preview : null, busy, progress: busy ? run.progress : null, statusLine: line,
      pick: (i) => { const it = runItems[i]; if (it) showRun(it.key); },
    };
  }

  const current = selected ?? history[0] ?? null;
  const index = current ? images.findIndex((i) => i.key === current.id) : -1;
  const activity = jobActivity(jobs, submitting, online);
  const item: ImageResultItem | null = images[index] ?? null;
  return {
    source: 'image', items: images, index, item, entry: item?.entry ?? current,
    live: activity.active && livePreview ? liveFrame : null, busy: activity.active,
    progress: activity.percent != null ? activity.percent / 100 : null,
    statusLine: activity.active ? (activity.queued > 0 ? `${activity.label} · ${activity.queued} queued` : activity.label) : null,
    pick: (i) => { const it = images[i]; if (it) { select(it.entry); showRun(null); } },
  };
}
