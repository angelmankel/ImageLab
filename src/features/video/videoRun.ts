/**
 * The video run: one store for the whole app (`lib/comfyRunner.ts`), so a video keeps rendering
 * and reporting while the Image mode is in use. `startVideoRun(host)` builds the Wan graph from
 * `videoStore` and queues it; the job tray and the Video mode both read `useVideoRun`.
 *
 * A sweep (`videoSweep.ts`) runs the same source with a settings `override` per run and a seed it
 * chose, so one knob changes between the results and nothing else.
 */
import { createRunStore, type RunSource } from '@/lib/comfyRunner';
import { useStore } from '@/lib/store';
import { buildWanGraph, isVideoName, wanRunTiming, type VideoSettings } from '@/lib/wanGraph';
import { missingVideoFiles } from '@/lib/videoSections';
import { modelLabel } from '@/components/models/modelInfo';
import { randomVideoSeed, useVideo } from './videoStore';
import { useVideoTimings } from './videoTimings';

/** Only videos: the same server's images belong to the other modes. */
export const useVideoRun = createRunStore((img) => isVideoName(img.filename));

export function videoRunSource(host: string, override: Partial<VideoSettings> = {}): RunSource {
  return {
    build: async () => {
      const st = { ...useVideo.getState(), ...override };
      if (!st.positive.trim()) return { error: 'Write a prompt first.' };
      if (st.mode === 'i2v' && !st.startImage) return { error: 'Choose a start image first.' };
      const missing = missingVideoFiles(st, useStore.getState().server);
      if (missing.length) return { error: `Not on the server: ${missing.map(modelLabel).join(', ')}. Pick installed files under Models, or download these first.` };
      let seed = st.seed;
      // A sweep fixes the seed itself; a plain run rolls one when Auto is on and keeps it shown.
      if (override.seed == null && st.randomizeSeed) { seed = randomVideoSeed(); useVideo.getState().set({ seed }); }
      return { graph: buildWanGraph({ ...st, seed }, st.startImage || null) };
    },
    keep: (img) => isVideoName(img.filename),
    // Every finished run teaches the time estimate.
    onFinished: ({ graph, nodeMs }) => {
      useVideoTimings.getState().record(host, wanRunTiming(graph as Parameters<typeof wanRunTiming>[0], nodeMs));
    },
  };
}

/** Queue a video on `host` with the current settings (plus `override`, for sweeps). */
export function startVideoRun(host: string, override: Partial<VideoSettings> = {}): Promise<void> {
  const st = useVideoRun.getState();
  st.setHost(host);
  return st.run(videoRunSource(host, override));
}
