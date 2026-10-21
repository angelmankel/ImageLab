/**
 * Right-click "Make snippets from this" on a picture (history tiles, the canvas, the full-screen
 * viewer): opens "Snippets from a picture" with it. Loaded by SnippetsFromImage.tsx.
 */
import { IconPhotoScan } from '@tabler/icons-react';
import { registerMenu } from '~/app/contextMenu';
import type { CanvasTarget } from '~/screens/image/canvasMenu';
import type { ViewerMenuTarget } from '~/screens/viewer/viewerMenu';
import { openSnippetsFromImage } from './fromImageRuns';

const LABEL = 'Make snippets from this';
const isVideo = (u: string) => /\.(mp4|webm|mov|mkv)(\?|$)/i.test(u);

registerMenu<{ url: string; name?: string; filename?: string }>('history-image', [
  { id: 'snippets-from', label: LABEL, icon: IconPhotoScan, group: 'reuse', order: 50, visible: (t) => !!t.url && !isVideo(t.url),
    action: (t) => openSnippetsFromImage({ url: t.url, name: t.filename ?? t.name }) },
]);

registerMenu<CanvasTarget>('canvas-image', [
  { id: 'snippets-from', label: LABEL, icon: IconPhotoScan, group: 'reuse', order: 50, visible: (t) => t.item.kind === 'image',
    action: (t) => openSnippetsFromImage({ url: t.item.url, name: t.item.filename }) },
]);

registerMenu<ViewerMenuTarget>('viewer-image', [
  { id: 'snippets-from', label: LABEL, icon: IconPhotoScan, group: 'reuse', order: 50, visible: (t) => t.item.kind === 'image',
    action: (t) => { t.onClose(); openSnippetsFromImage({ url: t.item.url, name: t.item.filename }); } },
]);
