/**
 * Send an image to the Video view as the image → video start frame.
 *
 * The start image is a `LoadImage` reference on the server Video runs on, so the picture is
 * fetched through the browser and uploaded there (the same `input/imagelab/` subfolder Studio's
 * uploader uses) — the image may have been made on another server. WanImageToVideo crops the
 * start frame to the video size, so a portrait image turns a landscape video portrait (and back).
 */
import type { HistoryEntry } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { loadImageRef, uploadImage, viewUrl } from '@/lib/comfy';
import { modeHostNow } from '@/features/workspace/modeHost';
import { useVideo } from './videoStore';

async function imageSize(blob: Blob): Promise<{ w: number; h: number } | null> {
  const src = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = src;
    });
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** Upload `blob` to the Video server and make it the start image; opens the Video view.
 *  Returns false (with a status message) when it could not. */
export async function sendBlobToVideo(blob: Blob, name: string, opts: { open?: boolean } = {}): Promise<boolean> {
  const { setStatus } = useStore.getState();
  const host = modeHostNow('video');
  if (!host) {
    setStatus('No ComfyUI server to send the image to', 'error');
    return false;
  }
  try {
    let safe = (name || 'image').replace(/[^\w.-]+/g, '-');
    if (!/\.(png|jpe?g|webp|gif|bmp)$/i.test(safe)) safe += '.png';
    const up = await uploadImage(host, blob, `${Date.now()}-${safe}`);
    const v = useVideo.getState();
    const size = await imageSize(blob);
    const patch: Parameters<typeof v.set>[0] = { startImage: loadImageRef(up), mode: 'i2v' };
    if (size && size.w !== size.h && (size.w > size.h) !== (v.width > v.height) && v.width !== v.height) {
      patch.width = v.height;
      patch.height = v.width;
    }
    v.set(patch);
    if (opts.open !== false) useCanvasStore.getState().setMainView('video');
    setStatus('Start image set — Image → Video', 'ok');
    return true;
  } catch (e) {
    setStatus(`Could not send the image to Video: ${e instanceof Error ? e.message : String(e)}`, 'error');
    return false;
  }
}

/** Fetch an image URL (a ComfyUI `/view`, a blob: or data: URL) and send it to Video. */
export async function sendUrlToVideo(url: string, name: string, opts: { open?: boolean } = {}): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await sendBlobToVideo(await res.blob(), name, opts);
  } catch (e) {
    useStore.getState().setStatus(`Could not fetch the image: ${e instanceof Error ? e.message : String(e)}`, 'error');
    return false;
  }
}

/** A generation from history → the Video view's start image. */
export async function sendEntryToVideo(entry: HistoryEntry): Promise<boolean> {
  const host = useStore.getState().servers.find((s) => s.id === entry.serverId)?.host;
  if (!host) {
    useStore.getState().setStatus("This image's server is gone from Settings", 'error');
    return false;
  }
  return sendUrlToVideo(viewUrl(entry, host), entry.filename);
}
