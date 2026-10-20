/**
 * Item 47 (tab title + favicon) and item 19 (the footer): ONE live answer to "what is the app
 * doing" — `useJobProgress()` (a zustand hook: `useJobProgress((p) => p.percent)` or the whole
 * `JobProgress`). `useJobProgressEffect()` (mounted once in `AppEffects`) feeds it from the stores
 * outside React, so a progress tick never re-renders the app, and writes the browser tab's title and
 * favicon. Done / Error stay for 4 s on a tab you are looking at; on a hidden tab until you come back.
 * Offline only after a short boot grace, so a reload does not flash it.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { useStore } from '@/lib/store';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useDownloadsStore } from '@/features/downloads/store';
import { useSteps } from './stepsStore';
import { rowsOf } from './queue';
import { IDLE, faviconHrefOf, jobProgressOf, sameProgress, tabTitleOf, type JobProgress } from './jobProgressLogic';

export type { JobProgress, JobState } from './jobProgressLogic';
export { tabTitleOf } from './jobProgressLogic';

export const useJobProgress = create<JobProgress>(() => IDLE);

const FLASH_MS = 4000;
const BOOT_GRACE_MS = 6000;
const BASE_TITLE = 'ImageLab';

/** Mount once at the root: feeds `useJobProgress` and writes the tab title + favicon. */
export function useJobProgressEffect() {
  useEffect(() => {
    const bootAt = Date.now();
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const baseHref = link?.getAttribute('href') ?? '';
    let shownHref = baseHref;
    let flash: 'done' | 'error' | null = null;
    let flashTimer: number | undefined;
    let bootTimer: number | undefined;
    let wasBusy = false;
    let errorsBefore = -1;

    const errorCount = () => useStore.getState().jobs.filter((j) => j.status === 'error').length
      + (useVideoRun.getState().error ? 1 : 0) + (useWorkflowRun.getState().error ? 1 : 0);
    const fadeFlashSoon = () => {
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => { flash = null; render(); }, FLASH_MS);
    };

    const render = () => {
      const s = useStore.getState();
      const steps = useSteps.getState().steps;
      const rows = rowsOf(s.jobs, s.servers, useVideoRun.getState(), useWorkflowRun.getState(), steps);
      const busy = rows.length > 0 || s.isSubmitting;
      const errors = errorCount();
      if (errorsBefore >= 0 && errors > errorsBefore) flash = 'error';
      else if (wasBusy && !busy && flash !== 'error') flash = 'done';
      if (busy) { window.clearTimeout(flashTimer); if (flash === 'done') flash = null; }
      else if (flash && !document.hidden) fadeFlashSoon();
      wasBusy = busy;
      errorsBefore = errors;

      const dl = useDownloadsStore.getState();
      const active = dl.rows.filter((r) => r.status === 'downloading').length;
      const agg = dl.aggregateProgress();
      const enabled = s.servers.some((sv) => sv.enabled !== false);
      const offline = enabled && Date.now() - bootAt > BOOT_GRACE_MS && Object.keys(s.serverInfo).length === 0;
      const next = jobProgressOf({
        rows, stepIds: steps.map((x) => x.id), flash, offline,
        downloads: active, downloadPercent: agg != null ? agg * 100 : null,
      });
      if (!sameProgress(next, useJobProgress.getState())) useJobProgress.setState(next, true);

      const title = tabTitleOf(next, BASE_TITLE);
      if (document.title !== title) document.title = title;
      const href = faviconHrefOf(next) ?? baseHref;
      if (link && href && href !== shownHref) { link.setAttribute('href', href); shownHref = href; }
    };

    const onVisible = () => { if (!document.hidden && flash) fadeFlashSoon(); };
    render();
    bootTimer = window.setTimeout(render, BOOT_GRACE_MS + 50);
    const unsubs = [
      useStore.subscribe(render), useVideoRun.subscribe(render), useWorkflowRun.subscribe(render),
      useDownloadsStore.subscribe(render), useSteps.subscribe(render),
    ];
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubs.forEach((u) => u());
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(flashTimer);
      window.clearTimeout(bootTimer);
      document.title = BASE_TITLE;
      if (link && baseHref) link.setAttribute('href', baseHref);
    };
  }, []);
}
