/**
 * The video run: one store for the whole app (`lib/comfyRunner.ts`), so a video keeps rendering
 * and reporting while the Image mode is in use. `startVideoRun(host)` builds the Wan graph from
 * `videoStore` and queues it; the job tray and the Video mode both read `useVideoRun`.
 */
import { createRunStore, type RunSource } from '@/lib/comfyRunner';
import { useStore } from '@/lib/store';
import { buildWanGraph, isVideoName, wanRunTiming } from '@/lib/wanGraph';
import { missingVideoFiles } from '@/lib/videoSections';
import { modelLabel } from '@/components/models/modelInfo';
import { randomVideoSeed, useVideo } from './videoStore';
import { useVideoTimings } from './videoTimings';

/** Only videos: the same server's images belong to the other modes. */
export const useVideoRun = createRunStore((img) => isVideoName(img.filename));

export function videoRunSource(host: string): RunSource {
  return {
    build: async () => {
      const st = useVideo.getState();
      if (!st.positive.trim()) return { error: 'Write a prompt first.' };
      if (st.mode === 'i2v' && !st.startImage) return { error: 'Choose a start image first.' };
      const missing = missingVideoFiles(st, useStore.getState().server);
      if (missing.length) return { error: `Not on the server: ${missing.map(modelLabel).join(', ')}. Pick installed files under Models, or download these first.` };
      let seed = st.seed;
      if (st.randomizeSeed) { seed = randomVideoSeed(); st.set({ seed }); }
      return { graph: buildWanGraph({ ...st, seed }, st.startImage || null) };
    },
    keep: (img) => isVideoName(img.filename),
    // Every finished run teaches the time estimate.
    onFinished: ({ graph, nodeMs }) => {
      useVideoTimings.getState().record(host, wanRunTiming(graph as Parameters<typeof wanRunTiming>[0], nodeMs));
    },
  };
}

/** Queue a video on `host` with the current settings. */
export function startVideoRun(host: string): Promise<void> {
  const st = useVideoRun.getState();
  st.setHost(host);
  return st.run(videoRunSource(host));
}
