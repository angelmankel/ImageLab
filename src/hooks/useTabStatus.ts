import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import type { RunStore } from '@/lib/comfyRunner';
import { tabIconHref, tabState, tabTitle, type TabSource } from '@/lib/tabStatus';

/** How long a finished or failed state stays on a tab you are looking at. */
const FLASH_MS = 4000;

const runSource = (st: ReturnType<RunStore['getState']>): TabSource => ({
  busy: st.busy,
  running: st.busy && st.status !== 'Queued',
  percent: st.busy && st.progress !== null ? st.progress * 100 : null,
});

/**
 * The browser tab follows every mode's work: orange with a progress ring while anything renders,
 * grey while it waits, then green (done) or red (failed). On a hidden tab the green or red stays
 * until you come back to it. Subscribes outside React so progress ticks never re-render the app.
 */
export function useTabStatus() {
  useEffect(() => {
    const base = document.title || 'ImageLab';
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const baseHref = link?.href ?? '';
    let flash: 'done' | 'error' | null = null;
    let flashTimer: number | undefined;
    let wasBusy = false;
    let errorsBefore = 0;
    let shownHref = '';

    const errorCount = () =>
      useStore.getState().jobs.filter((j) => j.status === 'error').length
      + (useVideoRun.getState().error ? 1 : 0)
      + (useWorkflowRun.getState().error ? 1 : 0);

    const clearFlashSoon = () => {
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => { flash = null; render(); }, FLASH_MS);
    };

    const render = () => {
      const s = useStore.getState();
      const running = s.jobs.find((j) => j.status === 'running');
      const image: TabSource = {
        busy: s.isSubmitting || s.jobs.some((j) => j.status === 'queued' || j.status === 'running'),
        running: !!running,
        percent: running?.progress && running.progress.max > 0 ? (running.progress.value / running.progress.max) * 100 : null,
      };
      const sources = [image, runSource(useVideoRun.getState()), runSource(useWorkflowRun.getState())];
      const busy = sources.some((x) => x.busy);
      const errors = errorCount();

      const settled = (wasBusy && !busy) || errors > errorsBefore;
      if (errors > errorsBefore) flash = 'error';
      else if (wasBusy && !busy && flash !== 'error') flash = 'done';
      if (busy) { window.clearTimeout(flashTimer); if (flash === 'done') flash = null; }
      else if (settled && !document.hidden) clearFlashSoon();
      wasBusy = busy;
      errorsBefore = errors;

      const state = tabState(sources, flash);
      const title = tabTitle(state, base);
      if (document.title !== title) document.title = title;
      const href = state.kind === 'idle' ? baseHref : tabIconHref(state);
      if (link && href && href !== shownHref) { link.href = href; shownHref = href; }
    };

    // Back on the tab: the green or red has been seen, so let it fade.
    const onVisible = () => { if (!document.hidden && flash) clearFlashSoon(); };

    errorsBefore = errorCount();
    render();
    const unsubs = [useStore.subscribe(render), useVideoRun.subscribe(render), useWorkflowRun.subscribe(render)];
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubs.forEach((u) => u());
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(flashTimer);
      document.title = base;
      if (link && baseHref) link.href = baseHref;
    };
  }, []);
}
