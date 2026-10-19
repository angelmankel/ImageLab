/**
 * A sweep: N video runs that differ in one setting (`lib/videoSweep.ts` makes the list). The run
 * store takes one job at a time, so this store plays the items in order — it watches `useVideoRun`
 * and starts the next item each time a run ends well. Every result that lands while an item runs
 * is labelled with that item ("CFG 3.5"), so the strip, the grid and the compare view can say what
 * made it. Labels are kept per browser (`imagelab.video.labels.v1`), a few hundred at most.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SweepItem } from '@/lib/videoSweep';
import { startVideoRun, useVideoRun } from './videoRun';
import { useVideo } from './videoStore';

const MAX_LABELS = 400;

interface SweepState {
  /** Items still to run, the current one first. */
  queue: SweepItem[];
  total: number;
  /** The item running now, or null. */
  current: SweepItem | null;
  host: string | null;
  /** Result url → the sweep label that made it. */
  labels: Record<string, string>;
  start: (host: string, items: SweepItem[]) => Promise<void>;
  cancel: () => void;
  label: (url: string) => string | undefined;
}

export const useVideoSweep = create<SweepState>()(
  persist(
    (set, get) => ({
      queue: [],
      total: 0,
      current: null,
      host: null,
      labels: {},
      start: async (host, raw) => {
        if (!raw.length || get().current) return;
        // One knob changes between the runs: the seed is pinned to the one shown unless it is the axis.
        const seed = useVideo.getState().seed;
        const items = raw.map((it) => ({ ...it, patch: { ...it.patch, seed: it.patch.seed ?? seed } }));
        set({ host, queue: items.slice(1), total: items.length, current: items[0] });
        await startVideoRun(host, items[0].patch);
        // A refused build (missing file, empty prompt) sets the error without ever being busy.
        if (!useVideoRun.getState().busy) set({ queue: [], total: 0, current: null });
      },
      cancel: () => set({ queue: [], total: 0, current: null }),
      label: (url) => get().labels[url],
    }),
    { name: 'imagelab.video.labels.v1', partialize: (s) => ({ labels: s.labels }) },
  ),
);

let knownUrls = new Set<string>();
let wasBusy = false;

// Run to run: label what the current item produced, then start the next item.
useVideoRun.subscribe((run) => {
  const sweep = useVideoSweep.getState();
  if (sweep.current) {
    const fresh = run.results.filter((r) => !knownUrls.has(r.url));
    if (fresh.length) {
      const labels = { ...sweep.labels };
      for (const r of fresh) labels[r.url] = sweep.current.label;
      const keys = Object.keys(labels);
      if (keys.length > MAX_LABELS) for (const k of keys.slice(0, keys.length - MAX_LABELS)) delete labels[k];
      useVideoSweep.setState({ labels });
    }
  }
  knownUrls = new Set(run.results.map((r) => r.url));

  if (wasBusy && !run.busy && sweep.current) {
    const [next, ...rest] = sweep.queue;
    if (run.error || !next || !sweep.host) {
      useVideoSweep.setState({ queue: [], total: 0, current: null });
    } else {
      useVideoSweep.setState({ queue: rest, current: next });
      void startVideoRun(sweep.host, next.patch);
    }
  }
  wasBusy = run.busy;
});
