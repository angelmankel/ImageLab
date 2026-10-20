/**
 * The fallback menus (FIXLIST 45): what a right-click shows on something no owner registered a
 * menu for, since the browser's own menu is gone app-wide. A link gets 'link', a picture 'image',
 * a video 'video', anything else 'app'. Owners can add entries to these types too.
 */
import {
  IconArrowLeft, IconCopy, IconDownload, IconExternalLink, IconMaximize, IconRefresh, IconSettings,
} from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { registerMenu } from './registry';

export interface LinkTarget { href: string }
export interface MediaTarget { src: string; name: string }

export function fallbackTarget(t: Element): { type: string; target: unknown; el: Element } {
  const a = t.closest('a[href]') as HTMLAnchorElement | null;
  if (a && a.href && !a.href.startsWith('javascript:')) return { type: 'link', target: { href: a.href } satisfies LinkTarget, el: a };
  const img = t.closest('img') as HTMLImageElement | null;
  if (img && (img.currentSrc || img.src)) return { type: 'image', target: media(img.currentSrc || img.src), el: img };
  const video = t.closest('video') as HTMLVideoElement | null;
  if (video && (video.currentSrc || video.src)) return { type: 'video', target: media(video.currentSrc || video.src), el: video };
  return { type: 'app', target: null, el: t };
}

function media(src: string): MediaTarget {
  let name = 'image';
  try {
    const u = new URL(src, location.href);
    name = u.searchParams.get('filename') || decodeURIComponent(u.pathname.split('/').pop() || '') || name;
  } catch { /* keep the default */ }
  return { src, name };
}

const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => undefined);

function download(m: MediaTarget) {
  const a = document.createElement('a');
  a.href = m.src;
  a.download = m.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const fs = () => !!document.fullscreenElement;
function toggleFullscreen() {
  if (fs()) void document.exitFullscreen?.();
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

registerMenu<LinkTarget>('link', [
  { id: 'open-tab', label: 'Open in a new tab', icon: IconExternalLink, action: (l) => window.open(l.href, '_blank', 'noopener') },
  { id: 'copy', label: 'Copy link', icon: IconCopy, action: (l) => copy(l.href) },
]);

const mediaEntries = (what: string) => [
  { id: 'open-tab', label: `Open ${what} in a new tab`, icon: IconExternalLink, action: (m: MediaTarget) => window.open(m.src, '_blank', 'noopener') },
  { id: 'download', label: 'Download', icon: IconDownload, action: download },
  { id: 'copy', label: `Copy ${what} address`, icon: IconCopy, group: 'copy', action: (m: MediaTarget) => copy(m.src) },
];
registerMenu<MediaTarget>('image', mediaEntries('image'));
registerMenu<MediaTarget>('video', mediaEntries('video'));

registerMenu<null>('app', [
  { id: 'back', label: 'Back', icon: IconArrowLeft, shortcut: 'Alt+←', action: () => useRoute.getState().back() },
  { id: 'reload', label: 'Reload', icon: IconRefresh, shortcut: 'F5', action: () => location.reload() },
  { id: 'fullscreen', label: () => (fs() ? 'Leave full screen' : 'Full screen'), icon: IconMaximize, shortcut: 'F11', visible: () => !!document.documentElement.requestFullscreen, action: toggleFullscreen },
  { id: 'settings', label: 'Settings', icon: IconSettings, group: 'nav', visible: () => useRoute.getState().screen !== 'settings', action: () => useRoute.getState().go('settings') },
]);
