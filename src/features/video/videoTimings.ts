/**
 * Finished video runs' timings, per server, kept in this browser (`imagelab.video.timings.v1`).
 * The estimate (lib/videoEstimate) learns from these; a pod's GPU decides every number, so one
 * server's runs never inform another's.
 */
import { create } from 'zustand';
import { KEEP_RUNS, type RunTiming } from '@/lib/videoEstimate';

const KEY = 'imagelab.video.timings.v1';
const EMPTY: RunTiming[] = Object.freeze([]) as unknown as RunTiming[];

function load(): Record<string, RunTiming[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

export const useVideoTimings = create<{
  byHost: Record<string, RunTiming[]>;
  record: (host: string, run: RunTiming) => void;
}>((set, get) => ({
  byHost: load(),
  record: (host, run) => {
    const byHost = { ...get().byHost, [host]: [...(get().byHost[host] ?? []), run].slice(-KEEP_RUNS) };
    set({ byHost });
    try { localStorage.setItem(KEY, JSON.stringify(byHost)); } catch { /* storage full or blocked */ }
  },
}));

/** One server's runs (a frozen empty list when there are none, so selectors stay stable). */
export const useHostTimings = (host: string | null) => useVideoTimings((s) => (host ? s.byHost[host] : undefined) ?? EMPTY);
