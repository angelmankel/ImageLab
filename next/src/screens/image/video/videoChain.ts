/**
 * Chaining for real (rule 2): when the Video step is chained, Generate takes the step's resolved
 * input as it is NOW (`stepInputNow`: the previous step's last or picked result — the one rule in
 * `../stepInputLogic.ts`), runs it through the main app's send-to-video path (fetch → upload to
 * the video host → `startImage`, a portrait picture flips a landscape size), then queues the
 * video run. Plain functions, no hooks: the Generate bar, the phone dock and the toolbar's
 * "Send to next step" all land here.
 */
import { useStore } from '@/lib/store';
import { loadImageRef, uploadImage } from '@/lib/comfy';
import { isVideoFile } from '@/lib/workspace';
import { useVideo, randomVideoSeed, type VideoState } from '@/features/video/videoStore';
import { startVideoRun, useVideoRun } from '@/features/video/videoRun';
import { sendBlobToVideo, sendUrlToVideo } from '@/features/video/sendToVideo';
import { sendToVideo } from '@/features/workspace/sendTo';
import { modeHostNow } from '@/features/workspace/modeHost';
import { useSteps, type Step } from '~/app/stepsStore';
import { stepInputNow } from '../useStepOutput';
import { resolveStart, type Task } from './videoStepLogic';
import { notifyError } from '~/app/notify';

/** The task the engine in use is on. */
export const taskOf = (v: Pick<VideoState, 'engine' | 'mode' | 'h3'>): Task => (v.engine === 'h3' ? v.h3.mode : v.mode);

const fail = (title: string, message: string) => notifyError(title, message);

/** The main store's status text when it is an error (the send-to-video helpers report there). */
const lastError = () => { const s = useStore.getState().status; return s.kind === 'error' ? s.text : null; };

/**
 * Put a picture (any URL the browser can fetch, or a video whose last frame is taken) on the
 * video host as the start frame. Returns false after showing why.
 */
export async function setStartFrameFrom(url: string, name: string): Promise<boolean> {
  const ok = isVideoFile(name)
    ? await sendToVideo({ url, filename: name, kind: 'video' })
    : await sendUrlToVideo(url, name, { open: false });
  if (!ok) fail('Could not set the start frame', lastError() ?? 'The picture could not be uploaded to the video server.');
  return ok;
}

/** A local file as the start frame. */
export async function setStartFrameFile(file: File): Promise<boolean> {
  const ok = await sendBlobToVideo(file, file.name, { open: false });
  if (!ok) fail('Could not set the start frame', lastError() ?? 'The picture could not be uploaded to the video server.');
  return ok;
}

/** Upload a picture to the video host and return its `LoadImage` reference (end frame, reference pictures). */
export async function uploadToVideoHost(src: Blob | string, name: string): Promise<string | null> {
  const host = modeHostNow('video');
  if (!host) { fail('No video server', 'The pod has no video ComfyUI, or it is still starting.'); return null; }
  try {
    const blob = typeof src === 'string' ? await (async () => { const r = await fetch(src); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })() : src;
    let safe = (name || 'image').replace(/[^\w.-]+/g, '-');
    if (!/\.(png|jpe?g|webp|gif|bmp)$/i.test(safe)) safe += '.png';
    return loadImageRef(await uploadImage(host, blob, `${Date.now()}-${safe}`));
  } catch (e) {
    fail('Could not upload the picture', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Generate for the Video step: resolve the start frame (chained → the previous step's output,
 * uploaded now), then queue the run on `host`. `newSeed` rolls a seed and shows it in the store.
 */
export async function runVideoStep(step: Step, host: string, newSeed = false): Promise<void> {
  const v = useVideo.getState();
  if (taskOf(v) === 'i2v') {
    const res = stepInputNow(step.id);
    const start = resolveStart({ resolved: res, startImage: v.startImage });
    if (start.source === 'none') {
      fail('No start picture', res?.kind === 'waiting' ? `Step ${useSteps.getState().steps.indexOf(res.from) + 1} has no output yet.` : 'Pick a start picture in Composition.');
      return;
    }
    if (start.source === 'prev' && !(await setStartFrameFrom(start.prev.url, start.prev.name))) return;
  }
  const override: Parameters<typeof startVideoRun>[1] = {};
  if (newSeed) { const seed = randomVideoSeed(); useVideo.getState().set({ seed }); override.seed = seed; }
  await startVideoRun(host, override);
}

// Every error the video run store reports (a refused build — missing files, no prompt —, a queue
// refusal, an execution error mid-run) becomes one toast, whichever step is on screen.
let lastErrorShown: string | null = null;
useVideoRun.subscribe((s) => {
  if (!s.error || s.error === lastErrorShown) { if (!s.error) lastErrorShown = null; return; }
  lastErrorShown = s.error;
  fail('Video', s.error);
});
