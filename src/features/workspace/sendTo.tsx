/**
 * Send a result from one mode to another: as Image's input image (img2img), as Video's start
 * frame, or into the open workflow's first image input. A video result sends its last frame, so a
 * clip can be continued in Video or reworked as a still.
 *
 * Every target takes the picture through the browser (fetch, then upload to that mode's server
 * where one is needed), because the result may live on a different server than the one the
 * target mode runs on.
 */
import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconMovie, IconPhoto, IconRoute } from '@tabler/icons-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { loadImageRef, uploadImage } from '@/lib/comfy';
import { viewOfMode, type WorkspaceMode } from '@/lib/workspace';
import { urlToImageState } from '@/features/inputImage/imageOps';
import { sendBlobToVideo } from '@/features/video/sendToVideo';
import { useStudio } from '@/features/studio/studioStore';
import { isImageParam } from '@/features/studio/ImageInput';
import { modeHostNow } from './modeHost';

export type SendSource = { url: string; filename: string; kind: 'image' | 'video' };

const status = (text: string, kind: 'ok' | 'error') => useStore.getState().setStatus(text, kind);
const open = (mode: WorkspaceMode) => useCanvasStore.getState().setMainView(viewOfMode(mode));
const stillName = (name: string) => name.replace(/\.[^.]+$/, '') + '.png';

/** The last frame of a video as a PNG blob, decoded in a detached <video>. */
export async function lastFrame(url: string): Promise<Blob> {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('could not load the video'));
  });
  // A hair before the end: seeking to `duration` exactly lands past the last frame on some codecs.
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = Math.max(0, video.duration - 0.05);
  });
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  video.removeAttribute('src');
  return await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('could not read the frame'))), 'image/png'));
}

async function pictureOf(src: SendSource): Promise<{ blob: Blob; name: string }> {
  if (src.kind === 'video') return { blob: await lastFrame(src.url), name: stillName(src.filename) };
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { blob: await res.blob(), name: src.filename };
}

export async function sendToImage(src: SendSource): Promise<boolean> {
  try {
    const { blob, name } = await pictureOf(src);
    const url = URL.createObjectURL(blob);
    try {
      const state = await urlToImageState(url, name);
      useStore.getState().setWorkflow({ inputImage: state });
    } finally {
      URL.revokeObjectURL(url);
    }
    open('image');
    status(src.kind === 'video' ? 'Last frame set as the input image' : 'Input image set — img2img', 'ok');
    return true;
  } catch (e) {
    status(`Could not send to Image: ${e instanceof Error ? e.message : String(e)}`, 'error');
    return false;
  }
}

export async function sendToVideo(src: SendSource): Promise<boolean> {
  try {
    const { blob, name } = await pictureOf(src);
    return await sendBlobToVideo(blob, name);
  } catch (e) {
    status(`Could not send to Video: ${e instanceof Error ? e.message : String(e)}`, 'error');
    return false;
  }
}

/** Into the open workflow's first image input (a LoadImage widget). */
export async function sendToWorkflow(src: SendSource): Promise<boolean> {
  const studio = useStudio.getState();
  const target = studio.params.find(isImageParam);
  if (!target) {
    status(studio.path ? 'This workflow has no image input' : 'Open a workflow with an image input first', 'error');
    open('workflow');
    return false;
  }
  const host = modeHostNow('workflow');
  if (!host) {
    status('No ComfyUI server for Workflow', 'error');
    return false;
  }
  try {
    const { blob, name } = await pictureOf(src);
    const up = await uploadImage(host, blob, `${Date.now()}-${name.replace(/[^\w.-]+/g, '-')}`);
    studio.setValue(target.id, loadImageRef(up));
    open('workflow');
    status('Image set in the workflow', 'ok');
    return true;
  } catch (e) {
    status(`Could not send to Workflow: ${e instanceof Error ? e.message : String(e)}`, 'error');
    return false;
  }
}

const TARGETS: { mode: WorkspaceMode; label: string; icon: typeof IconPhoto; send: (s: SendSource) => Promise<boolean> }[] = [
  { mode: 'image', label: 'Image (input image)', icon: IconPhoto, send: sendToImage },
  { mode: 'video', label: 'Video (start frame)', icon: IconMovie, send: sendToVideo },
  { mode: 'workflow', label: 'Workflow (image input)', icon: IconRoute, send: sendToWorkflow },
];

/** One button per other mode, for a result's action row. */
export function SendToButtons({ from, source, size = 'md' }: { from: WorkspaceMode; source: SendSource | null; size?: 'sm' | 'md' | 'lg' }) {
  const [busy, setBusy] = useState<WorkspaceMode | null>(null);
  return (
    <Group gap={2} wrap="nowrap">
      {TARGETS.filter(t => t.mode !== from).map(t => (
        <Tooltip key={t.mode} label={`Send ${source?.kind === 'video' ? 'last frame' : 'image'} to ${t.label}`} withinPortal openDelay={300} fz="xs">
          <ActionIcon variant="subtle" size={size} aria-label={`Send to ${t.label}`} disabled={!source || busy !== null} loading={busy === t.mode}
            onClick={async () => {
              if (!source) return;
              setBusy(t.mode);
              try { await t.send(source); } finally { setBusy(null); }
            }}>
            <t.icon size={16} />
          </ActionIcon>
        </Tooltip>
      ))}
    </Group>
  );
}
